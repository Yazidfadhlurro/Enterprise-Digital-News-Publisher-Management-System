<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ReaderArticleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $search = trim((string) $request->query('q', ''));
        $categoryId = max(0, (int) $request->query('category_id', 0));
        $featuredOnly = filter_var($request->query('featured', false), FILTER_VALIDATE_BOOLEAN);

        $perPage = (int) $request->query('per_page', 9);
        $perPage = max(1, min($perPage, 30));

        $query = DB::table('articles as a')
            ->leftJoin('users as au', 'au.id', '=', 'a.author_id')
            ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
            ->where('a.status', 'published')
            ->select([
                'a.id',
                'a.title',
                'a.slug',
                'a.excerpt',
                'a.featured_image',
                'a.featured_image_alt',
                'a.category_id',
                'a.views_count',
                'a.is_featured',
                'a.published_at',
                'a.created_at',
                DB::raw("COALESCE(c.name, '-') as category_name"),
                DB::raw("COALESCE(au.name, '-') as author_name"),
            ]);

        if ($search !== '') {
            $query->where(function ($subQuery) use ($search) {
                $subQuery
                    ->where('a.title', 'like', "%{$search}%")
                    ->orWhere('a.excerpt', 'like', "%{$search}%")
                    ->orWhere('c.name', 'like', "%{$search}%");
            });
        }

        if ($categoryId > 0) {
            $query->where('a.category_id', $categoryId);
        }

        if ($featuredOnly) {
            $query->where('a.is_featured', true);
        }

        $paginator = $query
            ->orderByDesc('a.is_featured')
            ->orderByDesc('a.published_at')
            ->orderByDesc('a.created_at')
            ->paginate($perPage)
            ->withQueryString();

        $items = collect($paginator->items());
        $articleIds = $items->pluck('id')->map(fn ($id) => (int) $id)->values()->all();

        $bookmarkedIds = collect();
        if ($articleIds !== [] && Schema::hasColumn('bookmarks', 'user_id')) {
            $bookmarkedIds = DB::table('bookmarks')
                ->where('user_id', (int) $actor->id)
                ->whereIn('article_id', $articleIds)
                ->pluck('article_id')
                ->map(fn ($id) => (int) $id)
                ->flip();
        }

        $ratingStatsByArticle = collect();
        if ($articleIds !== []) {
            $ratingStatsByArticle = DB::table('article_ratings')
                ->whereIn('article_id', $articleIds)
                ->select([
                    'article_id',
                    DB::raw('COUNT(*) as ratings_total'),
                    DB::raw('ROUND(AVG(rating), 2) as average_rating'),
                ])
                ->groupBy('article_id')
                ->get()
                ->keyBy('article_id');
        }

        $commentCounts = collect();
        if ($articleIds !== []) {
            $commentCounts = DB::table('comments')
                ->whereIn('article_id', $articleIds)
                ->where('status', 'approved')
                ->select([
                    'article_id',
                    DB::raw('COUNT(*) as comments_total'),
                ])
                ->groupBy('article_id')
                ->pluck('comments_total', 'article_id');
        }

        $articles = $items
            ->map(function ($article) use ($bookmarkedIds, $ratingStatsByArticle, $commentCounts) {
                $articleId = (int) $article->id;
                $ratingStats = $ratingStatsByArticle->get($articleId);

                return [
                    'id' => $articleId,
                    'title' => $article->title,
                    'slug' => $article->slug,
                    'excerpt' => $article->excerpt,
                    'featured_image' => $article->featured_image,
                    'featured_image_alt' => $article->featured_image_alt,
                    'category_id' => $article->category_id ? (int) $article->category_id : null,
                    'category_name' => $article->category_name,
                    'author_name' => $article->author_name,
                    'views_count' => (int) ($article->views_count ?? 0),
                    'is_featured' => (bool) ($article->is_featured ?? false),
                    'published_at' => $article->published_at,
                    'date' => $article->published_at ?? $article->created_at,
                    'bookmarked' => $bookmarkedIds->has($articleId),
                    'ratings_total' => (int) ($ratingStats->ratings_total ?? 0),
                    'average_rating' => isset($ratingStats->average_rating) ? (float) $ratingStats->average_rating : 0,
                    'comments_total' => (int) ($commentCounts[$articleId] ?? 0),
                ];
            })
            ->values();

        $categoryOptions = DB::table('categories')
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(function ($category) {
                return [
                    'id' => (int) $category->id,
                    'name' => $category->name,
                ];
            })
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Berita publik berhasil dimuat.',
            'data' => [
                'articles' => $articles,
                'filters' => [
                    'q' => $search,
                    'category_id' => $categoryId > 0 ? $categoryId : null,
                    'featured' => $featuredOnly,
                    'category_options' => $categoryOptions,
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

    public function insights(Request $request): JsonResponse
    {
        $actor = $request->user();
        $trendingLimit = $this->normalizeInsightLimit((int) $request->query('trending_limit', 5));
        $picksLimit = $this->normalizeInsightLimit((int) $request->query('picks_limit', 4));

        $insightPayload = Cache::remember('reader.insights.global.v1', now()->addMinutes(5), function () {
            $baseLimit = 24;
            $articles = $this->loadPublishedArticlesForInsights();

            if ($articles->isEmpty()) {
                return [
                    'generated_at' => now()->toIso8601String(),
                    'published_articles_total' => 0,
                    'trending_articles' => [],
                    'editors_picks' => [],
                ];
            }

            $now = now();
            $rows = $articles
                ->map(function ($article) use ($now) {
                    $trendingScore = $this->computeTrendingScoreForInsight($article, $now);
                    $editorialScore = $this->computeEditorialScoreForInsight($article, $now);

                    return $this->mapInsightArticle($article, $trendingScore, $editorialScore);
                })
                ->values();

            $weekStartTimestamp = $now->copy()->subDays(7)->getTimestamp();
            $weeklyTrendingRows = $rows
                ->filter(function (array $row) use ($weekStartTimestamp) {
                    $referenceTime = $row['published_at'] ?? $row['date'] ?? null;
                    if (!$referenceTime) {
                        return false;
                    }

                    $timestamp = strtotime((string) $referenceTime);
                    if ($timestamp === false) {
                        return false;
                    }

                    return $timestamp >= $weekStartTimestamp;
                })
                ->values();

            if ($weeklyTrendingRows->isEmpty()) {
                $weeklyTrendingRows = $rows;
            }

            $trendingArticles = $weeklyTrendingRows
                ->sortByDesc('trending_score')
                ->take($baseLimit)
                ->values();

            $rankedEditorial = $rows
                ->sortByDesc('editorial_score')
                ->values();

            $editorsPicks = $this->pickEditorsCuratedArticles($rankedEditorial, $baseLimit);

            return [
                'generated_at' => now()->toIso8601String(),
                'published_articles_total' => $rows->count(),
                'trending_period_days' => 7,
                'trending_articles' => $trendingArticles->all(),
                'editors_picks' => $editorsPicks->all(),
            ];
        });

        $insightArticleIds = collect($insightPayload['trending_articles'] ?? [])
            ->pluck('id')
            ->merge(collect($insightPayload['editors_picks'] ?? [])->pluck('id'))
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        $bookmarkedIds = collect();
        if ($insightArticleIds !== [] && Schema::hasColumn('bookmarks', 'user_id')) {
            $bookmarkedIds = DB::table('bookmarks')
                ->where('user_id', (int) $actor->id)
                ->whereIn('article_id', $insightArticleIds)
                ->pluck('article_id')
                ->map(fn ($id) => (int) $id)
                ->flip();
        }

        $applyBookmarkState = function (array $rows) use ($bookmarkedIds) {
            return collect($rows)
                ->map(function ($row) use ($bookmarkedIds) {
                    $articleId = (int) ($row['id'] ?? 0);
                    $row['bookmarked'] = $bookmarkedIds->has($articleId);

                    return $row;
                })
                ->values()
                ->all();
        };

        $trendingArticles = $applyBookmarkState(array_slice($insightPayload['trending_articles'] ?? [], 0, $trendingLimit));
        $editorsPicks = $applyBookmarkState(array_slice($insightPayload['editors_picks'] ?? [], 0, $picksLimit));

        return response()->json([
            'status' => 'success',
            'message' => 'Insight berita global berhasil dimuat.',
            'data' => [
                'generated_at' => $insightPayload['generated_at'] ?? now()->toIso8601String(),
                'published_articles_total' => (int) ($insightPayload['published_articles_total'] ?? 0),
                'trending_period_days' => (int) ($insightPayload['trending_period_days'] ?? 7),
                'limits' => [
                    'trending' => $trendingLimit,
                    'editors_picks' => $picksLimit,
                ],
                'trending_articles' => $trendingArticles,
                'editors_picks' => $editorsPicks,
            ],
        ]);
    }

    public function show(Request $request, string $identifier): JsonResponse
    {
        $actor = $request->user();
        $article = $this->findPublishedArticle($identifier);

        if (!$article) {
            return response()->json([
                'status' => 'error',
                'message' => 'Berita tidak ditemukan.',
            ], 404);
        }

        $articleId = (int) $article->id;
        $userId = (int) $actor->id;
        $currentViewsCount = (int) ($article->views_count ?? 0);

        if (Schema::hasTable('article_views')) {
            $inserted = DB::table('article_views')->insertOrIgnore([
                'article_id' => $articleId,
                'user_id' => $userId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ((int) $inserted > 0) {
                DB::table('articles')->where('id', $articleId)->increment('views_count');
            }

            $currentViewsCount = (int) (DB::table('articles')->where('id', $articleId)->value('views_count') ?? $currentViewsCount);
        } else {
            DB::table('articles')->where('id', $articleId)->increment('views_count');
            $currentViewsCount += 1;
        }

        $ratingsSummary = DB::table('article_ratings')
            ->where('article_id', (int) $article->id)
            ->select([
                DB::raw('COUNT(*) as ratings_total'),
                DB::raw('ROUND(AVG(rating), 2) as average_rating'),
            ])
            ->first();

        $commentsTotal = DB::table('comments')
            ->where('article_id', (int) $article->id)
            ->where('status', 'approved')
            ->count();

        $currentUserRating = null;
        if (Schema::hasColumn('article_ratings', 'user_id')) {
            $currentUserRating = DB::table('article_ratings')
                ->where('article_id', (int) $article->id)
                ->where('user_id', (int) $actor->id)
                ->value('rating');
        }

        $isBookmarked = false;
        if (Schema::hasColumn('bookmarks', 'user_id')) {
            $isBookmarked = DB::table('bookmarks')
                ->where('article_id', (int) $article->id)
                ->where('user_id', (int) $actor->id)
                ->exists();
        }

        $tags = DB::table('article_tag as at')
            ->join('tags as t', 't.id', '=', 'at.tag_id')
            ->where('at.article_id', (int) $article->id)
            ->orderBy('t.name')
            ->get(['t.id', 't.name', 't.slug'])
            ->map(function ($tag) {
                return [
                    'id' => (int) $tag->id,
                    'name' => $tag->name,
                    'slug' => $tag->slug,
                ];
            })
            ->values();

        $related = DB::table('articles as a')
            ->leftJoin('users as au', 'au.id', '=', 'a.author_id')
            ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
            ->where('a.status', 'published')
            ->where('a.id', '!=', (int) $article->id)
            ->when($article->category_id, function ($query) use ($article) {
                $query->where('a.category_id', (int) $article->category_id);
            })
            ->orderByDesc('a.published_at')
            ->limit(4)
            ->get([
                'a.id',
                'a.title',
                'a.slug',
                'a.excerpt',
                'a.featured_image',
                'a.published_at',
                DB::raw("COALESCE(c.name, '-') as category_name"),
                DB::raw("COALESCE(au.name, '-') as author_name"),
            ])
            ->map(function ($item) {
                return [
                    'id' => (int) $item->id,
                    'title' => $item->title,
                    'slug' => $item->slug,
                    'excerpt' => $item->excerpt,
                    'featured_image' => $item->featured_image,
                    'category_name' => $item->category_name,
                    'author_name' => $item->author_name,
                    'published_at' => $item->published_at,
                    'date' => $item->published_at,
                ];
            })
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Detail berita berhasil dimuat.',
            'data' => [
                'article' => [
                    'id' => $articleId,
                    'title' => $article->title,
                    'slug' => $article->slug,
                    'excerpt' => $article->excerpt,
                    'content' => $article->content,
                    'featured_image' => $article->featured_image,
                    'featured_image_alt' => $article->featured_image_alt,
                    'category_id' => $article->category_id ? (int) $article->category_id : null,
                    'category_name' => $article->category_name,
                    'author_name' => $article->author_name,
                    'published_at' => $article->published_at,
                    'date' => $article->published_at,
                    'views_count' => $currentViewsCount,
                    'bookmarked' => $isBookmarked,
                    'ratings_total' => (int) ($ratingsSummary->ratings_total ?? 0),
                    'average_rating' => isset($ratingsSummary->average_rating) ? (float) $ratingsSummary->average_rating : 0,
                    'comments_total' => (int) $commentsTotal,
                    'current_user_rating' => $currentUserRating ? (int) $currentUserRating : null,
                    'tags' => $tags,
                ],
                'related_articles' => $related,
            ],
        ]);
    }

    public function comments(Request $request, string $identifier): JsonResponse
    {
        $actor = $request->user();
        $article = $this->findPublishedArticle($identifier);

        if (!$article) {
            return response()->json([
                'status' => 'error',
                'message' => 'Berita tidak ditemukan.',
            ], 404);
        }

        $perPage = (int) $request->query('per_page', 12);
        $perPage = max(1, min($perPage, 30));

        $query = DB::table('comments as c')
            ->leftJoin('users as u', 'u.id', '=', 'c.user_id')
            ->leftJoin('readers as r', 'r.id', '=', 'c.reader_id')
            ->where('c.article_id', (int) $article->id)
            ->where(function ($subQuery) use ($actor) {
                $subQuery
                    ->where('c.status', 'approved')
                    ->orWhere(function ($innerQuery) use ($actor) {
                        if (Schema::hasColumn('comments', 'user_id')) {
                            $innerQuery
                                ->where('c.user_id', (int) $actor->id)
                                ->whereIn('c.status', ['pending', 'approved']);
                            return;
                        }

                        $innerQuery->whereRaw('1 = 0');
                    });
            })
            ->select([
                'c.id',
                'c.parent_id',
                'c.content',
                'c.status',
                'c.created_at',
                'c.updated_at',
                DB::raw("COALESCE(u.name, r.name, 'Pembaca') as commenter_name"),
            ]);

        $paginator = $query
            ->orderByDesc('c.created_at')
            ->paginate($perPage)
            ->withQueryString();

        $comments = collect($paginator->items())
            ->map(function ($comment) {
                return [
                    'id' => (int) $comment->id,
                    'parent_id' => $comment->parent_id ? (int) $comment->parent_id : null,
                    'content' => $comment->content,
                    'status' => $comment->status,
                    'commenter_name' => $comment->commenter_name,
                    'created_at' => $comment->created_at,
                    'updated_at' => $comment->updated_at,
                    'is_pending' => (string) $comment->status === 'pending',
                ];
            })
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Komentar berhasil dimuat.',
            'data' => [
                'comments' => $comments,
                'pagination' => [
                    'total' => $paginator->total(),
                    'per_page' => $paginator->perPage(),
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                ],
            ],
        ]);
    }

    public function storeComment(Request $request, string $identifier): JsonResponse
    {
        $article = $this->findPublishedArticle($identifier);

        if (!$article) {
            return response()->json([
                'status' => 'error',
                'message' => 'Berita tidak ditemukan.',
            ], 404);
        }

        if (!Schema::hasColumn('comments', 'user_id')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Skema komentar belum siap. Jalankan migrasi terbaru.',
            ], 422);
        }

        $validated = $request->validate([
            'content' => ['required', 'string', 'min:2', 'max:1000'],
            'parent_id' => ['nullable', 'integer', 'exists:comments,id'],
        ]);

        if (!empty($validated['parent_id'])) {
            $isParentValid = DB::table('comments')
                ->where('id', (int) $validated['parent_id'])
                ->where('article_id', (int) $article->id)
                ->exists();

            if (!$isParentValid) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Komentar induk tidak valid untuk berita ini.',
                ], 422);
            }
        }

        $legacyReaderId = $this->resolveLegacyReaderId((int) $request->user()->id);
        if (!$legacyReaderId) {
            return response()->json([
                'status' => 'error',
                'message' => 'Profil pembaca tidak valid untuk mengirim komentar.',
            ], 422);
        }

        $commentId = DB::table('comments')->insertGetId([
            'article_id' => (int) $article->id,
            'user_id' => (int) $request->user()->id,
            'reader_id' => $legacyReaderId,
            'parent_id' => $validated['parent_id'] ?? null,
            'content' => trim((string) $validated['content']),
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $comment = DB::table('comments')
            ->where('id', $commentId)
            ->first(['id', 'content', 'status', 'created_at', 'updated_at']);

        return response()->json([
            'status' => 'success',
            'message' => 'Komentar berhasil dikirim dan menunggu moderasi.',
            'data' => [
                'comment' => [
                    'id' => (int) $comment->id,
                    'content' => $comment->content,
                    'status' => $comment->status,
                    'commenter_name' => $request->user()->name,
                    'created_at' => $comment->created_at,
                    'updated_at' => $comment->updated_at,
                    'is_pending' => true,
                ],
            ],
        ], 201);
    }

    public function toggleLike(Request $request, string $identifier): JsonResponse
    {
        $article = $this->findPublishedArticle($identifier);

        if (!$article) {
            return response()->json([
                'status' => 'error',
                'message' => 'Berita tidak ditemukan.',
            ], 404);
        }

        if (!Schema::hasColumn('likes', 'user_id')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Skema like belum siap. Jalankan migrasi terbaru.',
            ], 422);
        }

        $userId = (int) $request->user()->id;
        $legacyReaderId = $this->resolveLegacyReaderId($userId);

        if (!$legacyReaderId) {
            return response()->json([
                'status' => 'error',
                'message' => 'Profil pembaca tidak valid untuk memberi suka.',
            ], 422);
        }

        $existing = DB::table('likes')
            ->where('article_id', (int) $article->id)
            ->where(function ($query) use ($userId, $legacyReaderId) {
                $query
                    ->where('user_id', $userId)
                    ->orWhere('reader_id', $legacyReaderId);
            })
            ->first(['id']);

        $liked = false;
        if ($existing) {
            DB::table('likes')->where('id', (int) $existing->id)->delete();
            $liked = false;
        } else {
            DB::table('likes')->insert([
                'article_id' => (int) $article->id,
                'user_id' => $userId,
                'reader_id' => $legacyReaderId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $liked = true;
        }

        $likesTotal = DB::table('likes')
            ->where('article_id', (int) $article->id)
            ->count();

        return response()->json([
            'status' => 'success',
            'message' => $liked ? 'Berita berhasil disukai.' : 'Suka berita dibatalkan.',
            'data' => [
                'liked' => $liked,
                'likes_total' => (int) $likesTotal,
            ],
        ]);
    }

    public function toggleBookmark(Request $request, string $identifier): JsonResponse
    {
        $article = $this->findPublishedArticle($identifier);

        if (!$article) {
            return response()->json([
                'status' => 'error',
                'message' => 'Berita tidak ditemukan.',
            ], 404);
        }

        if (!Schema::hasColumn('bookmarks', 'user_id')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Skema bookmark belum siap. Jalankan migrasi terbaru.',
            ], 422);
        }

        $userId = (int) $request->user()->id;
        $legacyReaderId = $this->resolveLegacyReaderId($userId);

        if (!$legacyReaderId) {
            return response()->json([
                'status' => 'error',
                'message' => 'Profil pembaca tidak valid untuk bookmark.',
            ], 422);
        }

        $existing = DB::table('bookmarks')
            ->where('article_id', (int) $article->id)
            ->where(function ($query) use ($userId, $legacyReaderId) {
                $query
                    ->where('user_id', $userId)
                    ->orWhere('reader_id', $legacyReaderId);
            })
            ->first(['id']);

        $bookmarked = false;
        if ($existing) {
            DB::table('bookmarks')->where('id', (int) $existing->id)->delete();
            $bookmarked = false;
        } else {
            DB::table('bookmarks')->insert([
                'article_id' => (int) $article->id,
                'user_id' => $userId,
                'reader_id' => $legacyReaderId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $bookmarked = true;
        }

        return response()->json([
            'status' => 'success',
            'message' => $bookmarked ? 'Berita berhasil disimpan.' : 'Simpanan berita dibatalkan.',
            'data' => [
                'bookmarked' => $bookmarked,
            ],
        ]);
    }

    public function bookmarks(Request $request): JsonResponse
    {
        if (!Schema::hasColumn('bookmarks', 'user_id')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Skema bookmark belum siap. Jalankan migrasi terbaru.',
            ], 422);
        }

        $userId = (int) $request->user()->id;
        $search = trim((string) $request->query('q', ''));
        $categoryId = max(0, (int) $request->query('category_id', 0));

        $perPage = (int) $request->query('per_page', 12);
        $perPage = max(1, min($perPage, 30));

        $query = DB::table('bookmarks as b')
            ->join('articles as a', 'a.id', '=', 'b.article_id')
            ->leftJoin('users as au', 'au.id', '=', 'a.author_id')
            ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
            ->where('b.user_id', $userId)
            ->where('a.status', 'published')
            ->select([
                'b.id as bookmark_id',
                'b.created_at as bookmarked_at',
                'a.id',
                'a.title',
                'a.slug',
                'a.excerpt',
                'a.featured_image',
                'a.featured_image_alt',
                'a.category_id',
                'a.published_at',
                DB::raw("COALESCE(c.name, '-') as category_name"),
                DB::raw("COALESCE(au.name, '-') as author_name"),
            ]);

        if ($search !== '') {
            $query->where(function ($subQuery) use ($search) {
                $subQuery
                    ->where('a.title', 'like', "%{$search}%")
                    ->orWhere('a.excerpt', 'like', "%{$search}%")
                    ->orWhere('c.name', 'like', "%{$search}%");
            });
        }

        if ($categoryId > 0) {
            $query->where('a.category_id', $categoryId);
        }

        $paginator = $query
            ->orderByDesc('b.created_at')
            ->paginate($perPage)
            ->withQueryString();

        $bookmarks = collect($paginator->items())
            ->map(function ($item) {
                return [
                    'bookmark_id' => (int) $item->bookmark_id,
                    'bookmarked_at' => $item->bookmarked_at,
                    'article' => [
                        'id' => (int) $item->id,
                        'title' => $item->title,
                        'slug' => $item->slug,
                        'excerpt' => $item->excerpt,
                        'featured_image' => $item->featured_image,
                        'featured_image_alt' => $item->featured_image_alt,
                        'category_id' => $item->category_id ? (int) $item->category_id : null,
                        'author_name' => $item->author_name,
                        'category_name' => $item->category_name,
                        'published_at' => $item->published_at,
                        'date' => $item->published_at,
                        'bookmarked' => true,
                    ],
                ];
            })
            ->values();

        $categoryOptions = DB::table('bookmarks as b')
            ->join('articles as a', 'a.id', '=', 'b.article_id')
            ->join('categories as c', 'c.id', '=', 'a.category_id')
            ->where('b.user_id', $userId)
            ->where('a.status', 'published')
            ->where('c.is_active', true)
            ->select(['c.id', 'c.name'])
            ->distinct()
            ->orderBy('c.name')
            ->get()
            ->map(function ($category) {
                return [
                    'id' => (int) $category->id,
                    'name' => $category->name,
                ];
            })
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Daftar berita tersimpan berhasil dimuat.',
            'data' => [
                'bookmarks' => $bookmarks,
                'filters' => [
                    'q' => $search,
                    'category_id' => $categoryId > 0 ? $categoryId : null,
                    'category_options' => $categoryOptions,
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

    public function rate(Request $request, string $identifier): JsonResponse
    {
        $article = $this->findPublishedArticle($identifier);

        if (!$article) {
            return response()->json([
                'status' => 'error',
                'message' => 'Berita tidak ditemukan.',
            ], 404);
        }

        if (!Schema::hasColumn('article_ratings', 'user_id')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Skema rating belum siap. Jalankan migrasi terbaru.',
            ], 422);
        }

        $validated = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
        ]);

        $userId = (int) $request->user()->id;
        $legacyReaderId = $this->resolveLegacyReaderId($userId);

        if (!$legacyReaderId) {
            return response()->json([
                'status' => 'error',
                'message' => 'Profil pembaca tidak valid untuk memberi rating.',
            ], 422);
        }

        $existingRating = DB::table('article_ratings')
            ->where('article_id', (int) $article->id)
            ->where(function ($query) use ($userId, $legacyReaderId) {
                $query
                    ->where('user_id', $userId)
                    ->orWhere('reader_id', $legacyReaderId);
            })
            ->first(['id']);

        if ($existingRating) {
            DB::table('article_ratings')
                ->where('id', (int) $existingRating->id)
                ->update([
                    'user_id' => $userId,
                    'reader_id' => $legacyReaderId,
                    'rating' => (int) $validated['rating'],
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('article_ratings')->insert([
                'article_id' => (int) $article->id,
                'user_id' => $userId,
                'reader_id' => $legacyReaderId,
                'rating' => (int) $validated['rating'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $ratingsSummary = DB::table('article_ratings')
            ->where('article_id', (int) $article->id)
            ->select([
                DB::raw('COUNT(*) as ratings_total'),
                DB::raw('ROUND(AVG(rating), 2) as average_rating'),
            ])
            ->first();

        return response()->json([
            'status' => 'success',
            'message' => 'Rating berhasil disimpan.',
            'data' => [
                'current_user_rating' => (int) $validated['rating'],
                'ratings_total' => (int) ($ratingsSummary->ratings_total ?? 0),
                'average_rating' => isset($ratingsSummary->average_rating) ? (float) $ratingsSummary->average_rating : 0,
            ],
        ]);
    }

    private function normalizeInsightLimit(int $value): int
    {
        return max(1, min($value, 12));
    }

    private function loadPublishedArticlesForInsights()
    {
        $ratingStatsSubQuery = DB::table('article_ratings')
            ->select([
                'article_id',
                DB::raw('COUNT(*) as ratings_total'),
                DB::raw('ROUND(AVG(rating), 2) as average_rating'),
            ])
            ->groupBy('article_id');

        $commentStatsSubQuery = DB::table('comments')
            ->where('status', 'approved')
            ->select([
                'article_id',
                DB::raw('COUNT(*) as comments_total'),
            ])
            ->groupBy('article_id');

        return DB::table('articles as a')
            ->leftJoin('users as au', 'au.id', '=', 'a.author_id')
            ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
            ->leftJoinSub($ratingStatsSubQuery, 'rs', function ($join) {
                $join->on('rs.article_id', '=', 'a.id');
            })
            ->leftJoinSub($commentStatsSubQuery, 'cs', function ($join) {
                $join->on('cs.article_id', '=', 'a.id');
            })
            ->where('a.status', 'published')
            ->select([
                'a.id',
                'a.title',
                'a.slug',
                'a.excerpt',
                'a.featured_image',
                'a.featured_image_alt',
                'a.category_id',
                'a.views_count',
                'a.is_featured',
                'a.published_at',
                'a.created_at',
                DB::raw("COALESCE(c.name, '-') as category_name"),
                DB::raw("COALESCE(au.name, '-') as author_name"),
                DB::raw('COALESCE(rs.ratings_total, 0) as ratings_total'),
                DB::raw('COALESCE(rs.average_rating, 0) as average_rating'),
                DB::raw('COALESCE(cs.comments_total, 0) as comments_total'),
            ])
            ->orderByDesc('a.published_at')
            ->orderByDesc('a.created_at')
            ->get();
    }

    private function computeInsightHoursAgo($article, $now): float
    {
        $referenceTime = $article->published_at ?: $article->created_at;
        if (!$referenceTime) {
            return 240.0;
        }

        $timestamp = strtotime((string) $referenceTime);
        if ($timestamp === false) {
            return 240.0;
        }

        $secondsAgo = max(0, (int) $now->getTimestamp() - (int) $timestamp);

        return $secondsAgo / 3600;
    }

    private function estimateReadMinutesFromInsight($article): int
    {
        $source = trim(($article->title ?? '') . ' ' . ($article->excerpt ?? ''));
        if ($source === '') {
            return 1;
        }

        $words = preg_split('/\s+/', $source, -1, PREG_SPLIT_NO_EMPTY);

        return max(1, (int) ceil(count($words) / 180));
    }

    private function computeTrendingScoreForInsight($article, $now): float
    {
        $views = max(0, (int) ($article->views_count ?? 0));
        $comments = max(0, (int) ($article->comments_total ?? 0));
        $averageRating = max(0, (float) ($article->average_rating ?? 0));
        $ratingsTotal = max(0, (int) ($article->ratings_total ?? 0));
        $isFeatured = (bool) ($article->is_featured ?? false) ? 1 : 0;

        $hoursAgo = $this->computeInsightHoursAgo($article, $now);
        $freshnessFactor = max(0.35, 1.3 - ($hoursAgo / 168));

        $score = (
            (log10($views + 10) * 3.2)
            + ($comments * 1.4)
            + ($averageRating * 2.2)
            + (log10($ratingsTotal + 2) * 2.0)
            + ($isFeatured * 1.2)
        ) * $freshnessFactor;

        return round($score, 4);
    }

    private function computeEditorialScoreForInsight($article, $now): float
    {
        $views = max(0, (int) ($article->views_count ?? 0));
        $comments = max(0, (int) ($article->comments_total ?? 0));
        $averageRating = max(0, (float) ($article->average_rating ?? 0));
        $ratingsTotal = max(0, (int) ($article->ratings_total ?? 0));
        $isFeatured = (bool) ($article->is_featured ?? false) ? 1 : 0;
        $readMinutes = $this->estimateReadMinutesFromInsight($article);

        $hoursAgo = $this->computeInsightHoursAgo($article, $now);
        $stabilityFactor = max(0.5, 1.05 - ($hoursAgo / 720));

        $score = (
            ($averageRating * 2.8)
            + (log10($ratingsTotal + 2) * 2.6)
            + (log10($views + 20) * 1.8)
            + (log10($comments + 2) * 2.1)
            + ($isFeatured * 1.4)
            + (min(7, $readMinutes) * 0.18)
        ) * $stabilityFactor;

        return round($score, 4);
    }

    private function mapInsightArticle($article, float $trendingScore, float $editorialScore): array
    {
        $articleId = (int) $article->id;
        $dateValue = $article->published_at ?: $article->created_at;

        return [
            'id' => $articleId,
            'title' => $article->title,
            'slug' => $article->slug,
            'excerpt' => $article->excerpt,
            'featured_image' => $article->featured_image,
            'featured_image_alt' => $article->featured_image_alt,
            'category_id' => $article->category_id ? (int) $article->category_id : null,
            'category_name' => $article->category_name,
            'author_name' => $article->author_name,
            'views_count' => max(0, (int) ($article->views_count ?? 0)),
            'is_featured' => (bool) ($article->is_featured ?? false),
            'published_at' => $article->published_at,
            'date' => $dateValue,
            'ratings_total' => max(0, (int) ($article->ratings_total ?? 0)),
            'average_rating' => max(0, (float) ($article->average_rating ?? 0)),
            'comments_total' => max(0, (int) ($article->comments_total ?? 0)),
            'trending_score' => $trendingScore,
            'editorial_score' => $editorialScore,
            'bookmarked' => false,
        ];
    }

    private function pickEditorsCuratedArticles($rankedEditorial, int $limit)
    {
        $selected = collect();
        $usedCategoryNames = [];

        foreach ($rankedEditorial as $article) {
            $categoryName = strtolower(trim((string) ($article['category_name'] ?? '')));

            if ($categoryName === '' || !isset($usedCategoryNames[$categoryName])) {
                $selected->push($article);

                if ($categoryName !== '') {
                    $usedCategoryNames[$categoryName] = true;
                }
            }

            if ($selected->count() >= $limit) {
                break;
            }
        }

        if ($selected->count() < $limit) {
            foreach ($rankedEditorial as $article) {
                $articleId = (int) ($article['id'] ?? 0);
                $alreadySelected = $selected->contains(function ($row) use ($articleId) {
                    return (int) ($row['id'] ?? 0) === $articleId;
                });

                if ($alreadySelected) {
                    continue;
                }

                $selected->push($article);

                if ($selected->count() >= $limit) {
                    break;
                }
            }
        }

        return $selected->take($limit)->values();
    }

    private function findPublishedArticle(string $identifier): ?object
    {
        $query = DB::table('articles as a')
            ->leftJoin('users as au', 'au.id', '=', 'a.author_id')
            ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
            ->where('a.status', 'published')
            ->select([
                'a.id',
                'a.title',
                'a.slug',
                'a.excerpt',
                'a.content',
                'a.featured_image',
                'a.featured_image_alt',
                'a.category_id',
                'a.views_count',
                'a.published_at',
                DB::raw("COALESCE(c.name, '-') as category_name"),
                DB::raw("COALESCE(au.name, '-') as author_name"),
            ]);

        if (ctype_digit($identifier)) {
            $query->where('a.id', (int) $identifier);
        } else {
            $query->where('a.slug', $identifier);
        }

        return $query->first();
    }

    private function resolveLegacyReaderId(int $userId): ?int
    {
        if (!Schema::hasTable('readers')) {
            return null;
        }

        $user = DB::table('users')
            ->where('id', $userId)
            ->first(['name', 'email']);

        if (!$user || empty($user->email)) {
            return null;
        }

        $existingReaderId = DB::table('readers')
            ->where('email', (string) $user->email)
            ->value('id');

        if ($existingReaderId) {
            return (int) $existingReaderId;
        }

        return (int) DB::table('readers')->insertGetId([
            'name' => (string) ($user->name ?: 'Pembaca'),
            'email' => (string) $user->email,
            'email_verified_at' => now(),
            'password' => Hash::make(Str::random(40)),
            'avatar' => null,
            'status' => 'active',
            'remember_token' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
