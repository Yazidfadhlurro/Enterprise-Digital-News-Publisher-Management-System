<?php

namespace App\Http\Controllers;

use Illuminate\Support\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AdminDashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $totalArticles = DB::table('articles')->count();
        $totalPublished = DB::table('articles')->where('status', 'published')->count();
        $pendingReview = DB::table('articles')
            ->whereIn('status', ['pending', 'approved'])
            ->count();
        $totalUsers = DB::table('users')->count();

        $rawArticleStatus = DB::table('articles')
            ->select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->get();

        // Sinkronkan statistik dengan workflow jurnal: Draft -> Review -> Revisi -> Published.
        $workflowBuckets = [
            'draft' => 0,
            'pending' => 0,
            'revision' => 0,
            'published' => 0,
        ];

        foreach ($rawArticleStatus as $row) {
            $normalizedStatus = match ($row->status) {
                'draft' => 'draft',
                'pending', 'approved' => 'pending',
                'revision', 'rejected' => 'revision',
                'published' => 'published',
                default => null,
            };

            if (!$normalizedStatus) {
                continue;
            }

            $workflowBuckets[$normalizedStatus] += (int) $row->total;
        }

        $articleStatus = collect($workflowBuckets)
            ->map(function (int $total, string $status) {
                return [
                    'status' => $status,
                    'total' => $total,
                ];
            })
            ->values();

        $latestArticles = DB::table('articles as a')
            ->leftJoin('users as u', 'u.id', '=', 'a.author_id')
            ->select(
                'a.id',
                'a.title',
                'a.status',
                'a.created_at',
                'a.published_at',
                DB::raw("COALESCE(u.name, '-') as author_name")
            )
            ->orderByDesc('a.created_at')
            ->limit(5)
            ->get()
            ->map(function ($article) {
                return [
                    'id' => (int) $article->id,
                    'title' => $article->title,
                    'author_name' => $article->author_name,
                    'status' => $article->status,
                    'date' => $article->published_at ?? $article->created_at,
                ];
            })
            ->values();

        $recentActivities = DB::table('articles as a')
            ->leftJoin('users as u', 'u.id', '=', 'a.author_id')
            ->select(
                'a.title',
                'a.status',
                'a.updated_at',
                DB::raw("COALESCE(u.name, 'Sistem') as actor_name")
            )
            ->orderByDesc('a.updated_at')
            ->limit(6)
            ->get()
            ->map(function ($activity) {
                $statusText = match ($activity->status) {
                    'draft' => 'menyimpan draft',
                    'pending' => 'mengirim artikel untuk review',
                    'revision' => 'mengirim revisi artikel',
                    'approved' => 'mendapat persetujuan',
                    'published' => 'mempublikasikan artikel',
                    'rejected' => 'menolak artikel',
                    default => 'memperbarui artikel',
                };

                return [
                    'message' => sprintf(
                        '%s %s "%s"',
                        $activity->actor_name,
                        $statusText,
                        $activity->title
                    ),
                    'time' => Carbon::parse($activity->updated_at)->diffForHumans(),
                ];
            })
            ->values();

        if ($recentActivities->isEmpty()) {
            $recentActivities = collect([
                [
                    'message' => 'Belum ada aktivitas terbaru.',
                    'time' => 'baru saja',
                ],
            ]);
        }

        $overdueThreshold = now()->subHours(48);

        $reviewerSla = DB::table('users as reviewer')
            ->leftJoin('users as author', function ($join) {
                $join
                    ->on('author.assigned_reviewer_id', '=', 'reviewer.id')
                    ->where('author.role', '=', 'author');
            })
            ->leftJoin('articles as article', function ($join) {
                $join
                    ->on('article.author_id', '=', 'author.id')
                    ->whereIn('article.status', ['pending', 'approved']);
            })
            ->where('reviewer.role', 'reviewer')
            ->select(
                'reviewer.id',
                'reviewer.name',
                'reviewer.status',
                DB::raw('COUNT(DISTINCT author.id) as assigned_authors_total'),
                DB::raw('COUNT(article.id) as pending_articles_total'),
                DB::raw('MIN(article.created_at) as oldest_pending_at')
            )
            ->selectRaw(
                'SUM(CASE WHEN article.id IS NOT NULL AND article.created_at <= ? THEN 1 ELSE 0 END) as overdue_pending_total',
                [$overdueThreshold->toDateTimeString()]
            )
            ->groupBy('reviewer.id', 'reviewer.name', 'reviewer.status')
            ->orderBy('reviewer.name')
            ->get()
            ->map(function ($row) {
                $overduePendingTotal = (int) ($row->overdue_pending_total ?? 0);
                $oldestPendingHours = null;

                if ($row->oldest_pending_at) {
                    $oldestPendingHours = Carbon::parse($row->oldest_pending_at)->diffInHours(now());
                }

                $warningLevel = 'ok';

                if ($overduePendingTotal > 0) {
                    $warningLevel = $overduePendingTotal >= 3 || ($oldestPendingHours !== null && $oldestPendingHours >= 72)
                        ? 'critical'
                        : 'warning';
                }

                return [
                    'reviewer_id' => (int) $row->id,
                    'reviewer_name' => $row->name,
                    'reviewer_status' => $row->status,
                    'assigned_authors_total' => (int) ($row->assigned_authors_total ?? 0),
                    'pending_articles_total' => (int) ($row->pending_articles_total ?? 0),
                    'overdue_pending_total' => $overduePendingTotal,
                    'oldest_pending_at' => $row->oldest_pending_at,
                    'oldest_pending_hours' => $oldestPendingHours,
                    'warning_level' => $warningLevel,
                ];
            })
            ->values();

        $reviewerSlaSummary = [
            'reviewers_total' => $reviewerSla->count(),
            'reviewers_with_warning' => $reviewerSla->where('warning_level', '!=', 'ok')->count(),
            'total_overdue_pending' => (int) $reviewerSla->sum('overdue_pending_total'),
        ];

        return response()->json([
            'status' => 'success',
            'message' => 'Dashboard admin berhasil dimuat.',
            'data' => [
                'metrics' => [
                    'total_articles' => $totalArticles,
                    'total_published' => $totalPublished,
                    'pending_review' => $pendingReview,
                    'total_users' => $totalUsers,
                ],
                'article_status' => $articleStatus,
                'reviewer_sla' => $reviewerSla,
                'reviewer_sla_summary' => $reviewerSlaSummary,
                'latest_articles' => $latestArticles,
                'recent_activities' => $recentActivities,
            ],
        ]);
    }
}
