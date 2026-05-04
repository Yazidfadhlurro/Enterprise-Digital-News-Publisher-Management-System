<?php

namespace App\Http\Controllers;

use App\Support\EditorialActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminArticleController extends Controller
{
    private const ALLOWED_STATUSES = [
        'draft',
        'pending',
        'revision',
        'approved',
        'published',
        'rejected',
    ];

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', 'all'));

        $perPage = (int) $request->query('per_page', 8);
        $perPage = max(1, min($perPage, 50));

        $query = DB::table('articles as a')
            ->leftJoin('users as u', 'u.id', '=', 'a.author_id')
            ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
            ->select(
                'a.id',
                'a.title',
                'a.slug',
                'a.status',
                'a.excerpt',
                'a.created_at',
                'a.published_at',
                DB::raw("COALESCE(u.name, '-') as author_name"),
                DB::raw("COALESCE(c.name, '-') as category_name")
            );

        if ($search !== '') {
            $query->where(function ($subQuery) use ($search) {
                $subQuery
                    ->where('a.title', 'like', "%{$search}%")
                    ->orWhere('u.name', 'like', "%{$search}%")
                    ->orWhere('c.name', 'like', "%{$search}%");
            });
        }

        if ($status !== '' && $status !== 'all') {
            $query->where('a.status', $status);
        }

        $paginator = $query
            ->orderByDesc('a.created_at')
            ->paginate($perPage)
            ->withQueryString();

        $articles = collect($paginator->items())
            ->map(function ($article) {
                return [
                    'id' => (int) $article->id,
                    'title' => $article->title,
                    'slug' => $article->slug,
                    'excerpt' => $article->excerpt,
                    'author_name' => $article->author_name,
                    'category_name' => $article->category_name,
                    'status' => $article->status,
                    'date' => $article->published_at ?? $article->created_at,
                ];
            })
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Data artikel berhasil dimuat.',
            'data' => [
                'articles' => $articles,
                'filters' => [
                    'q' => $search,
                    'status' => $status,
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

    public function show(int $id): JsonResponse
    {
        $article = $this->fetchArticleById($id);

        if (!$article) {
            return response()->json([
                'status' => 'error',
                'message' => 'Artikel tidak ditemukan.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Detail artikel berhasil dimuat.',
            'data' => [
                'article' => $article,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255'],
            'excerpt' => ['nullable', 'string'],
            'content' => ['required', 'string'],
            'category_id' => ['nullable', 'integer', Rule::exists('categories', 'id')],
            'author_id' => ['nullable', 'integer', Rule::exists('users', 'id')],
            'status' => ['nullable', Rule::in(self::ALLOWED_STATUSES)],
            'reviewer_id' => ['nullable', 'integer', Rule::exists('users', 'id')],
            'review_notes' => ['nullable', 'string'],
            'published_at' => ['nullable', 'date'],
            'featured_image' => ['nullable', 'string', 'max:255'],
            'is_featured' => ['nullable', 'boolean'],
        ]);

        $status = $validated['status'] ?? 'draft';
        $title = trim($validated['title']);
        $sourceSlug = trim((string) ($validated['slug'] ?? $title));
        $slug = $this->makeUniqueSlug($sourceSlug);
        $publishedAt = $this->resolvePublishedAt($status, $validated['published_at'] ?? null, null);
        $now = now();
        $actor = $request->user();
        $actorId = $actor ? (int) $actor->id : null;
        $actorRole = $actor && isset($actor->role) ? (string) $actor->role : null;

        $articleId = DB::transaction(function () use ($validated, $request, $title, $slug, $status, $publishedAt, $now, $actorId, $actorRole) {
            $createdArticleId = DB::table('articles')->insertGetId([
                'author_id' => (int) ($validated['author_id'] ?? $request->user()->id),
                'category_id' => $validated['category_id'] ?? null,
                'title' => $title,
                'slug' => $slug,
                'excerpt' => $validated['excerpt'] ?? null,
                'content' => $validated['content'],
                'featured_image' => $validated['featured_image'] ?? null,
                'status' => $status,
                'reviewer_id' => $validated['reviewer_id'] ?? null,
                'review_notes' => $validated['review_notes'] ?? null,
                'published_at' => $publishedAt,
                'is_featured' => (bool) ($validated['is_featured'] ?? false),
                'views_count' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            EditorialActivityLogger::logTransition(
                $createdArticleId,
                null,
                $status,
                $actorId,
                $actorRole,
                $validated['review_notes'] ?? null,
                $now
            );

            return $createdArticleId;
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Artikel berhasil dibuat.',
            'data' => [
                'article' => $this->fetchArticleById($articleId),
            ],
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $existingArticle = DB::table('articles')->where('id', $id)->first();

        if (!$existingArticle) {
            return response()->json([
                'status' => 'error',
                'message' => 'Artikel tidak ditemukan.',
            ], 404);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:255'],
            'excerpt' => ['sometimes', 'nullable', 'string'],
            'content' => ['sometimes', 'required', 'string'],
            'category_id' => ['sometimes', 'nullable', 'integer', Rule::exists('categories', 'id')],
            'author_id' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')],
            'status' => ['sometimes', Rule::in(self::ALLOWED_STATUSES)],
            'reviewer_id' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')],
            'review_notes' => ['sometimes', 'nullable', 'string'],
            'published_at' => ['sometimes', 'nullable', 'date'],
            'featured_image' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_featured' => ['sometimes', 'boolean'],
        ]);

        if (empty($validated)) {
            throw ValidationException::withMessages([
                'request' => ['Tidak ada data yang diperbarui.'],
            ]);
        }

        $updates = [];
        $nextTitle = array_key_exists('title', $validated)
            ? trim((string) $validated['title'])
            : (string) $existingArticle->title;

        if (array_key_exists('title', $validated)) {
            $updates['title'] = $nextTitle;
        }

        if (array_key_exists('slug', $validated)) {
            $slugSource = trim((string) ($validated['slug'] ?? $nextTitle));
            $updates['slug'] = $this->makeUniqueSlug($slugSource, $id);
        } elseif (array_key_exists('title', $validated)) {
            $updates['slug'] = $this->makeUniqueSlug($nextTitle, $id);
        }

        if (array_key_exists('excerpt', $validated)) {
            $updates['excerpt'] = $validated['excerpt'];
        }

        if (array_key_exists('content', $validated)) {
            $updates['content'] = $validated['content'];
        }

        if (array_key_exists('category_id', $validated)) {
            $updates['category_id'] = $validated['category_id'];
        }

        if (array_key_exists('author_id', $validated)) {
            $updates['author_id'] = $validated['author_id'];
        }

        if (array_key_exists('reviewer_id', $validated)) {
            $updates['reviewer_id'] = $validated['reviewer_id'];
        }

        if (array_key_exists('review_notes', $validated)) {
            $updates['review_notes'] = $validated['review_notes'];
        }

        if (array_key_exists('featured_image', $validated)) {
            $updates['featured_image'] = $validated['featured_image'];
        }

        if (array_key_exists('is_featured', $validated)) {
            $updates['is_featured'] = (bool) $validated['is_featured'];
        }

        $nextStatus = array_key_exists('status', $validated)
            ? $validated['status']
            : $existingArticle->status;

        if (array_key_exists('status', $validated)) {
            $updates['status'] = $nextStatus;
        }

        if (array_key_exists('published_at', $validated) || array_key_exists('status', $validated)) {
            $updates['published_at'] = $this->resolvePublishedAt(
                $nextStatus,
                array_key_exists('published_at', $validated) ? $validated['published_at'] : null,
                $existingArticle->published_at
            );
        }

        $updates['updated_at'] = now();
        $hasStatusTransitionInput = array_key_exists('status', $validated);
        $actor = $request->user();
        $actorId = $actor ? (int) $actor->id : null;
        $actorRole = $actor && isset($actor->role) ? (string) $actor->role : null;

        DB::transaction(function () use ($id, $updates, $hasStatusTransitionInput, $existingArticle, $nextStatus, $actorId, $actorRole) {
            DB::table('articles')->where('id', $id)->update($updates);

            if ($hasStatusTransitionInput) {
                EditorialActivityLogger::logTransition(
                    $id,
                    (string) $existingArticle->status,
                    (string) $nextStatus,
                    $actorId,
                    $actorRole,
                    $updates['review_notes'] ?? null,
                    $updates['updated_at'] ?? now()
                );
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Artikel berhasil diperbarui.',
            'data' => [
                'article' => $this->fetchArticleById($id),
            ],
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $article = DB::table('articles')->where('id', $id)->first();

        if (!$article) {
            return response()->json([
                'status' => 'error',
                'message' => 'Artikel tidak ditemukan.',
            ], 404);
        }

        DB::table('articles')->where('id', $id)->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Artikel berhasil dihapus.',
        ]);
    }

    private function fetchArticleById(int $id): ?array
    {
        $article = DB::table('articles as a')
            ->leftJoin('users as u', 'u.id', '=', 'a.author_id')
            ->leftJoin('users as r', 'r.id', '=', 'a.reviewer_id')
            ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
            ->select(
                'a.id',
                'a.author_id',
                'a.category_id',
                'a.title',
                'a.slug',
                'a.excerpt',
                'a.content',
                'a.featured_image',
                'a.status',
                'a.reviewer_id',
                'a.review_notes',
                'a.published_at',
                'a.is_featured',
                'a.views_count',
                'a.created_at',
                'a.updated_at',
                DB::raw("COALESCE(u.name, '-') as author_name"),
                DB::raw("COALESCE(c.name, '-') as category_name"),
                DB::raw("COALESCE(r.name, '-') as reviewer_name")
            )
            ->where('a.id', $id)
            ->first();

        if (!$article) {
            return null;
        }

        return [
            'id' => (int) $article->id,
            'author_id' => $article->author_id ? (int) $article->author_id : null,
            'author_name' => $article->author_name,
            'category_id' => $article->category_id ? (int) $article->category_id : null,
            'category_name' => $article->category_name,
            'title' => $article->title,
            'slug' => $article->slug,
            'excerpt' => $article->excerpt,
            'content' => $article->content,
            'featured_image' => $article->featured_image,
            'status' => $article->status,
            'reviewer_id' => $article->reviewer_id ? (int) $article->reviewer_id : null,
            'reviewer_name' => $article->reviewer_name,
            'review_notes' => $article->review_notes,
            'published_at' => $article->published_at,
            'is_featured' => (bool) $article->is_featured,
            'views_count' => (int) $article->views_count,
            'created_at' => $article->created_at,
            'updated_at' => $article->updated_at,
            'date' => $article->published_at ?? $article->created_at,
        ];
    }

    private function makeUniqueSlug(string $source, ?int $ignoreId = null): string
    {
        $baseSlug = Str::slug($source);
        $baseSlug = $baseSlug !== '' ? $baseSlug : 'artikel';
        $slug = $baseSlug;
        $counter = 2;

        while (true) {
            $query = DB::table('articles')->where('slug', $slug);

            if ($ignoreId) {
                $query->where('id', '!=', $ignoreId);
            }

            if (!$query->exists()) {
                return $slug;
            }

            $slug = $baseSlug.'-'.$counter;
            $counter += 1;
        }
    }

    private function resolvePublishedAt(string $status, ?string $publishedAtInput, $existingPublishedAt = null)
    {
        if ($status !== 'published') {
            return null;
        }

        if ($publishedAtInput) {
            return $publishedAtInput;
        }

        if ($existingPublishedAt) {
            return $existingPublishedAt;
        }

        return now();
    }
}
