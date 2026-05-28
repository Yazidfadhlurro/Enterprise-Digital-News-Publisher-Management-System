<?php

namespace App\Http\Controllers;

use App\Models\RegistrationInvite;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class RegistrationInviteController extends Controller
{
    private function generateToken(): string
    {
        do {
            $token = Str::random(64);
        } while (RegistrationInvite::where('token', $token)->exists());

        return $token;
    }

    public function index(Request $request)
    {
        $perPage = max(1, min((int) $request->query('per_page', 15), 50));

        $invites = RegistrationInvite::query()
            ->with([
                'invitedBy:id,name,email',
                'usedBy:id,name,email,role',
            ])
            ->orderByDesc('created_at')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'status' => 'success',
            'message' => 'Daftar undangan berhasil dimuat.',
            'data' => [
                'invites' => $invites->items(),
                'pagination' => [
                    'total' => $invites->total(),
                    'per_page' => $invites->perPage(),
                    'current_page' => $invites->currentPage(),
                    'last_page' => $invites->lastPage(),
                ],
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'role' => 'required|in:author,reviewer',
            'email' => 'nullable|email|max:255',
            'expires_in_days' => 'nullable|integer|min:1|max:30',
            'note' => 'nullable|string|max:1000',
        ]);

        $expiresInDays = (int) ($validated['expires_in_days'] ?? 7);
        $expiresAt = Carbon::now()->addDays($expiresInDays);

        $invite = RegistrationInvite::create([
            'email' => isset($validated['email']) ? trim((string) $validated['email']) : null,
            'role' => $validated['role'],
            'token' => $this->generateToken(),
            'status' => 'pending',
            'expires_at' => $expiresAt,
            'invited_by_user_id' => $request->user() ? (int) $request->user()->id : null,
            'note' => isset($validated['note']) ? trim((string) $validated['note']) : null,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Undangan berhasil dibuat.',
            'data' => [
                'invite' => $invite,
                'invite_url' => url('/invite/' . $invite->token),
            ],
        ], 201);
    }

    public function showPublic(string $token)
    {
        $invite = RegistrationInvite::where('token', $token)->first();

        if (!$invite || !$invite->isActive()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tautan undangan tidak valid atau sudah kedaluwarsa.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'invite' => [
                    'role' => $invite->role,
                    'email' => $invite->email,
                    'expires_at' => optional($invite->expires_at)->toIso8601String(),
                    'note' => $invite->note,
                ],
            ],
        ]);
    }

    public function revoke(Request $request, int $id)
    {
        $invite = RegistrationInvite::find($id);

        if (!$invite) {
            return response()->json([
                'status' => 'error',
                'message' => 'Undangan tidak ditemukan.',
            ], 404);
        }

        if ($invite->isUsed()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Undangan yang sudah dipakai tidak dapat dicabut.',
            ], 422);
        }

        $invite->update([
            'status' => 'revoked',
            'revoked_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Undangan berhasil dicabut.',
        ]);
    }
}