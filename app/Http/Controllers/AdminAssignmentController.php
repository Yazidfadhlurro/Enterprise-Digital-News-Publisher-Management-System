<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\AssignmentLoadBalancer;
use App\Support\AuthorAssignmentLogger;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class AdminAssignmentController extends Controller
{
    private const REVIEW_PENDING_STATUSES = ['pending', 'approved'];

    public function matrix(): JsonResponse
    {
        $threshold = now()->subHours(48);

        $reviewers = User::query()
            ->where('role', 'reviewer')
            ->withCount([
                'assignedAuthors as assigned_authors_count',
                'assignedAuthors as active_authors_count' => function ($authorQuery) {
                    $authorQuery->where('status', 'active');
                },
            ])
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'status']);

        $authors = User::query()
            ->where('role', 'author')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'status', 'assigned_reviewer_id', 'created_at']);

        $articleStatsByAuthor = $this->loadArticleStatsByAuthor($authors->pluck('id')->all(), $threshold);

        $authorsByReviewer = $authors->groupBy(function (User $author) {
            return $author->assigned_reviewer_id ?: 'unassigned';
        });

        $reviewerRows = $reviewers
            ->map(function (User $reviewer) use ($authorsByReviewer, $articleStatsByAuthor) {
                $reviewerAuthors = collect($authorsByReviewer->get((int) $reviewer->id, collect()))
                    ->map(function (User $author) use ($articleStatsByAuthor) {
                        return $this->mapAuthorRow($author, $articleStatsByAuthor);
                    })
                    ->values();

                return [
                    'id' => (int) $reviewer->id,
                    'name' => $reviewer->name,
                    'email' => $reviewer->email,
                    'status' => $reviewer->status,
                    'assigned_authors_count' => (int) ($reviewer->assigned_authors_count ?? 0),
                    'active_authors_count' => (int) ($reviewer->active_authors_count ?? 0),
                    'pending_articles_total' => (int) $reviewerAuthors->sum('pending_articles_total'),
                    'overdue_pending_total' => (int) $reviewerAuthors->sum('overdue_pending_total'),
                    'sla_warning' => (int) $reviewerAuthors->sum('overdue_pending_total') > 0,
                    'authors' => $reviewerAuthors,
                ];
            })
            ->values();

        $unassignedAuthors = collect($authorsByReviewer->get('unassigned', collect()))
            ->map(function (User $author) use ($articleStatsByAuthor) {
                return $this->mapAuthorRow($author, $articleStatsByAuthor);
            })
            ->values();

        $recentLogs = $this->fetchRecentAssignmentLogs(18);

        return response()->json([
            'status' => 'success',
            'message' => 'Assignment matrix berhasil dimuat.',
            'data' => [
                'summary' => [
                    'reviewers_total' => $reviewers->count(),
                    'authors_total' => $authors->count(),
                    'unassigned_authors_total' => $unassignedAuthors->count(),
                    'overdue_pending_total' => (int) $reviewerRows->sum('overdue_pending_total'),
                ],
                'reviewers' => $reviewerRows,
                'unassigned_authors' => $unassignedAuthors,
                'recent_logs' => $recentLogs,
            ],
        ]);
    }

    public function moveAuthor(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'author_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where(function ($query) {
                    $query->where('role', 'author');
                }),
            ],
            'to_reviewer_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where(function ($query) {
                    $query
                        ->where('role', 'reviewer')
                        ->where('status', 'active');
                }),
            ],
        ]);

        $author = User::query()
            ->where('role', 'author')
            ->find((int) $validated['author_id']);

        if (!$author) {
            return response()->json([
                'status' => 'error',
                'message' => 'Author tidak ditemukan.',
            ], 404);
        }

        $targetReviewerId = (int) $validated['to_reviewer_id'];
        $fromReviewerId = $author->assigned_reviewer_id ? (int) $author->assigned_reviewer_id : null;

        if ($fromReviewerId === $targetReviewerId) {
            return response()->json([
                'status' => 'success',
                'message' => 'Author sudah berada di reviewer tersebut.',
                'data' => [
                    'author_id' => (int) $author->id,
                    'from_reviewer_id' => $fromReviewerId,
                    'to_reviewer_id' => $targetReviewerId,
                ],
            ]);
        }

        DB::transaction(function () use ($author, $fromReviewerId, $targetReviewerId, $request) {
            $author->update([
                'assigned_reviewer_id' => $targetReviewerId,
            ]);

            AuthorAssignmentLogger::log(
                (int) $author->id,
                $fromReviewerId,
                $targetReviewerId,
                $request->user() ? (int) $request->user()->id : null,
                AuthorAssignmentLogger::ACTION_MANUAL_MOVE
            );
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Assignment author berhasil dipindahkan.',
            'data' => [
                'author_id' => (int) $author->id,
                'from_reviewer_id' => $fromReviewerId,
                'to_reviewer_id' => $targetReviewerId,
            ],
        ]);
    }

    public function bulkMoveAuthors(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'author_ids' => ['required', 'array', 'min:1'],
            'author_ids.*' => ['integer'],
            'to_reviewer_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where(function ($query) {
                    $query
                        ->where('role', 'reviewer')
                        ->where('status', 'active');
                }),
            ],
        ]);

        $authorIds = collect($validated['author_ids'])
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $targetReviewerId = (int) $validated['to_reviewer_id'];

        $authors = User::query()
            ->where('role', 'author')
            ->whereIn('id', $authorIds)
            ->get(['id', 'assigned_reviewer_id']);

        $foundIds = $authors->pluck('id')->map(fn ($id) => (int) $id);
        $missingIds = $authorIds->diff($foundIds)->values();

        if ($missingIds->isNotEmpty()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Terdapat author yang tidak valid untuk bulk move.',
                'data' => [
                    'invalid_author_ids' => $missingIds,
                ],
            ], 422);
        }

        $movedCount = 0;

        DB::transaction(function () use ($authors, $targetReviewerId, $request, &$movedCount) {
            foreach ($authors as $author) {
                $fromReviewerId = $author->assigned_reviewer_id ? (int) $author->assigned_reviewer_id : null;

                if ($fromReviewerId === $targetReviewerId) {
                    continue;
                }

                User::query()
                    ->where('id', $author->id)
                    ->update([
                        'assigned_reviewer_id' => $targetReviewerId,
                        'updated_at' => now(),
                    ]);

                AuthorAssignmentLogger::log(
                    (int) $author->id,
                    $fromReviewerId,
                    $targetReviewerId,
                    $request->user() ? (int) $request->user()->id : null,
                    AuthorAssignmentLogger::ACTION_BULK_MOVE
                );

                $movedCount++;
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Bulk move assignment selesai diproses.',
            'data' => [
                'requested_count' => $authorIds->count(),
                'moved_count' => $movedCount,
                'target_reviewer_id' => $targetReviewerId,
            ],
        ]);
    }

    public function reassignInactiveReviewer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reviewer_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where(function ($query) {
                    $query->where('role', 'reviewer');
                }),
            ],
            'target_reviewer_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(function ($query) {
                    $query
                        ->where('role', 'reviewer')
                        ->where('status', 'active');
                }),
            ],
        ]);

        $sourceReviewer = User::query()
            ->where('role', 'reviewer')
            ->find((int) $validated['reviewer_id']);

        if (!$sourceReviewer) {
            return response()->json([
                'status' => 'error',
                'message' => 'Reviewer sumber tidak ditemukan.',
            ], 404);
        }

        if ($sourceReviewer->status === 'active') {
            return response()->json([
                'status' => 'error',
                'message' => 'Fitur ini hanya untuk reviewer nonaktif/suspended.',
            ], 422);
        }

        $targetReviewerId = isset($validated['target_reviewer_id'])
            ? (int) $validated['target_reviewer_id']
            : AssignmentLoadBalancer::leastLoadedActiveReviewerId((int) $sourceReviewer->id);

        if (!$targetReviewerId) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tidak ada reviewer aktif tujuan untuk reassign.',
            ], 422);
        }

        if ((int) $sourceReviewer->id === $targetReviewerId) {
            return response()->json([
                'status' => 'error',
                'message' => 'Reviewer sumber dan tujuan tidak boleh sama.',
            ], 422);
        }

        $authors = User::query()
            ->where('role', 'author')
            ->where('assigned_reviewer_id', (int) $sourceReviewer->id)
            ->get(['id', 'assigned_reviewer_id']);

        if ($authors->isEmpty()) {
            return response()->json([
                'status' => 'success',
                'message' => 'Tidak ada author yang perlu dipindahkan.',
                'data' => [
                    'source_reviewer_id' => (int) $sourceReviewer->id,
                    'target_reviewer_id' => $targetReviewerId,
                    'moved_count' => 0,
                ],
            ]);
        }

        $movedCount = 0;

        DB::transaction(function () use ($authors, $sourceReviewer, $targetReviewerId, $request, &$movedCount) {
            foreach ($authors as $author) {
                User::query()
                    ->where('id', $author->id)
                    ->update([
                        'assigned_reviewer_id' => $targetReviewerId,
                        'updated_at' => now(),
                    ]);

                AuthorAssignmentLogger::log(
                    (int) $author->id,
                    (int) $sourceReviewer->id,
                    $targetReviewerId,
                    $request->user() ? (int) $request->user()->id : null,
                    AuthorAssignmentLogger::ACTION_REASSIGN_INACTIVE,
                    'Mass reassign dari reviewer nonaktif.'
                );

                $movedCount++;
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Author dari reviewer nonaktif berhasil direassign.',
            'data' => [
                'source_reviewer_id' => (int) $sourceReviewer->id,
                'target_reviewer_id' => $targetReviewerId,
                'moved_count' => $movedCount,
            ],
        ]);
    }

    public function logs(Request $request): JsonResponse
    {
        $limit = max(5, min((int) $request->query('limit', 20), 100));

        return response()->json([
            'status' => 'success',
            'message' => 'Log assignment berhasil dimuat.',
            'data' => [
                'logs' => $this->fetchRecentAssignmentLogs($limit),
            ],
        ]);
    }

    private function loadArticleStatsByAuthor(array $authorIds, Carbon $threshold)
    {
        if ($authorIds === []) {
            return collect();
        }

        return DB::table('articles')
            ->whereIn('author_id', $authorIds)
            ->select('author_id')
            ->selectRaw(
                "SUM(CASE WHEN status IN ('pending', 'approved') THEN 1 ELSE 0 END) as pending_total"
            )
            ->selectRaw(
                "SUM(CASE WHEN status IN ('pending', 'approved') AND created_at <= ? THEN 1 ELSE 0 END) as overdue_pending_total",
                [$threshold->toDateTimeString()]
            )
            ->selectRaw(
                "MIN(CASE WHEN status IN ('pending', 'approved') THEN created_at ELSE NULL END) as oldest_pending_at"
            )
            ->groupBy('author_id')
            ->get()
            ->keyBy('author_id');
    }

    private function mapAuthorRow(User $author, $articleStatsByAuthor): array
    {
        $stats = $articleStatsByAuthor->get((int) $author->id);
        $oldestPendingAt = $stats?->oldest_pending_at;
        $oldestPendingHours = null;

        if ($oldestPendingAt) {
            $oldestPendingHours = Carbon::parse($oldestPendingAt)->diffInHours(now());
        }

        return [
            'id' => (int) $author->id,
            'name' => $author->name,
            'email' => $author->email,
            'status' => $author->status,
            'assigned_reviewer_id' => $author->assigned_reviewer_id ? (int) $author->assigned_reviewer_id : null,
            'pending_articles_total' => (int) ($stats?->pending_total ?? 0),
            'overdue_pending_total' => (int) ($stats?->overdue_pending_total ?? 0),
            'oldest_pending_at' => $oldestPendingAt,
            'oldest_pending_hours' => $oldestPendingHours,
            'created_at' => $author->created_at,
        ];
    }

    private function fetchRecentAssignmentLogs(int $limit): array
    {
        if (!Schema::hasTable('author_assignment_activities')) {
            return [];
        }

        return DB::table('author_assignment_activities as aa')
            ->leftJoin('users as author', 'author.id', '=', 'aa.author_id')
            ->leftJoin('users as from_reviewer', 'from_reviewer.id', '=', 'aa.from_reviewer_id')
            ->leftJoin('users as to_reviewer', 'to_reviewer.id', '=', 'aa.to_reviewer_id')
            ->leftJoin('users as actor', 'actor.id', '=', 'aa.changed_by_user_id')
            ->orderByDesc('aa.occurred_at')
            ->orderByDesc('aa.id')
            ->limit($limit)
            ->get([
                'aa.id',
                'aa.action',
                'aa.note',
                'aa.metadata',
                'aa.occurred_at',
                DB::raw("COALESCE(author.name, '-') as author_name"),
                DB::raw("COALESCE(from_reviewer.name, '-') as from_reviewer_name"),
                DB::raw("COALESCE(to_reviewer.name, '-') as to_reviewer_name"),
                DB::raw("COALESCE(actor.name, 'Sistem') as actor_name"),
            ])
            ->map(function ($row) {
                return [
                    'id' => (int) $row->id,
                    'action' => $row->action,
                    'action_label' => AuthorAssignmentLogger::actionLabel((string) $row->action),
                    'author_name' => $row->author_name,
                    'from_reviewer_name' => $row->from_reviewer_name,
                    'to_reviewer_name' => $row->to_reviewer_name,
                    'actor_name' => $row->actor_name,
                    'note' => $row->note,
                    'metadata' => $row->metadata ? json_decode($row->metadata, true) : null,
                    'occurred_at' => $row->occurred_at,
                    'time' => $row->occurred_at ? Carbon::parse($row->occurred_at)->diffForHumans() : '-',
                ];
            })
            ->values()
            ->all();
    }
}
