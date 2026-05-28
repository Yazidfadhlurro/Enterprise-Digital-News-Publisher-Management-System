<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\RegistrationInvite;
use App\Mail\SendVerificationCode;
use App\Mail\SendPasswordResetLink;
use App\Support\AssignmentLoadBalancer;
use App\Support\AuthorAssignmentLogger;
use App\Support\ContentSanitizer;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{

    private const INTERNAL_ROLES = ['admin', 'reviewer', 'author'];

    private function withDeprecationHeaders($response, string $successor): mixed
    {
        $response->headers->set('Warning', sprintf('299 - "Deprecated API: gunakan %s"', $successor));
        $response->headers->set('Deprecation', 'true');
        $response->headers->set('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
        $response->headers->set('Link', sprintf('<%s>; rel="successor-version"', $successor));

        return $response;
    }

    private function authScopeForRole(string $role): string
    {
        return in_array($role, self::INTERNAL_ROLES, true) ? 'internal' : 'public';
    }

    private function passwordResetScopeForUser(User $user): string
    {
        return $user->auth_scope ?: $this->authScopeForRole((string) $user->role);
    }

    private function createPasswordResetUrl(string $token, string $email, string $scope): string
    {
        return url('/reset-password/' . $token . '?email=' . urlencode($email) . '&scope=' . urlencode($scope));
    }

    private function issuePasswordResetToken(User $user): string
    {
        $token = Str::random(64);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $user->email],
            [
                'token' => Hash::make($token),
                'created_at' => now(),
            ]
        );

        return $token;
    }

    private function createInternalUserForInvite(Request $request, array $validated, RegistrationInvite $invite): User
    {
        $role = (string) $invite->role;
        $assignedReviewerId = null;

        if ($role === 'author') {
            $assignedReviewerId = AssignmentLoadBalancer::leastLoadedActiveReviewerId();

            if (blank($assignedReviewerId)) {
                throw ValidationException::withMessages([
                    'invite_token' => ['Belum ada editor aktif untuk penugasan penulis otomatis.'],
                ]);
            }
        }

        $user = User::create([
            'name' => ContentSanitizer::sanitizePlainText($validated['name']),
            'email' => trim((string) $validated['email']),
            'password' => Hash::make($validated['password']),
            'role' => $role,
            'auth_scope' => 'internal',
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
                AuthorAssignmentLogger::ACTION_AUTO_BALANCE,
                'Akun penulis dibuat melalui undangan internal.'
            );
        }

        $invite->update([
            'status' => 'used',
            'used_at' => now(),
            'used_by_user_id' => $user->id,
        ]);

        return $user;
    }

    private function loginByScope(Request $request, ?string $requiredScope)
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

        $authScope = $user->auth_scope ?: $this->authScopeForRole((string) $user->role);

        if ($requiredScope !== null && $authScope !== $requiredScope) {
            $message = $requiredScope === 'internal'
                ? 'Akun Anda terdaftar di jalur publik. Gunakan login publik.'
                : 'Akun Anda terdaftar di jalur internal. Gunakan login internal.';

            return response()->json([
                'status' => 'error',
                'message' => $message,
            ], 403);
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

        Auth::guard('web')->login($user);

        try {
            if (method_exists($request, 'session')) {
                $request->session()->regenerate();

                // Ensure the session contains the guard login key so the
                // SessionGuard can retrieve the user on subsequent requests.
                try {
                    $guardSessionKey = 'login_web_'.sha1(\Illuminate\Auth\SessionGuard::class);
                    $request->session()->put($guardSessionKey, $user->getAuthIdentifier());
                } catch (\Throwable $__e) {
                    // ignore failures to write directly to session
                }

                // Persist session immediately so DB-backed sessions contain
                // the authentication payload before we queue cookies.
                try {
                    $request->session()->save();
                } catch (\Throwable $__e) {
                    // ignore save failures in environments without a writable store
                }
            }
        } catch (\Throwable $e) {
        }

        try {
            Log::info('AuthController@loginByScope success', [
                'path' => $request->path(),
                'user_id' => $user->id ?? null,
                'user_email' => $user->email ?? null,
                'auth_id' => Auth::id(),
                'session_id' => $request->hasSession() ? $request->session()->getId() : null,
            ]);
        } catch (\Throwable $e) {
        }

        $resp = response()->json([
            'status' => 'success',
            'message' => 'Berhasil masuk.',
            'data' => [
                'user' => $user->only(['id', 'name', 'email', 'phone', 'address', 'bio', 'role', 'auth_scope', 'avatar', 'status']),
            ]
        ], 200);

        try {
            if ($request->hasSession()) {
                $minutes = (int) config('session.lifetime', 120);
                $cookieName = config('session.cookie');
                $sessionId = $request->session()->getId();

                Cookie::queue(Cookie::make($cookieName, $sessionId, $minutes));
                if (!empty($authScope) && $authScope === 'internal') {
                    Cookie::queue(Cookie::make('internal_session', $sessionId, $minutes));
                } else {
                    Cookie::queue(Cookie::make('public_session', $sessionId, $minutes));
                }
                Cookie::queue(Cookie::make(
                    'XSRF-TOKEN',
                    $request->session()->token(),
                    $minutes,
                    '/',
                    config('session.domain'),
                    (bool) config('session.secure'),
                    false
                ));
            }
        } catch (\Throwable $e) {
        }

        return $resp;
    }

    public function registerPublic(Request $request)
    {
        return $this->register($request);
    }

    public function registerLegacy(Request $request)
    {
        return $this->withDeprecationHeaders($this->registerPublic($request), '/api/public/auth/register');
    }

    public function loginPublic(Request $request)
    {
        return $this->loginByScope($request, 'public');
    }

    public function loginInternal(Request $request)
    {
        return $this->loginByScope($request, 'internal');
    }

    public function loginLegacy(Request $request)
    {
        return $this->withDeprecationHeaders($this->loginByScope($request, null), '/api/public/auth/login');
    }

    public function verifyEmailPublic(Request $request)
    {
        return $this->verifyEmail($request);
    }

    public function verifyEmailLegacy(Request $request)
    {
        return $this->withDeprecationHeaders($this->verifyEmailPublic($request), '/api/public/auth/verify-email');
    }

    public function forgotPasswordPublic(Request $request)
    {
        return $this->forgotPassword($request);
    }

    public function forgotPasswordLegacy(Request $request)
    {
        return $this->withDeprecationHeaders($this->forgotPasswordPublic($request), '/api/public/auth/forgot-password');
    }

    public function resetPasswordPublic(Request $request)
    {
        return $this->resetPassword($request);
    }

    public function resetPasswordLegacy(Request $request)
    {
        return $this->withDeprecationHeaders($this->resetPasswordPublic($request), '/api/public/auth/reset-password');
    }

    public function registerInvite(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255',
            'password' => 'required|string|min:8|confirmed',
            'invite_token' => 'required|string|max:96',
        ]);

        $invite = RegistrationInvite::where('token', $validated['invite_token'])->first();

        if (!$invite || !$invite->isActive()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tautan undangan tidak valid atau sudah kedaluwarsa.',
            ], 404);
        }

        if (!in_array((string) $invite->role, self::INTERNAL_ROLES, true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tautan undangan tidak mendukung role ini.',
            ], 422);
        }

        $email = trim((string) $validated['email']);

        if (filled($invite->email) && strcasecmp(trim((string) $invite->email), $email) !== 0) {
            return response()->json([
                'status' => 'error',
                'message' => 'Email tidak sesuai dengan undangan.',
            ], 403);
        }

        if (User::where('email', $email)->exists()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Email ini sudah terdaftar.',
            ], 422);
        }

        $user = $this->createInternalUserForInvite($request, $validated, $invite);

        Auth::guard('web')->login($user);

        try {
            if (method_exists($request, 'session')) {
                $request->session()->regenerate();
            }
        } catch (\Throwable $e) {
            // ignore session start/regenerate failures in environments without session middleware
        }

        $resp = response()->json([
            'status' => 'success',
            'message' => 'Akun internal berhasil dibuat.',
            'data' => [
                'user' => $user->only(['id', 'name', 'email', 'phone', 'address', 'bio', 'role', 'auth_scope', 'avatar', 'status']),
            ],
        ], 201);

        try {
            if ($request->hasSession()) {
                $minutes = (int) config('session.lifetime', 120);
                $cookieName = config('session.cookie');
                $sessionId = $request->session()->getId();

                Cookie::queue(Cookie::make($cookieName, $sessionId, $minutes));
                // registerInvite creates internal accounts only: set internal_session
                Cookie::queue(Cookie::make('internal_session', $sessionId, $minutes));
                Cookie::queue(Cookie::make(
                    'XSRF-TOKEN',
                    $request->session()->token(),
                    $minutes,
                    '/',
                    config('session.domain'),
                    (bool) config('session.secure'),
                    false
                ));
            }
        } catch (\Throwable $e) {
            // ignore cookie queue failures
        }

        return $resp;
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $verificationCode = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $name = ContentSanitizer::sanitizePlainText($validated['name']);
        $email = trim((string) $validated['email']);

        try {
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($validated['password']),
                'role' => 'user',
                'auth_scope' => 'public',
                'assigned_reviewer_id' => null,
                'status' => 'active',
                'email_verification_code' => $verificationCode,
            ]);
        } catch (\Exception $e) {
            Log::error('Registrasi gagal: tidak bisa simpan user', [
                'email' => $email,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Registrasi gagal. Silakan coba beberapa saat lagi.',
            ], 500);
        }

        try {
            Mail::to($user->email)->send(new SendVerificationCode($user, $verificationCode));
        } catch (\Exception $e) {
            Log::warning('Registrasi berhasil tapi email verifikasi gagal dikirim', [
                'user_id' => $user->id,
                'email' => $email,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Registrasi berhasil. Silakan verifikasi email untuk masuk.',
            'data' => [
                'user' => $user->only(['id', 'name', 'email', 'role', 'status', 'assigned_reviewer_id']),
                'message' => 'Kode verifikasi sudah dikirim ke email Anda.',
            ]
        ], 201);
    }

    public function login(Request $request)
    {
        return $this->loginByScope($request, null);
    }

    public function logout(Request $request)
    {
        if ($request->user()) {
            $request->user()->tokens()->delete();
        }

        Auth::guard('web')->logout();
        // also ensure global logout and flush session store to avoid stale auth in tests
        try {
            Auth::logout();
            if ($request->hasSession()) {
                $request->session()->flush();
                $request->session()->invalidate();
                $request->session()->regenerateToken();
                try {
                    Cookie::queue(Cookie::forget(config('session.cookie')));
                    Cookie::queue(Cookie::forget('internal_session'));
                    Cookie::queue(Cookie::forget('public_session'));
                    Cookie::queue(Cookie::forget('XSRF-TOKEN'));
                } catch (\Throwable $e) {
                }
            }
        } catch (\Throwable $e) {
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Berhasil keluar.',
        ], 200);
    }

    public function forgotPassword(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|string|email',
        ]);

        $email = trim((string) $validated['email']);
        $user = User::where('email', $email)->first();

        if ($user) {
            $token = $this->issuePasswordResetToken($user);
            $scope = $this->passwordResetScopeForUser($user);
            $resetUrl = $this->createPasswordResetUrl($token, $email, $scope);

            Mail::to($user->email)->send(new SendPasswordResetLink($user, $resetUrl));
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Jika email terdaftar, tautan untuk mengatur ulang kata sandi telah dikirim.',
        ]);
    }

    public function resetPassword(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|string|email',
            'token' => 'required|string|max:255',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $email = trim((string) $validated['email']);
        $resetRecord = DB::table('password_reset_tokens')
            ->where('email', $email)
            ->first();

        if (!$resetRecord) {
            return response()->json([
                'status' => 'error',
                'message' => 'Token reset tidak valid atau sudah kedaluwarsa.',
            ], 422);
        }

        $expireMinutes = (int) config('auth.passwords.users.expire', 60);
        $createdAt = $resetRecord->created_at ? Carbon::parse($resetRecord->created_at) : null;

        if (!$createdAt || $createdAt->addMinutes($expireMinutes)->isPast()) {
            DB::table('password_reset_tokens')->where('email', $email)->delete();

            return response()->json([
                'status' => 'error',
                'message' => 'Token reset tidak valid atau sudah kedaluwarsa.',
            ], 422);
        }

        if (!Hash::check((string) $validated['token'], (string) $resetRecord->token)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Token reset tidak valid atau sudah kedaluwarsa.',
            ], 422);
        }

        $user = User::where('email', $email)->first();

        if (!$user) {
            DB::table('password_reset_tokens')->where('email', $email)->delete();

            return response()->json([
                'status' => 'error',
                'message' => 'Token reset tidak valid atau sudah kedaluwarsa.',
            ], 422);
        }

        $user->forceFill([
            'password' => Hash::make($validated['password']),
            'remember_token' => Str::random(60),
        ])->save();

        DB::table('password_reset_tokens')->where('email', $email)->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Kata sandi berhasil diatur ulang. Silakan masuk kembali.',
        ]);
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
            'avatar' => 'nullable',
            'remove_avatar' => 'nullable|boolean',
        ]);

        if ($request->hasFile('avatar')) {
            $request->validate([
                'avatar' => 'image|mimes:jpg,jpeg,png,webp|max:4096',
            ]);
        }

        $user = $request->user();
        $attributes = [
            'name' => ContentSanitizer::sanitizePlainText($validated['name']),
            'email' => trim((string) $validated['email']),
            'phone' => filled($validated['phone'] ?? null) ? ContentSanitizer::sanitizePlainText($validated['phone']) : null,
            'address' => filled($validated['address'] ?? null) ? ContentSanitizer::sanitizePlainText($validated['address']) : null,
            'bio' => filled($validated['bio'] ?? null) ? ContentSanitizer::sanitizePlainText($validated['bio']) : null,
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
            $normalizedAvatar = ContentSanitizer::sanitizeMediaPath($inputAvatar);

            if ($inputAvatar !== '' && $normalizedAvatar === null) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Avatar tidak valid.',
                ], 422);
            }

            if ($normalizedAvatar !== null) {
                $attributes['avatar'] = $normalizedAvatar;
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

    public function updateProfileDeprecated(Request $request)
    {
        $response = $this->updateProfile($request);

        $response->headers->set('Warning', '299 - "Deprecated API: gunakan PUT /api/auth/profile"');
        $response->headers->set('Deprecation', 'true');
        $response->headers->set('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
        $response->headers->set('Link', '</api/auth/profile>; rel="successor-version"');

        return $response;
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
            ], 422);
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

        if (!hash_equals((string) $user->email_verification_code, (string) $validated['code'])) {
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
