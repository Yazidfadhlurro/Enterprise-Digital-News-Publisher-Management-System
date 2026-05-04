<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Mail\SendVerificationCode;
use App\Support\AssignmentLoadBalancer;
use App\Support\AuthorAssignmentLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{

    public function register(Request $request)
    {
        if (!$request->filled(['name', 'email', 'password'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Semua data wajib diisi.',
            ], 400);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'role' => 'sometimes|in:admin,reviewer,author,user',
        ]);

        $verificationCode = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
        $role = $validated['role'] ?? 'user';
        $assignedReviewerId = null;

        if ($role === 'author') {
            $assignedReviewerId = AssignmentLoadBalancer::leastLoadedActiveReviewerId();

            if (!$assignedReviewerId) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Registrasi author membutuhkan reviewer aktif, namun belum tersedia.',
                ], 422);
            }
        }

        try {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => $role,
                'assigned_reviewer_id' => $assignedReviewerId,
                'status' => 'active',
                'email_verification_code' => $verificationCode,
            ]);

            if ($role === 'author' && $assignedReviewerId) {
                AuthorAssignmentLogger::log(
                    (int) $user->id,
                    null,
                    (int) $assignedReviewerId,
                    null,
                    AuthorAssignmentLogger::ACTION_AUTO_BALANCE,
                    'Auto assignment saat registrasi author.'
                );
            }

            Mail::to($user->email)->send(new SendVerificationCode($user, $verificationCode));

            return response()->json([
                'status' => 'success',
                'message' => 'Registrasi berhasil. Silakan verifikasi email untuk masuk.',
                'data' => [
                    'user' => $user->only(['id', 'name', 'email', 'role', 'status', 'assigned_reviewer_id']),
                    'message' => 'Kode verifikasi sudah dikirim ke email Anda.',
                ]
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Registrasi gagal. ' . $e->getMessage(),
            ], 400);
        }
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Email atau kata sandi salah.'],
            ]);
        }

        if ($user->isSuspended()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akun Anda sedang dinonaktifkan. Hubungi admin untuk bantuan.',
            ], 403);
        }

        if ($user->needsEmailVerification()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Silakan verifikasi email sebelum masuk.',
            ], 403);
        }

        $user->tokens()->delete();
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'message' => 'Berhasil masuk.',
            'data' => [
                'user' => $user->only(['id', 'name', 'email', 'phone', 'address', 'bio', 'role', 'avatar', 'status']),
                'token' => $token,
            ]
        ], 200);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Berhasil keluar.',
        ], 200);
    }


    public function me(Request $request)
    {
        return response()->json([
            'status' => 'success',
            'data' => [
                'user' => $request->user(),
            ]
        ], 200);
    }

    public function updateProfile(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $request->user()->id,
            'phone' => 'nullable|string|max:30',
            'address' => 'nullable|string|max:255',
            'bio' => 'nullable|string|max:1000',
            'avatar' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:4096',
            'remove_avatar' => 'nullable|boolean',
        ]);

        $user = $request->user();
        $attributes = [
            'name' => trim((string) $validated['name']),
            'email' => trim((string) $validated['email']),
            'phone' => filled($validated['phone'] ?? null) ? trim((string) $validated['phone']) : null,
            'address' => filled($validated['address'] ?? null) ? trim((string) $validated['address']) : null,
            'bio' => filled($validated['bio'] ?? null) ? trim((string) $validated['bio']) : null,
        ];

        $deleteStoredAvatar = function ($avatarPath) {
            $path = trim((string) $avatarPath);

            if ($path === '') {
                return;
            }

            if (
                str_starts_with($path, 'http://')
                || str_starts_with($path, 'https://')
                || str_starts_with($path, 'data:')
                || str_starts_with($path, '/')
            ) {
                return;
            }

            Storage::disk('public')->delete($path);
        };

        if ($request->boolean('remove_avatar')) {
            $deleteStoredAvatar($user->avatar);
            $attributes['avatar'] = null;
        }

        if ($request->hasFile('avatar')) {
            $deleteStoredAvatar($user->avatar);
            $attributes['avatar'] = $request->file('avatar')->store('avatars', 'public');
        }

        if (!$request->hasFile('avatar')) {
            $inputAvatar = trim((string) $request->input('avatar', ''));

            if ($inputAvatar !== '') {
                $attributes['avatar'] = $inputAvatar;
            }
        }

        $user->update($attributes);

        return response()->json([
            'status' => 'success',
            'message' => 'Profil berhasil diperbarui.',
            'data' => [
                'user' => $user->only(['id', 'name', 'email', 'phone', 'address', 'bio', 'role', 'avatar', 'status']),
            ]
        ], 200);
    }

    public function changePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Kata sandi saat ini salah.',
            ], 401);
        }

        $user->update([
            'password' => Hash::make($validated['password']),
        ]);

        $user->tokens()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Kata sandi berhasil diubah. Silakan masuk kembali.',
        ], 200);
    }


    public function verifyEmail(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|string|email',
            'code' => 'required|string|digits:6',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pengguna tidak ditemukan.',
            ], 404);
        }

        if ($user->isEmailVerified()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Email sudah diverifikasi.',
            ], 400);
        }

        if ($user->email_verification_code !== $validated['code']) {
            return response()->json([
                'status' => 'error',
                'message' => 'Kode verifikasi tidak valid.',
            ], 401);
        }

        $user->update([
            'email_verified_at' => now(),
            'email_verification_code' => null,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Email berhasil diverifikasi. Sekarang Anda bisa masuk.',
        ], 200);
    }
}
