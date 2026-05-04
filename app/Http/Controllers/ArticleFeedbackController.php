<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ArticleFeedbackController extends Controller
{
    public function adminIndex(Request $request): JsonResponse
    {
        return $this->indexByScope($request, 'admin');
    }

    public function reviewerIndex(Request $request): JsonResponse
    {
        return $this->indexByScope($request, 'reviewer');
    }

    public function authorIndex(Request $request): JsonResponse
    {
        return $this->indexByScope($request, 'author');
    }

    private function indexByScope(Request $request, string $scope): JsonResponse
    {
        $actor = $request->user();
        $search = trim((string) $request->query('q', ''));
        $selectedArticleId = max(0, (int) $request->query('article_id', 0));
        $selectedCategoryId = max(0, (int) $request->query('category_id', 0));
        $hasCommentsTable = Schema::hasTable('comments');
        $hasCommentUserColumn = $hasCommentsTable && Schema::hasColumn('comments', 'user_id');
        $hasRatingsTable = Schema::hasTable('article_ratings');
        $hasCategoriesTable = Schema::hasTable('categories');

        $page = max(1, (int) $request->query('page', 1));
        $perPage = (int) $request->query('per_page', 10);
        $perPage = max(1, min($perPage, 50));

        $optionQuery = DB::table('articles as a')
            ->leftJoin('users as au', 'au.id', '=', 'a.author_id');

        if ($hasCategoriesTable) {
            $optionQuery->leftJoin('categories as ca', 'ca.id', '=', 'a.category_id');
        }

        $this->applyScope($optionQuery, $scope, $actor);
        $this->applyFeedbackVisibilityFilter($optionQuery, $hasCommentsTable, $hasRatingsTable);

        $categoryOptions = collect();
        if ($hasCategoriesTable) {
            $categoryOptions = (clone $optionQuery)
                ->whereNotNull('a.category_id')
                ->select([
                    'a.category_id',
                    DB::raw("COALESCE(ca.name, '-') as category_name"),
                    DB::raw('COUNT(DISTINCT a.id) as articles_total'),
                ])
                ->groupBy('a.category_id', 'ca.name')
                ->orderBy('category_name')
                ->get()
                ->map(function ($row) {
                    return [
                        'id' => (int) $row->category_id,
                        'name' => $row->category_name,
                        'articles_total' => (int) ($row->articles_total ?? 0),
                    ];
                })
                ->values();
        }

        if ($selectedCategoryId > 0) {
            $optionQuery->where('a.category_id', $selectedCategoryId);
        }

        $articleOptions = (clone $optionQuery)
            ->orderByDesc('a.updated_at')
            ->limit(120)
            ->get([
                'a.id',
                'a.title',
                DB::raw("COALESCE(au.name, '-') as author_name"),
            ])
            ->map(function ($row) {
                return [
                    'id' => (int) $row->id,
                    'title' => $row->title,
                    'author_name' => $row->author_name,
                ];
            })
            ->values();

        $query = DB::table('articles as a')
            ->leftJoin('users as au', 'au.id', '=', 'a.author_id');

        if ($hasCategoriesTable) {
            $query->leftJoin('categories as ca', 'ca.id', '=', 'a.category_id');
        }

        $this->applyScope($query, $scope, $actor);
        $this->applyFeedbackVisibilityFilter($query, $hasCommentsTable, $hasRatingsTable);

        if ($search !== '') {
            $query->where(function ($subQuery) use ($search) {
                $subQuery
                    ->where('a.title', 'like', "%{$search}%")
                    ->orWhere('au.name', 'like', "%{$search}%");
            });
        }

        if ($selectedArticleId > 0) {
            $query->where('a.id', $selectedArticleId);
        }

        if ($selectedCategoryId > 0) {
            $query->where('a.category_id', $selectedCategoryId);
        }

        $total = (clone $query)->count('a.id');
        $lastPage = (int) ceil($total / $perPage);
        $offset = ($page - 1) * $perPage;

        $articles = $query
            ->orderByDesc('a.updated_at')
            ->offset($offset)
            ->limit($perPage)
            ->get([
                'a.id',
                'a.title',
                'a.category_id',
                'a.status',
                'a.updated_at',
                DB::raw("COALESCE(au.name, '-') as author_name"),
                DB::raw($hasCategoriesTable ? "COALESCE(ca.name, '-') as category_name" : "'-' as category_name"),
            ]);

        $articleIds = collect($articles)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        if ($articleIds === []) {
            return response()->json([
                'status' => 'success',
                'message' => $this->scopeMessage($scope),
                'data' => [
                    'feedback' => [],
                    'pagination' => [
                        'total' => 0,
                        'per_page' => $perPage,
                        'current_page' => $page,
                        'last_page' => 1,
                    ],
                    'summary' => [
                        'articles_with_feedback' => 0,
                        'comments_total' => 0,
                        'ratings_total' => 0,
                        'average_rating' => 0,
                        'low_rating_articles' => 0,
                    ],
                    'filters' => [
                        'article_id' => $selectedArticleId > 0 ? $selectedArticleId : null,
                        'category_id' => $selectedCategoryId > 0 ? $selectedCategoryId : null,
                        'article_options' => $articleOptions,
                        'category_options' => $categoryOptions,
                    ],
                ],
            ]);
        }

        $ratingsByArticle = collect();
        if ($hasRatingsTable) {
            $ratingsByArticle = DB::table('article_ratings')
                ->whereIn('article_id', $articleIds)
                ->select(
                    'article_id',
                    DB::raw('COUNT(*) as ratings_total'),
                    DB::raw('ROUND(AVG(rating), 2) as average_rating')
                )
                ->groupBy('article_id')
                ->get()
                ->keyBy('article_id');
        }

        $commentsCountByArticle = collect();
        $latestCommentByArticle = collect();

        if ($hasCommentsTable) {
            $commenterNameExpression = $hasCommentUserColumn
                ? "COALESCE(ur.name, r.name, 'Pembaca')"
                : "COALESCE(r.name, 'Pembaca')";

            $commentsCountByArticle = DB::table('comments')
                ->whereIn('article_id', $articleIds)
                ->whereIn('status', ['pending', 'approved'])
                ->select('article_id', DB::raw('COUNT(*) as comments_total'))
                ->groupBy('article_id')
                ->pluck('comments_total', 'article_id');

            $latestCommentByArticle = DB::table('comments as c')
                ->when($hasCommentUserColumn, function ($query) {
                    $query->leftJoin('users as ur', 'ur.id', '=', 'c.user_id');
                })
                ->leftJoin('readers as r', 'r.id', '=', 'c.reader_id')
                ->whereIn('c.article_id', $articleIds)
                ->whereIn('c.status', ['pending', 'approved'])
                ->orderByDesc('c.created_at')
                ->get([
                    'c.article_id',
                    'c.content',
                    'c.status',
                    'c.created_at',
                    DB::raw("{$commenterNameExpression} as reader_name"),
                ])
                ->unique('article_id')
                ->keyBy('article_id');
        }

        $feedbackRows = collect($articles)
            ->map(function ($article) use ($ratingsByArticle, $commentsCountByArticle, $latestCommentByArticle) {
                $articleId = (int) $article->id;
                $rating = $ratingsByArticle->get($articleId);
                $latestComment = $latestCommentByArticle->get($articleId);

                return [
                    'article_id' => $articleId,
                    'title' => $article->title,
                    'category_id' => $article->category_id ? (int) $article->category_id : null,
                    'category_name' => $article->category_name,
                    'author_name' => $article->author_name,
                    'status' => $article->status,
                    'status_label' => $this->statusLabel((string) $article->status),
                    'ratings_total' => (int) ($rating->ratings_total ?? 0),
                    'average_rating' => isset($rating->average_rating) ? (float) $rating->average_rating : 0.0,
                    'comments_total' => (int) ($commentsCountByArticle[$articleId] ?? 0),
                    'latest_comment' => $latestComment ? $latestComment->content : null,
                    'latest_comment_status' => $latestComment ? $latestComment->status : null,
                    'latest_commenter_name' => $latestComment ? $latestComment->reader_name : null,
                    'latest_comment_at' => $latestComment ? $latestComment->created_at : null,
                    'updated_at' => $article->updated_at,
                ];
            })
            ->values();

        $ratedRows = $feedbackRows->filter(fn ($row) => (int) ($row['ratings_total'] ?? 0) > 0);
        $weightedRatingTotal = (float) $feedbackRows
            ->sum(fn ($row) => ((float) ($row['average_rating'] ?? 0)) * ((int) ($row['ratings_total'] ?? 0)));
        $ratingsTotal = (int) $feedbackRows->sum(fn ($row) => (int) ($row['ratings_total'] ?? 0));

        $summary = [
            'articles_with_feedback' => (int) $feedbackRows
                ->filter(fn ($row) => (int) ($row['comments_total'] ?? 0) > 0 || (int) ($row['ratings_total'] ?? 0) > 0)
                ->count(),
            'comments_total' => (int) $feedbackRows->sum(fn ($row) => (int) ($row['comments_total'] ?? 0)),
            'ratings_total' => $ratingsTotal,
            'average_rating' => $ratingsTotal > 0 ? round($weightedRatingTotal / $ratingsTotal, 2) : 0,
            'low_rating_articles' => (int) $ratedRows
                ->filter(fn ($row) => (float) ($row['average_rating'] ?? 0) > 0 && (float) ($row['average_rating'] ?? 0) <= 3.0)
                ->count(),
        ];

        return response()->json([
            'status' => 'success',
            'message' => $this->scopeMessage($scope),
            'data' => [
                'feedback' => $feedbackRows,
                'pagination' => [
                    'total' => $total,
                    'per_page' => $perPage,
                    'current_page' => $page,
                    'last_page' => max(1, $lastPage),
                ],
                'summary' => $summary,
                'filters' => [
                    'article_id' => $selectedArticleId > 0 ? $selectedArticleId : null,
                    'category_id' => $selectedCategoryId > 0 ? $selectedCategoryId : null,
                    'article_options' => $articleOptions,
                    'category_options' => $categoryOptions,
                ],
            ],
        ]);
    }

    private function applyFeedbackVisibilityFilter($query, bool $hasCommentsTable, bool $hasRatingsTable): void
    {
        $query->where('a.status', '!=', 'draft');

        $query->where(function ($subQuery) use ($hasCommentsTable, $hasRatingsTable) {
            $subQuery->whereRaw('1 = 0');

            if ($hasCommentsTable) {
                $subQuery->orWhereExists(function ($existsQuery) {
                    $existsQuery
                        ->select(DB::raw(1))
                        ->from('comments as comments_filter')
                        ->whereColumn('comments_filter.article_id', 'a.id')
                        ->whereIn('comments_filter.status', ['pending', 'approved']);
                });
            }

            if ($hasRatingsTable) {
                $subQuery->orWhereExists(function ($existsQuery) {
                    $existsQuery
                        ->select(DB::raw(1))
                        ->from('article_ratings as ratings_filter')
                        ->whereColumn('ratings_filter.article_id', 'a.id');
                });
            }
        });
    }

    private function applyScope($query, string $scope, $actor): void
    {
        if ($scope === 'author') {
            $query->where('a.author_id', (int) $actor->id);
            return;
        }

        if ($scope !== 'reviewer') {
            return;
        }

        if (!$actor || !isset($actor->role) || (string) $actor->role !== 'reviewer') {
            return;
        }

        $reviewerId = (int) $actor->id;

        $query->whereExists(function ($subQuery) use ($reviewerId) {
            $subQuery
                ->select(DB::raw(1))
                ->from('users as author_assignment')
                ->whereColumn('author_assignment.id', 'a.author_id')
                ->where('author_assignment.assigned_reviewer_id', $reviewerId);
        });
    }

    private function scopeMessage(string $scope): string
    {
        return match ($scope) {
            'author' => 'Komentar dan rating artikel penulis berhasil dimuat.',
            'reviewer' => 'Komentar dan rating artikel assignment editor berhasil dimuat.',
            default => 'Komentar dan rating artikel berhasil dimuat.',
        };
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            'pending', 'approved' => 'Review',
            'revision' => 'Revisi',
            'published' => 'Publikasi',
            'rejected' => 'Ditolak',
            default => 'Draft',
        };
    }
}
