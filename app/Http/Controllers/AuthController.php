<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Mail\SendVerificationCode;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{

    public function register(Request $request)
    {
        if (!$request->filled(['name', 'email', 'password'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'All fields are required',
            ], 400);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'role' => 'sometimes|in:admin,reviewer,author,user',
        ]);

        $verificationCode = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);

        try {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => $validated['role'] ?? 'user',
                'status' => 'active',
                'email_verification_code' => $verificationCode,
            ]);

            Mail::to($user->email)->send(new SendVerificationCode($user, $verificationCode));

            return response()->json([
                'status' => 'success',
                'message' => 'Registration successful. Please verify your email to login.',
                'data' => [
                    'user' => $user->only(['id', 'name', 'email', 'role', 'status']),
                    'message' => 'Verification code sent to your email.',
                ]
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Registration failed. ' . $e->getMessage(),
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
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->isSuspended()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Your account is suspended. Contact the administrator.',
            ], 403);
        }

        if ($user->needsEmailVerification()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Please verify your email before logging in.',
            ], 403);
        }

        $user->tokens()->delete();
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'message' => 'Login successful',
            'data' => [
                'user' => $user->only(['id', 'name', 'email', 'role', 'avatar', 'status']),
                'token' => $token,
            ]
        ], 200);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Logged out successfully',
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
            'avatar' => 'nullable|string',
        ]);

        $user = $request->user();
        $user->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Profile updated successfully',
            'data' => [
                'user' => $user,
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
                'message' => 'Current password is incorrect',
            ], 401);
        }

        $user->update([
            'password' => Hash::make($validated['password']),
        ]);

        $user->tokens()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Password changed successfully. Please login again.',
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
                'message' => 'User not found.',
            ], 404);
        }

        if ($user->isEmailVerified()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Email is already verified.',
            ], 400);
        }

        if ($user->email_verification_code !== $validated['code']) {
            return response()->json([
                'status' => 'error',
                'message' => 'Invalid verification code.',
            ], 401);
        }

        $user->update([
            'email_verified_at' => now(),
            'email_verification_code' => null,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Email verified successfully. You can now login.',
        ], 200);
    }
}
