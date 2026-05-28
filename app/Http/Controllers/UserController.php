<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\AssignmentLoadBalancer;
use App\Support\AuthorAssignmentLogger;
use App\Support\ContentSanitizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private function resolveAuthScopeFromRole(string $role): string
    {
        return in_array($role, ['admin', 'reviewer', 'author'], true) ? 'internal' : 'public';
    }

    public function index(Request $request)
    {
        $query = User::query()
            ->with(['assignedReviewer:id,name,email,status'])
            ->withCount('assignedAuthors');

        $search = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', ''));
        $role = trim((string) $request->query('role', ''));

        $perPage = (int) $request->query('per_page', 15);
        $perPage = max(1, min($perPage, 50));

        if ($search !== '') {
            $likeTerm = '%'.ContentSanitizer::escapeLikeWildcards($search, '!').'%';

            $query->where(function ($subQuery) use ($likeTerm) {
                $subQuery
                    ->whereRaw("name LIKE ? ESCAPE '!'", [$likeTerm])
                    ->orWhereRaw("email LIKE ? ESCAPE '!'", [$likeTerm]);
            });
        }

        if ($status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        if ($role !== '' && $role !== 'all') {
            $query->where('role', $role);
        }

        $users = $query
            ->orderByDesc('created_at')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'status' => 'success',
            'message' => 'Daftar pengguna berhasil dimuat.',
            'data' => [
                'users' => $users->items(),
                'pagination' => [
                    'total' => $users->total(),
                    'per_page' => $users->perPage(),
                    'current_page' => $users->currentPage(),
                    'last_page' => $users->lastPage(),
                ]
            ]
        ]);
    }

    public function show($id)
    {
        $user = User::query()
            ->with([
                'assignedReviewer:id,name,email,status',
                'assignedAuthors:id,name,email,role,status,assigned_reviewer_id',
            ])
            ->find($id);

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pengguna tidak ditemukan.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Detail pengguna berhasil dimuat.',
            'data' => ['user' => $user]
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'role' => 'required|in:admin,reviewer,author,user',
            'assigned_reviewer_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(function ($query) {
                    $query
                        ->where('role', 'reviewer')
                        ->where('status', 'active');
                }),
            ],
        ]);

        $validated['name'] = ContentSanitizer::sanitizePlainText($validated['name']);
        $validated['email'] = trim((string) $validated['email']);

        $role = (string) $validated['role'];
        $assignedReviewerId = $validated['assigned_reviewer_id'] ?? null;
        $assignmentAction = AuthorAssignmentLogger::ACTION_ASSIGN_ON_CREATE;

        if ($role === 'author' && blank($assignedReviewerId)) {
            $assignedReviewerId = AssignmentLoadBalancer::leastLoadedActiveReviewerId();
            $assignmentAction = AuthorAssignmentLogger::ACTION_AUTO_BALANCE;

            if (blank($assignedReviewerId)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Belum ada editor aktif untuk penugasan penulis otomatis.',
                ], 422);
            }
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $role,
            'auth_scope' => $this->resolveAuthScopeFromRole($role),
            'assigned_reviewer_id' => $role === 'author' ? (int) $assignedReviewerId : null,
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        if ($role === 'author' && !blank($assignedReviewerId)) {
            AuthorAssignmentLogger::log(
                (int) $user->id,
                null,
                (int) $assignedReviewerId,
                $request->user() ? (int) $request->user()->id : null,
                $assignmentAction
            );
        }

        $user->load('assignedReviewer:id,name,email,status');

        return response()->json([
            'status' => 'success',
            'message' => 'Pengguna berhasil dibuat.',
            'data' => ['user' => $user]
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pengguna tidak ditemukan.',
            ], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'role' => 'sometimes|in:admin,reviewer,author,user',
            'password' => 'sometimes|nullable|string|min:8|confirmed',
            'assigned_reviewer_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(function ($query) {
                    $query
                        ->where('role', 'reviewer')
                        ->where('status', 'active');
                }),
            ],
        ]);

        if (array_key_exists('name', $validated)) {
            $validated['name'] = ContentSanitizer::sanitizePlainText($validated['name']);
        }

        if (array_key_exists('email', $validated)) {
            $validated['email'] = trim((string) $validated['email']);
        }

        if (array_key_exists('password', $validated) && blank($validated['password'])) {
            unset($validated['password']);
        }

        $targetRole = $validated['role'] ?? $user->role;
        $actorId = $request->user() ? (int) $request->user()->id : null;
        $isDowngradingReviewer = $user->role === 'reviewer' && $targetRole !== 'reviewer';

        if ($isDowngradingReviewer) {
            $reassignResult = $this->reassignAuthorsFromReviewer(
                (int) $user->id,
                $actorId,
                'Reviewer diubah role oleh admin.'
            );

            if ($reassignResult === null) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Tidak ada editor aktif tujuan untuk memindahkan penugasan penulis.',
                ], 422);
            }
        }

        $hasAssignedReviewerInput = array_key_exists('assigned_reviewer_id', $validated);
        $previousAssignedReviewerId = $user->assigned_reviewer_id ? (int) $user->assigned_reviewer_id : null;
        $resolvedAssignedReviewerId = $hasAssignedReviewerInput
            ? ($validated['assigned_reviewer_id'] ?? null)
            : $user->assigned_reviewer_id;

        if ($targetRole === 'author' && blank($resolvedAssignedReviewerId)) {
            $resolvedAssignedReviewerId = AssignmentLoadBalancer::leastLoadedActiveReviewerId();

            if (blank($resolvedAssignedReviewerId)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Belum ada editor aktif untuk penugasan penulis otomatis.',
                ], 422);
            }

            $validated['assigned_reviewer_id'] = (int) $resolvedAssignedReviewerId;
        }

        if ($targetRole !== 'author') {
            $validated['assigned_reviewer_id'] = null;
        } elseif ($hasAssignedReviewerInput) {
            $validated['assigned_reviewer_id'] = $validated['assigned_reviewer_id']
                ? (int) $validated['assigned_reviewer_id']
                : null;
        }

        $validated['auth_scope'] = $this->resolveAuthScopeFromRole((string) $targetRole);

        $user->update($validated);

        $latestAssignedReviewerId = $user->assigned_reviewer_id ? (int) $user->assigned_reviewer_id : null;

        if ($targetRole === 'author' && $previousAssignedReviewerId !== $latestAssignedReviewerId) {
            $action = $hasAssignedReviewerInput
                ? AuthorAssignmentLogger::ACTION_MANUAL_MOVE
                : AuthorAssignmentLogger::ACTION_AUTO_BALANCE;

            AuthorAssignmentLogger::log(
                (int) $user->id,
                $previousAssignedReviewerId,
                $latestAssignedReviewerId,
                $actorId,
                $action
            );
        }

        if ($targetRole !== 'author' && $previousAssignedReviewerId !== null) {
            AuthorAssignmentLogger::log(
                (int) $user->id,
                $previousAssignedReviewerId,
                null,
                $actorId,
                AuthorAssignmentLogger::ACTION_UNASSIGN_ROLE_CHANGE,
                'Penugasan editor dilepas karena peran bukan penulis.'
            );
        }

        $user->load('assignedReviewer:id,name,email,status');

        return response()->json([
            'status' => 'success',
            'message' => 'Pengguna berhasil diperbarui.',
            'data' => ['user' => $user]
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pengguna tidak ditemukan.',
            ], 404);
        }

        if ($request->user()->id === (int)$id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak dapat menghapus akun sendiri.',
            ], 403);
        }

        if ($user->role === 'reviewer') {
            $reassignResult = $this->reassignAuthorsFromReviewer(
                (int) $user->id,
                $request->user() ? (int) $request->user()->id : null,
                'Reviewer dihapus oleh admin.'
            );

            if ($reassignResult === null) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Tidak ada editor aktif tujuan untuk memindahkan penugasan penulis.',
                ], 422);
            }
        }

        $userName = $user->name;
        $user->delete();

        return response()->json([
            'status' => 'success',
            'message' => "Pengguna '$userName' berhasil dihapus.",
        ]);
    }

    public function approve($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pengguna tidak ditemukan.',
            ], 404);
        }

        if ($user->isActive()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pengguna sudah aktif.',
            ], 400);
        }

        $user->update(['status' => 'active']);

        return response()->json([
            'status' => 'success',
            'message' => "Pengguna '{$user->name}' berhasil diaktifkan.",
            'data' => ['user' => $user]
        ]);
    }

    public function reject(Request $request, $id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pengguna tidak ditemukan.',
            ], 404);
        }

        if ($user->isActive()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pengguna aktif tidak dapat ditolak. Gunakan hapus akun.',
            ], 400);
        }

        if ($user->role === 'reviewer') {
            $reassignResult = $this->reassignAuthorsFromReviewer(
                (int) $user->id,
                $request->user() ? (int) $request->user()->id : null,
                'Reviewer ditolak dan akun dihapus.'
            );

            if ($reassignResult === null) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Tidak ada editor aktif tujuan untuk memindahkan penugasan penulis.',
                ], 422);
            }
        }

        $userName = $user->name;
        $user->delete();

        return response()->json([
            'status' => 'success',
            'message' => "Pengguna '$userName' berhasil ditolak dan dihapus.",
        ]);
    }

    public function suspend(Request $request, $id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pengguna tidak ditemukan.',
            ], 404);
        }

        if ($user->isSuspended()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pengguna sudah dinonaktifkan.',
            ], 400);
        }

        if ($user->role === 'reviewer') {
            $reassignResult = $this->reassignAuthorsFromReviewer(
                (int) $user->id,
                $request->user() ? (int) $request->user()->id : null,
                'Reviewer disuspend oleh admin.'
            );

            if ($reassignResult === null) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Tidak ada editor aktif tujuan untuk memindahkan penugasan penulis.',
                ], 422);
            }
        }

        $user->update(['status' => 'suspended']);

        return response()->json([
            'status' => 'success',
            'message' => "Pengguna '{$user->name}' berhasil dinonaktifkan.",
            'data' => ['user' => $user]
        ]);
    }

    public function unsuspend($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pengguna tidak ditemukan.',
            ], 404);
        }

        if (!$user->isSuspended()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pengguna tidak sedang dinonaktifkan.',
            ], 400);
        }

        $user->update(['status' => 'active']);

        return response()->json([
            'status' => 'success',
            'message' => "Pengguna '{$user->name}' berhasil diaktifkan kembali.",
            'data' => ['user' => $user]
        ]);
    }

    private function reassignAuthorsFromReviewer(int $reviewerId, ?int $actorId, string $note): ?array
    {
        $authors = User::query()
            ->where('role', 'author')
            ->where('assigned_reviewer_id', $reviewerId)
            ->get(['id', 'assigned_reviewer_id']);

        if ($authors->isEmpty()) {
            return [
                'moved_count' => 0,
                'target_reviewer_id' => null,
            ];
        }

        $targetReviewerId = AssignmentLoadBalancer::leastLoadedActiveReviewerId($reviewerId);

        if (!$targetReviewerId) {
            return null;
        }

        DB::transaction(function () use ($authors, $reviewerId, $targetReviewerId, $actorId, $note) {
            foreach ($authors as $author) {
                User::query()
                    ->where('id', $author->id)
                    ->update([
                        'assigned_reviewer_id' => $targetReviewerId,
                        'updated_at' => now(),
                    ]);

                AuthorAssignmentLogger::log(
                    (int) $author->id,
                    $reviewerId,
                    $targetReviewerId,
                    $actorId,
                    AuthorAssignmentLogger::ACTION_REASSIGN_INACTIVE,
                    $note
                );
            }
        });

        return [
            'moved_count' => $authors->count(),
            'target_reviewer_id' => $targetReviewerId,
        ];
    }
}
