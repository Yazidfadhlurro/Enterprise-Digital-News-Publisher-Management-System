<?php

namespace App\Http\Controllers;

use Illuminate\Support\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AdminActivityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));
        $type = trim((string) $request->query('type', 'all'));
        $fromDate = trim((string) $request->query('from_date', ''));
        $toDate = trim((string) $request->query('to_date', ''));

        $page = max(1, (int) $request->query('page', 1));

        $perPage = (int) $request->query('per_page', 12);
        $perPage = max(1, min($perPage, 50));

        $activities = $this->collectActivities($search, $type, $fromDate, $toDate);

        $total = $activities->count();
        $offset = ($page - 1) * $perPage;

        $items = $activities
            ->slice($offset, $perPage)
            ->values()
            ->map(function ($activity) {
                return [
                    'id' => $activity['id'],
                    'type' => $activity['type'],
                    'type_label' => $activity['type_label'],
                    'actor_name' => $activity['actor_name'],
                    'message' => $activity['message'],
                    'target' => $activity['target'],
                    'happened_at' => $activity['happened_at'],
                    'time' => Carbon::parse($activity['happened_at'])->diffForHumans(),
                ];
            });

        $lastPage = (int) ceil($total / $perPage);

        return response()->json([
            'status' => 'success',
            'message' => 'Log aktivitas berhasil dimuat.',
            'data' => [
                'activities' => $items,
                'summary' => [
                    'total' => $total,
                    'article_activities' => $activities->where('type', 'article')->count(),
                    'user_activities' => $activities->where('type', 'user')->count(),
                ],
                'pagination' => [
                    'total' => $total,
                    'per_page' => $perPage,
                    'current_page' => $page,
                    'last_page' => max(1, $lastPage),
                ],
                'filters' => [
                    'q' => $search,
                    'type' => $type,
                    'from_date' => $fromDate,
                    'to_date' => $toDate,
                ],
            ],
        ]);
    }

    public function exportCsv(Request $request)
    {
        $search = trim((string) $request->query('q', ''));
        $type = trim((string) $request->query('type', 'all'));
        $fromDate = trim((string) $request->query('from_date', ''));
        $toDate = trim((string) $request->query('to_date', ''));

        $activities = $this->collectActivities($search, $type, $fromDate, $toDate)
            ->map(function ($activity) {
                return [
                    'id' => $activity['id'],
                    'type' => $activity['type_label'],
                    'actor' => $activity['actor_name'],
                    'target' => (string) ($activity['target'] ?? '-'),
                    'message' => $activity['message'],
                    'happened_at' => Carbon::parse($activity['happened_at'])->format('Y-m-d H:i:s'),
                ];
            })
            ->values();

        $stream = fopen('php://temp', 'r+');
        fputcsv($stream, ['ID', 'Tipe', 'Aktor', 'Target', 'Aktivitas', 'Waktu']);

        foreach ($activities as $row) {
            fputcsv($stream, [
                $this->escapeCsvCell($row['id']),
                $this->escapeCsvCell($row['type']),
                $this->escapeCsvCell($row['actor']),
                $this->escapeCsvCell($row['target']),
                $this->escapeCsvCell($row['message']),
                $this->escapeCsvCell($row['happened_at']),
            ]);
        }

        rewind($stream);
        $csvContent = stream_get_contents($stream);
        fclose($stream);

        $fileName = 'admin-activities-' . now()->format('Ymd-His') . '.csv';

        return response($csvContent, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => sprintf('attachment; filename="%s"', $fileName),
        ]);
    }

    private function collectActivities(string $search, string $type, string $fromDate, string $toDate): Collection
    {
        $activities = $this->buildArticleActivities($fromDate, $toDate)
            ->concat($this->buildUserActivities($fromDate, $toDate))
            ->sortByDesc('happened_at')
            ->values();

        if ($type !== '' && $type !== 'all') {
            $activities = $activities
                ->filter(fn ($activity) => $activity['type'] === $type)
                ->values();
        }

        if ($search !== '') {
            $needle = mb_strtolower($search);
            $activities = $activities
                ->filter(function ($activity) use ($needle) {
                    $haystacks = [
                        mb_strtolower($activity['message']),
                        mb_strtolower($activity['actor_name']),
                        mb_strtolower((string) ($activity['target'] ?? '')),
                    ];

                    foreach ($haystacks as $haystack) {
                        if (str_contains($haystack, $needle)) {
                            return true;
                        }
                    }

                    return false;
                })
                ->values();
        }

        return $activities;
    }

    private function buildArticleActivities(string $fromDate = '', string $toDate = ''): Collection
    {
        $query = DB::table('articles as a')
            ->leftJoin('users as u', 'u.id', '=', 'a.author_id')
            ->select(
                'a.id',
                'a.title',
                'a.status',
                'a.updated_at',
                DB::raw("COALESCE(u.name, 'Sistem') as actor_name")
            )
            ->orderByDesc('a.updated_at')
            ->limit(300);

        $this->applyDateFilter($query, 'a.updated_at', $fromDate, $toDate);

        return $query
            ->get()
            ->map(function ($article) {
                $statusText = match ($article->status) {
                    'draft' => 'menyimpan draft',
                    'pending' => 'mengirim artikel untuk review',
                    'revision' => 'mengirim revisi artikel',
                    'approved' => 'mendapat persetujuan',
                    'published' => 'mempublikasikan artikel',
                    'rejected' => 'artikel ditolak',
                    default => 'memperbarui artikel',
                };

                return [
                    'id' => sprintf('article-%d', $article->id),
                    'type' => 'article',
                    'type_label' => 'Artikel',
                    'actor_name' => $article->actor_name,
                    'target' => $article->title,
                    'message' => sprintf('%s %s "%s"', $article->actor_name, $statusText, $article->title),
                    'happened_at' => Carbon::parse($article->updated_at)->toIso8601String(),
                ];
            })
            ->values();
    }

    private function buildUserActivities(string $fromDate = '', string $toDate = ''): Collection
    {
        $query = DB::table('users')
            ->select('id', 'name', 'email', 'role', 'status', 'created_at', 'updated_at')
            ->orderByDesc('updated_at')
            ->limit(200);

        $this->applyDateFilter($query, 'updated_at', $fromDate, $toDate);

        return $query
            ->get()
            ->map(function ($user) {
                $createdAt = Carbon::parse($user->created_at);
                $updatedAt = Carbon::parse($user->updated_at);
                $isNewAccount = $createdAt->diffInSeconds($updatedAt) <= 2;

                $statusText = match ($user->status) {
                    'active' => 'aktif',
                    'inactive' => 'nonaktif',
                    'suspended' => 'suspend',
                    default => $user->status,
                };

                $message = $isNewAccount
                    ? sprintf('Akun baru "%s" terdaftar sebagai %s', $user->name, $user->role)
                    : sprintf('Status akun "%s" diperbarui menjadi %s', $user->name, $statusText);

                return [
                    'id' => sprintf('user-%d', $user->id),
                    'type' => 'user',
                    'type_label' => 'User',
                    'actor_name' => 'Sistem',
                    'target' => $user->name,
                    'message' => $message,
                    'happened_at' => $updatedAt->toIso8601String(),
                ];
            })
            ->values();
    }

    private function applyDateFilter($query, string $column, string $fromDate, string $toDate): void
    {
        if ($fromDate !== '') {
            try {
                $query->whereDate($column, '>=', Carbon::parse($fromDate)->toDateString());
            } catch (\Throwable) {
            }
        }

        if ($toDate !== '') {
            try {
                $query->whereDate($column, '<=', Carbon::parse($toDate)->toDateString());
            } catch (\Throwable) {
            }
        }
    }

    private function escapeCsvCell($value): string
    {
        $text = (string) ($value ?? '');

        if ($text !== '' && preg_match('/^[=+\-@]/', $text)) {
            return "'" . $text;
        }

        return $text;
    }
}
