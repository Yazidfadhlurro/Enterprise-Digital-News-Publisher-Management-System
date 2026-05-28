<?php

namespace App\Http\Controllers;

use App\Support\EditorialActivityLogger;
use App\Support\ContentSanitizer;
use App\Support\ReaderCache;
use Illuminate\Support\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReviewerArticleController extends Controller
{
    private const REVIEW_STATUSES = ['pending'];
    private const EDITORIAL_STAGES = ['draft', 'review', 'revision', 'published'];

    public function dashboard(Request $request): JsonResponse
    {
        $actor = $request->user();

        $reviewCountQuery = DB::table('articles as a')
            ->whereIn('a.status', self::REVIEW_STATUSES);
        $this->applyReviewerAssignmentScope($reviewCountQuery, $actor, 'a.author_id');
        $reviewCount = $reviewCountQuery->count();

        $publishedCountQuery = DB::table('articles as a')
            ->where('a.status', 'published');
        $this->applyReviewerAssignmentScope($publishedCountQuery, $actor, 'a.author_id');
        $publishedCount = $publishedCountQuery->count();

        $todayReviewCountQuery = DB::table('articles as a')
            ->whereIn('a.status', self::REVIEW_STATUSES)
            ->whereDate('a.created_at', now()->toDateString());
        $this->applyReviewerAssignmentScope($todayReviewCountQuery, $actor, 'a.author_id');
        $todayReviewCount = $todayReviewCountQuery->count();

        $recentReviewQuery = DB::table('articles as a')
            ->leftJoin('users as u', 'u.id', '=', 'a.author_id')
            ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
            ->whereIn('a.status', self::REVIEW_STATUSES)
            ->orderByDesc('a.priority_score')
            ->orderByRaw('CASE WHEN a.review_due_at IS NULL THEN 1 ELSE 0 END')
            ->orderBy('a.review_due_at')
            ->orderByDesc('a.created_at')
            ->limit(5);

        $this->applyReviewerAssignmentScope($recentReviewQuery, $actor, 'a.author_id');

        $recentReviewArticles = $recentReviewQuery->get([
                'a.id',
                'a.title',
                'a.excerpt',
                'a.status',
                'a.priority_score',
                'a.review_due_at',
                'a.created_at',
                'a.published_at',
                DB::raw("COALESCE(u.name, '-') as author_name"),
                DB::raw("COALESCE(c.name, '-') as category_name"),
            ]);

        $articles = collect($recentReviewArticles)
            ->map(fn ($article) => $this->mapArticleSummary($article))
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Dashboard editor berhasil dimuat.',
            'data' => [
                'metrics' => [
                    'review_total' => $reviewCount,
                    'published_total' => $publishedCount,
                    'today_review_total' => $todayReviewCount,
                ],
                'recent_review_articles' => $articles,
            ],
        ]);
    }

    public function activities(Request $request): JsonResponse
    {
        $actor = $request->user();
        $search = trim((string) $request->query('q', ''));
        $stage = trim((string) $request->query('stage', 'all'));

        $page = max(1, (int) $request->query('page', 1));
        $perPage = (int) $request->query('per_page', 12);
        $perPage = max(1, min($perPage, 50));

        $query = DB::table('editorial_activities as ea')
            ->join('articles as a', 'a.id', '=', 'ea.article_id')
            ->leftJoin('users as actor', 'actor.id', '=', 'ea.actor_id');

        $this->applyReviewerAssignmentScope($query, $actor, 'a.author_id');

        if ($stage !== '' && $stage !== 'all' && in_array($stage, self::EDITORIAL_STAGES, true)) {
            $query->where('ea.to_stage', $stage);
        }

        if ($search !== '') {
            $likeTerm = '%'.ContentSanitizer::escapeLikeWildcards($search, '!').'%';

            $query->where(function ($subQuery) use ($likeTerm) {
                $subQuery
                    ->whereRaw("a.title LIKE ? ESCAPE '!'", [$likeTerm])
                    ->orWhereRaw("actor.name LIKE ? ESCAPE '!'", [$likeTerm])
                    ->orWhereRaw("ea.to_stage LIKE ? ESCAPE '!'", [$likeTerm])
                    ->orWhereRaw("ea.from_stage LIKE ? ESCAPE '!'", [$likeTerm])
                    ->orWhereRaw("ea.note LIKE ? ESCAPE '!'", [$likeTerm]);
            });
        }

        $total = (clone $query)->count();
        $offset = ($page - 1) * $perPage;

        $stageSummary = (clone $query)
            ->select('ea.to_stage', DB::raw('COUNT(*) as total'))
            ->groupBy('ea.to_stage')
            ->pluck('total', 'ea.to_stage');

        $activities = $query
            ->orderByDesc('ea.occurred_at')
            ->offset($offset)
            ->limit($perPage)
            ->get([
                'ea.id',
                'ea.article_id',
                'ea.to_stage',
                'ea.occurred_at',
                'ea.note',
                'a.title',
                DB::raw("COALESCE(actor.name, '') as actor_name"),
            ]);

        $items = $activities
            ->values()
            ->map(function ($activity) {
                $stageName = (string) $activity->to_stage;
                $actorName = trim((string) $activity->actor_name);

                if ($actorName === '') {
                    $actorName = EditorialActivityLogger::defaultActorName($stageName);
                }

                return [
                    'id' => (int) $activity->id,
                    'article_id' => (int) $activity->article_id,
                    'stage' => $stageName,
                    'stage_label' => EditorialActivityLogger::stageLabel($stageName),
                    'actor_name' => $actorName,
                    'message' => EditorialActivityLogger::buildMessage($stageName, $actorName, (string) $activity->title),
                    'target' => $activity->title,
                    'note' => $activity->note,
                    'happened_at' => $activity->occurred_at,
                    'time' => Carbon::parse($activity->occurred_at)->diffForHumans(),
                ];
            });

        $lastPage = (int) ceil($total / $perPage);

        return response()->json([
            'status' => 'success',
            'message' => 'Log aktivitas editorial reviewer berhasil dimuat.',
            'data' => [
                'activities' => $items,
                'summary' => [
                    'total' => $total,
                    'draft_total' => (int) ($stageSummary['draft'] ?? 0),
                    'review_total' => (int) ($stageSummary['review'] ?? 0),
                    'revision_total' => (int) ($stageSummary['revision'] ?? 0),
                    'published_total' => (int) ($stageSummary['published'] ?? 0),
                ],
                'pagination' => [
                    'total' => $total,
                    'per_page' => $perPage,
                    'current_page' => $page,
                    'last_page' => max(1, $lastPage),
                ],
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $status = trim((string) $request->query('status', 'review'));
        $search = trim((string) $request->query('q', ''));

        $perPage = (int) $request->query('per_page', 10);
        $perPage = max(1, min($perPage, 50));

        $query = DB::table('articles as a')
            ->leftJoin('users as u', 'u.id', '=', 'a.author_id')
            ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
            ->select(
                'a.id',
                'a.title',
                'a.excerpt',
                'a.status',
                'a.priority_score',
                'a.review_due_at',
                'a.created_at',
                'a.published_at',
                DB::raw("COALESCE(u.name, '-') as author_name"),
                DB::raw("COALESCE(c.name, '-') as category_name")
            );

            $this->applyReviewerAssignmentScope($query, $actor, 'a.author_id');

        if ($status === 'published') {
            $query->where('a.status', 'published');
        } elseif ($status === 'review') {
            $query->whereIn('a.status', self::REVIEW_STATUSES);
        } elseif ($status !== '' && $status !== 'all') {
            $query->where('a.status', $status);
        }

        if ($search !== '') {
            $likeTerm = '%'.ContentSanitizer::escapeLikeWildcards($search, '!').'%';

            $query->where(function ($subQuery) use ($likeTerm) {
                $subQuery
                    ->whereRaw("a.title LIKE ? ESCAPE '!'", [$likeTerm])
                    ->orWhereRaw("u.name LIKE ? ESCAPE '!'", [$likeTerm])
                    ->orWhereRaw("c.name LIKE ? ESCAPE '!'", [$likeTerm]);
            });
        }

        if ($status === 'review') {
            $query
                ->orderByDesc('a.priority_score')
                ->orderByRaw('CASE WHEN a.review_due_at IS NULL THEN 1 ELSE 0 END')
                ->orderBy('a.review_due_at')
                ->orderByDesc('a.created_at');
        } else {
            $query->orderByDesc('a.created_at');
        }

        $paginator = $query
            ->paginate($perPage)
            ->withQueryString();

        $articles = collect($paginator->items())
            ->map(fn ($article) => $this->mapArticleSummary($article))
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Data berita editor berhasil dimuat.',
            'data' => [
                'articles' => $articles,
                'filters' => [
                    'status' => $status,
                    'q' => $search,
                ],
                'pagination' => [
                    'total' => $paginator->total(),
                    'per_page' => $paginator->perPage(),
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                ],
            ],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $actor = $request->user();
        $articleQuery = DB::table('articles as a')
            ->leftJoin('users as u', 'u.id', '=', 'a.author_id')
            ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
            ->where('a.id', $id);

        $this->applyReviewerAssignmentScope($articleQuery, $actor, 'a.author_id');

        $article = $articleQuery->first([
                'a.id',
                'a.title',
                'a.excerpt',
                'a.content',
                'a.featured_image',
                'a.featured_image_alt',
                'a.status',
                'a.priority_score',
                'a.review_due_at',
                'a.review_notes',
                'a.category_id',
                'a.created_at',
                'a.published_at',
                DB::raw("COALESCE(u.name, '-') as author_name"),
                DB::raw("COALESCE(c.name, '-') as category_name"),
            ]);

        if (!$article) {
            return response()->json([
                'status' => 'error',
                'message' => 'Berita tidak ditemukan.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Detail berita review berhasil dimuat.',
            'data' => [
                'article' => $this->mapArticleDetail($article),
                'review_checklist' => $this->buildEditorialChecklist($article),
                'revision_diff' => $this->buildRevisionDiff((int) $article->id, $article),
            ],
        ]);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'review_notes' => ['nullable', 'string', 'max:500'],
        ]);

        $article = DB::table('articles')->where('id', $id)->first();

        if (!$article) {
            return response()->json([
                'status' => 'error',
                'message' => 'Berita tidak ditemukan.',
            ], 404);
        }

        if (!in_array($article->status, self::REVIEW_STATUSES, true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Berita tidak berada dalam tahap review.',
            ], 422);
        }

        if (!$this->canActorReviewAuthor($request->user(), (int) $article->author_id)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Berita ini tidak masuk assignment editor Anda.',
            ], 403);
        }

        $checklist = $this->buildEditorialChecklist($article);
        if (!($checklist['all_passed'] ?? false)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Checklist editorial belum terpenuhi. Lengkapi item wajib sebelum publish.',
                'data' => [
                    'review_checklist' => $checklist,
                ],
            ], 422);
        }

        $note = ContentSanitizer::sanitizePlainText($request->input('review_notes'));
        $note = $note === '' ? null : $note;
        $now = now();
        $actor = $request->user();
        $actorId = $actor ? (int) $actor->id : null;
        $actorRole = $actor && isset($actor->role) ? (string) $actor->role : null;

        DB::transaction(function () use ($id, $article, $note, $now, $actorId, $actorRole) {
            DB::table('articles')
                ->where('id', $id)
                ->update([
                    'status' => 'published',
                    'reviewer_id' => $actorId,
                    'review_notes' => $note,
                    'published_at' => $article->published_at ?: $now,
                    'updated_at' => $now,
                ]);

            EditorialActivityLogger::logTransition(
                $id,
                (string) $article->status,
                'published',
                $actorId,
                $actorRole,
                $note,
                $now
            );
        });

        ReaderCache::forgetInsights();

        return response()->json([
            'status' => 'success',
            'message' => 'Berita berhasil dipublish.',
        ]);
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'review_notes' => ['required', 'string', 'min:10', 'max:500'],
        ]);

        $article = DB::table('articles')->where('id', $id)->first();

        if (!$article) {
            return response()->json([
                'status' => 'error',
                'message' => 'Berita tidak ditemukan.',
            ], 404);
        }

        if (!in_array($article->status, self::REVIEW_STATUSES, true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Berita tidak berada dalam tahap review.',
            ], 422);
        }

        if (!$this->canActorReviewAuthor($request->user(), (int) $article->author_id)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Berita ini tidak masuk assignment editor Anda.',
            ], 403);
        }

        $note = ContentSanitizer::sanitizePlainText($request->input('review_notes'));
        $note = $note === '' ? null : $note;
        $now = now();
        $actor = $request->user();
        $actorId = $actor ? (int) $actor->id : null;
        $actorRole = $actor && isset($actor->role) ? (string) $actor->role : null;

        DB::transaction(function () use ($id, $article, $note, $now, $actorId, $actorRole) {
            DB::table('articles')
                ->where('id', $id)
                ->update([
                    'status' => 'revision',
                    'reviewer_id' => $actorId,
                    'review_notes' => $note,
                    'published_at' => null,
                    'updated_at' => $now,
                ]);

            EditorialActivityLogger::logTransition(
                $id,
                (string) $article->status,
                'revision',
                $actorId,
                $actorRole,
                $note,
                $now
            );
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Berita dikembalikan ke revisi.',
        ]);
    }

    private function applyReviewerAssignmentScope($query, $actor, string $authorColumn = 'a.author_id'): void
    {
        if (!$actor || !isset($actor->role) || (string) $actor->role !== 'reviewer') {
            return;
        }

        $reviewerId = (int) $actor->id;

        $query->whereExists(function ($subQuery) use ($authorColumn, $reviewerId) {
            $subQuery
                ->select(DB::raw(1))
                ->from('users as author_assignment')
                ->whereColumn('author_assignment.id', $authorColumn)
                ->where('author_assignment.assigned_reviewer_id', $reviewerId);
        });
    }

    private function canActorReviewAuthor($actor, int $authorId): bool
    {
        if (!$actor || !isset($actor->role)) {
            return false;
        }

        if ((string) $actor->role !== 'reviewer') {
            return true;
        }

        return DB::table('users')
            ->where('id', $authorId)
            ->where('assigned_reviewer_id', (int) $actor->id)
            ->exists();
    }

    private function mapArticleSummary(object $article): array
    {
        return [
            'id' => (int) $article->id,
            'title' => $article->title,
            'excerpt' => $article->excerpt,
            'status' => $article->status,
            'status_label' => $this->statusLabel($article->status),
            'author_name' => $article->author_name,
            'category_name' => $article->category_name,
            'priority_score' => isset($article->priority_score) ? (int) $article->priority_score : 50,
            'review_due_at' => $article->review_due_at ?? null,
            'submitted_at' => $article->created_at,
            'published_at' => $article->published_at,
            'date' => $article->published_at ?? $article->created_at,
        ];
    }

    private function mapArticleDetail(object $article): array
    {
        return [
            ...$this->mapArticleSummary($article),
            'content' => $article->content,
            'featured_image' => $article->featured_image,
            'featured_image_alt' => $article->featured_image_alt ?? null,
            'review_notes' => $article->review_notes,
        ];
    }

    private function buildEditorialChecklist(object $article): array
    {
        $title = trim((string) ($article->title ?? ''));
        $excerpt = trim((string) ($article->excerpt ?? ''));
        $content = trim(strip_tags((string) ($article->content ?? '')));
        $categoryId = $article->category_id ?? null;
        $featuredImage = trim((string) ($article->featured_image ?? ''));
        $featuredImageAlt = trim((string) ($article->featured_image_alt ?? ''));

        $items = [
            [
                'key' => 'title_quality',
                'label' => 'Judul minimal 12 karakter',
                'required' => true,
                'passed' => mb_strlen($title) >= 12,
            ],
            [
                'key' => 'summary_quality',
                'label' => 'Ringkasan minimal 80 karakter',
                'required' => true,
                'passed' => mb_strlen($excerpt) >= 80,
            ],
            [
                'key' => 'content_depth',
                'label' => 'Konten minimal 300 karakter',
                'required' => true,
                'passed' => mb_strlen($content) >= 300,
            ],
            [
                'key' => 'category_set',
                'label' => 'Kategori berita telah ditentukan',
                'required' => true,
                'passed' => !is_null($categoryId),
            ],
            [
                'key' => 'featured_image',
                'label' => 'Gambar unggulan tersedia',
                'required' => true,
                'passed' => $featuredImage !== '',
            ],
            [
                'key' => 'featured_image_alt',
                'label' => 'Teks alternatif gambar diisi',
                'required' => true,
                'passed' => $featuredImage === '' ? true : $featuredImageAlt !== '',
            ],
        ];

        $allPassed = collect($items)
            ->filter(fn (array $item) => $item['required'])
            ->every(fn (array $item) => $item['passed']);

        return [
            'all_passed' => $allPassed,
            'items' => $items,
        ];
    }

    private function buildRevisionDiff(int $articleId, object $article): array
    {
        $versions = DB::table('article_versions')
            ->where('article_id', $articleId)
            ->orderByDesc('snapshot_at')
            ->limit(2)
            ->get([
                'id',
                'source',
                'title',
                'slug',
                'excerpt',
                'content',
                'category_id',
                'featured_image',
                'featured_image_alt',
                'snapshot_at',
            ])
            ->values();

        $latest = $versions->get(0);
        $previous = $versions->get(1);

        if (!$latest) {
            return [
                'has_previous_version' => false,
                'current_version' => null,
                'previous_version' => null,
                'changes' => [],
            ];
        }

        $baseline = $previous ?: (object) [
            'title' => $article->title,
            'excerpt' => $article->excerpt,
            'content' => $article->content,
            'category_id' => $article->category_id,
            'featured_image' => $article->featured_image,
            'featured_image_alt' => $article->featured_image_alt,
        ];

        $changes = [
            [
                'field' => 'title',
                'before' => $baseline->title,
                'after' => $latest->title,
                'changed' => (string) $baseline->title !== (string) $latest->title,
            ],
            [
                'field' => 'excerpt',
                'before' => $this->previewText((string) ($baseline->excerpt ?? '')),
                'after' => $this->previewText((string) ($latest->excerpt ?? '')),
                'changed' => (string) ($baseline->excerpt ?? '') !== (string) ($latest->excerpt ?? ''),
            ],
            [
                'field' => 'content',
                'before_length' => mb_strlen((string) ($baseline->content ?? '')),
                'after_length' => mb_strlen((string) ($latest->content ?? '')),
                'before_preview' => $this->previewText((string) ($baseline->content ?? '')),
                'after_preview' => $this->previewText((string) ($latest->content ?? '')),
                'changed' => (string) ($baseline->content ?? '') !== (string) ($latest->content ?? ''),
            ],
            [
                'field' => 'category_id',
                'before' => $baseline->category_id,
                'after' => $latest->category_id,
                'changed' => (int) ($baseline->category_id ?? 0) !== (int) ($latest->category_id ?? 0),
            ],
            [
                'field' => 'featured_image',
                'before' => $baseline->featured_image,
                'after' => $latest->featured_image,
                'changed' => (string) ($baseline->featured_image ?? '') !== (string) ($latest->featured_image ?? ''),
            ],
            [
                'field' => 'featured_image_alt',
                'before' => $baseline->featured_image_alt,
                'after' => $latest->featured_image_alt,
                'changed' => (string) ($baseline->featured_image_alt ?? '') !== (string) ($latest->featured_image_alt ?? ''),
            ],
        ];

        return [
            'has_previous_version' => $previous !== null,
            'current_version' => [
                'id' => (int) $latest->id,
                'source' => $latest->source,
                'snapshot_at' => $latest->snapshot_at,
            ],
            'previous_version' => $previous
                ? [
                    'id' => (int) $previous->id,
                    'source' => $previous->source,
                    'snapshot_at' => $previous->snapshot_at,
                ]
                : null,
            'changes' => $changes,
        ];
    }

    private function previewText(string $text, int $length = 180): string
    {
        $normalized = trim(preg_replace('/\s+/', ' ', strip_tags($text)) ?? '');

        if (mb_strlen($normalized) <= $length) {
            return $normalized;
        }

        return mb_substr($normalized, 0, $length).'...';
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            'pending' => 'Review',
            'revision' => 'Revisi',
            'published' => 'Publikasi',
            'rejected' => 'Ditolak',
            default => 'Draf',
        };
    }
}
