<?php

namespace App\Http\Controllers;

use App\Support\EditorialActivityLogger;
use App\Support\ContentSanitizer;
use App\Support\ReaderCache;
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
            ->leftJoin(
                DB::raw('(SELECT article_id, ROUND(AVG(rating)::numeric, 2) as avg_rating, COUNT(*) as ratings_total FROM article_ratings GROUP BY article_id) as ar'),
                'ar.article_id', '=', 'a.id'
            )
            ->select(
                'a.id',
                'a.title',
                'a.slug',
                'a.status',
                'a.excerpt',
                'a.created_at',
                'a.published_at',
                'a.is_featured',
                DB::raw("COALESCE(u.name, '-') as author_name"),
                DB::raw("COALESCE(c.name, '-') as category_name"),
                DB::raw('COALESCE(ar.avg_rating, 0) as average_rating'),
                DB::raw('COALESCE(ar.ratings_total, 0) as ratings_total')
            );

        if ($search !== '') {
            $likeTerm = '%'.ContentSanitizer::escapeLikeWildcards($search, '!').'%';

            $query->where(function ($subQuery) use ($likeTerm) {
                $subQuery
                    ->whereRaw("a.title LIKE ? ESCAPE '!'", [$likeTerm])
                    ->orWhereRaw("u.name LIKE ? ESCAPE '!'", [$likeTerm])
                    ->orWhereRaw("c.name LIKE ? ESCAPE '!'", [$likeTerm]);
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
                    'is_featured' => (bool) $article->is_featured,
                    'average_rating' => (float) $article->average_rating,
                    'ratings_total' => (int) $article->ratings_total,
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
            'author_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', 'author')],
            'status' => ['nullable', Rule::in(self::ALLOWED_STATUSES)],
            'reviewer_id' => ['nullable', 'integer', Rule::exists('users', 'id')],
            'review_notes' => ['nullable', 'string'],
            'published_at' => ['nullable', 'date'],
            'featured_image' => ['nullable', 'string', 'max:255'],
            'is_featured' => ['nullable', 'boolean'],
            'meta_title' => ['nullable', 'string', 'max:70'],
            'meta_description' => ['nullable', 'string', 'max:160'],
            'og_image' => ['nullable', 'string', 'max:255'],
            'canonical_url' => ['nullable', 'url', 'max:255'],
        ]);

        $status = $validated['status'] ?? 'draft';
        $title = ContentSanitizer::sanitizePlainText($validated['title']);
        $sourceSlug = trim((string) ($validated['slug'] ?? $title));
        $slug = $this->makeUniqueSlug($sourceSlug);
        $excerpt = filled($validated['excerpt'] ?? null)
            ? ContentSanitizer::sanitizePlainText($validated['excerpt'])
            : null;
        $content = ContentSanitizer::sanitizeRichText($validated['content']);
        $reviewNotes = filled($validated['review_notes'] ?? null)
            ? ContentSanitizer::sanitizePlainText($validated['review_notes'])
            : null;
        $featuredImageInput = $validated['featured_image'] ?? null;
        $featuredImage = ContentSanitizer::sanitizeMediaPath($featuredImageInput);
        if ($featuredImageInput !== null && trim((string) $featuredImageInput) !== '' && $featuredImage === null) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gambar unggulan tidak valid.',
            ], 422);
        }
        $publishedAt = $this->resolvePublishedAt($status, $validated['published_at'] ?? null, null);
        $now = now();
        $actor = $request->user();
        $actorId = $actor ? (int) $actor->id : null;
        $actorRole = $actor && isset($actor->role) ? (string) $actor->role : null;

        $articleId = DB::transaction(function () use ($validated, $request, $title, $slug, $status, $publishedAt, $now, $actorId, $actorRole, $excerpt, $content, $featuredImage, $reviewNotes) {
            $createdArticleId = DB::table('articles')->insertGetId([
                'author_id' => (int) ($validated['author_id'] ?? $request->user()->id),
                'category_id' => $validated['category_id'] ?? null,
                'title' => $title,
                'slug' => $slug,
                'excerpt' => $excerpt,
                'content' => $content,
                'featured_image' => $featuredImage,
                'status' => $status,
                'reviewer_id' => $validated['reviewer_id'] ?? null,
                'review_notes' => $reviewNotes,
                'published_at' => $publishedAt,
                'is_featured' => (bool) ($validated['is_featured'] ?? false),
                'meta_title' => filled($validated['meta_title'] ?? null) ? ContentSanitizer::sanitizePlainText($validated['meta_title']) : null,
                'meta_description' => filled($validated['meta_description'] ?? null) ? ContentSanitizer::sanitizePlainText($validated['meta_description']) : null,
                'og_image' => ContentSanitizer::sanitizeMediaPath($validated['og_image'] ?? null),
                'canonical_url' => filled($validated['canonical_url'] ?? null) ? trim((string) $validated['canonical_url']) : null,
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
                $reviewNotes,
                $now
            );

            return $createdArticleId;
        });

        if ($status === 'published') {
            ReaderCache::forgetInsights();
            ReaderCache::forgetArticleCaches($articleId);
        }

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
            'author_id' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')->where('role', 'author')],
            'status' => ['sometimes', Rule::in(self::ALLOWED_STATUSES)],
            'reviewer_id' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')],
            'review_notes' => ['sometimes', 'nullable', 'string'],
            'published_at' => ['sometimes', 'nullable', 'date'],
            'featured_image' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_featured' => ['sometimes', 'boolean'],
            'meta_title' => ['sometimes', 'nullable', 'string', 'max:70'],
            'meta_description' => ['sometimes', 'nullable', 'string', 'max:160'],
            'og_image' => ['sometimes', 'nullable', 'string', 'max:255'],
            'canonical_url' => ['sometimes', 'nullable', 'url', 'max:255'],
        ]);

        if (empty($validated)) {
            throw ValidationException::withMessages([
                'request' => ['Tidak ada data yang diperbarui.'],
            ]);
        }

        $updates = [];
        $nextTitle = array_key_exists('title', $validated)
            ? ContentSanitizer::sanitizePlainText($validated['title'])
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
            $updates['excerpt'] = filled($validated['excerpt'] ?? null)
                ? ContentSanitizer::sanitizePlainText($validated['excerpt'])
                : null;
        }

        if (array_key_exists('content', $validated)) {
            $updates['content'] = ContentSanitizer::sanitizeRichText($validated['content']);
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
            $updates['review_notes'] = filled($validated['review_notes'] ?? null)
                ? ContentSanitizer::sanitizePlainText($validated['review_notes'])
                : null;
        }

        if (array_key_exists('featured_image', $validated)) {
            $featuredImageInput = $validated['featured_image'];
            $featuredImage = ContentSanitizer::sanitizeMediaPath($featuredImageInput);

            if ($featuredImageInput !== null && trim((string) $featuredImageInput) !== '' && $featuredImage === null) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Gambar unggulan tidak valid.',
                ], 422);
            }

            $updates['featured_image'] = $featuredImage;
        }

        if (array_key_exists('is_featured', $validated)) {
            $updates['is_featured'] = (bool) $validated['is_featured'];
        }

        if (array_key_exists('meta_title', $validated)) {
            $updates['meta_title'] = filled($validated['meta_title']) ? ContentSanitizer::sanitizePlainText($validated['meta_title']) : null;
        }

        if (array_key_exists('meta_description', $validated)) {
            $updates['meta_description'] = filled($validated['meta_description']) ? ContentSanitizer::sanitizePlainText($validated['meta_description']) : null;
        }

        if (array_key_exists('og_image', $validated)) {
            $updates['og_image'] = ContentSanitizer::sanitizeMediaPath($validated['og_image']);
        }

        if (array_key_exists('canonical_url', $validated)) {
            $updates['canonical_url'] = filled($validated['canonical_url']) ? trim((string) $validated['canonical_url']) : null;
        }

        $nextStatus = array_key_exists('status', $validated)
            ? $validated['status']
            : $existingArticle->status;

        $wasPublished = (string) $existingArticle->status === 'published';
        $willBePublished = (string) $nextStatus === 'published';

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

        ReaderCache::forgetArticleCaches($id);
        if ($wasPublished || $willBePublished) {
            ReaderCache::forgetInsights();
        }

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

        $wasPublished = (string) ($article->status ?? '') === 'published';

        DB::table('articles')->where('id', $id)->delete();

        ReaderCache::forgetArticleCaches($id);
        if ($wasPublished) {
            ReaderCache::forgetInsights();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Artikel berhasil dihapus.',
        ]);
    }

    public function toggleFeatured(Request $request, int $id): JsonResponse
    {
        $article = DB::table('articles')->where('id', $id)->first();

        if (!$article) {
            return response()->json(['status' => 'error', 'message' => 'Artikel tidak ditemukan.'], 404);
        }

        $isFeatured = (bool) $request->input('is_featured', !$article->is_featured);

        DB::table('articles')->where('id', $id)->update([
            'is_featured' => $isFeatured,
            'updated_at' => now(),
        ]);

        ReaderCache::forgetArticleCaches($id);
        ReaderCache::forgetInsights();

        return response()->json([
            'status' => 'success',
            'message' => $isFeatured ? 'Artikel dijadikan unggulan.' : 'Artikel dihapus dari unggulan.',
            'data' => ['is_featured' => $isFeatured],
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
                'a.meta_title',
                'a.meta_description',
                'a.og_image',
                'a.canonical_url',
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
            'featured_image_url' => \App\Support\MediaUrl::resolve($article->featured_image),
            'status' => $article->status,
            'reviewer_id' => $article->reviewer_id ? (int) $article->reviewer_id : null,
            'reviewer_name' => $article->reviewer_name,
            'review_notes' => $article->review_notes,
            'published_at' => $article->published_at,
            'is_featured' => (bool) $article->is_featured,
            'views_count' => (int) $article->views_count,
            'meta_title' => $article->meta_title,
            'meta_description' => $article->meta_description,
            'og_image' => $article->og_image,
            'canonical_url' => $article->canonical_url,
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
