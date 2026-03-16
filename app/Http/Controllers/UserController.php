<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query();

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('role')) {
            $query->where('role', $request->role);
        }

        $users = $query->paginate(15);

        return response()->json([
            'status' => 'success',
            'message' => 'All users retrieved',
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
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'User not found',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'User details retrieved',
            'data' => ['user' => $user]
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6|confirmed',
            'role' => 'required|in:admin,reviewer,author,user',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'User created successfully',
            'data' => ['user' => $user]
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'User not found',
            ], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'role' => 'sometimes|in:admin,reviewer,author,user',
        ]);

        $user->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'User updated successfully',
            'data' => ['user' => $user]
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'User not found',
            ], 404);
        }

        if ($request->user()->id === (int)$id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Cannot delete your own account',
            ], 403);
        }

        $userName = $user->name;
        $user->delete();

        return response()->json([
            'status' => 'success',
            'message' => "User '$userName' deleted successfully",
        ]);
    }

    public function approve($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'User not found',
            ], 404);
        }

        if ($user->isActive()) {
            return response()->json([
                'status' => 'error',
                'message' => 'User already approved',
            ], 400);
        }

        $user->update(['status' => 'active']);

        return response()->json([
            'status' => 'success',
            'message' => "User '{$user->name}' approved successfully",
            'data' => ['user' => $user]
        ]);
    }

    public function reject($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'User not found',
            ], 404);
        }

        if ($user->isActive()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Cannot reject active user. Use delete instead.',
            ], 400);
        }

        $userName = $user->name;
        $user->delete();

        return response()->json([
            'status' => 'success',
            'message' => "User '$userName' rejected successfully",
        ]);
    }

    public function suspend($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'User not found',
            ], 404);
        }

        if ($user->isSuspended()) {
            return response()->json([
                'status' => 'error',
                'message' => 'User already suspended',
            ], 400);
        }

        $user->update(['status' => 'suspended']);

        return response()->json([
            'status' => 'success',
            'message' => "User '{$user->name}' suspended successfully",
            'data' => ['user' => $user]
        ]);
    }

    public function unsuspend($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'User not found',
            ], 404);
        }

        if (!$user->isSuspended()) {
            return response()->json([
                'status' => 'error',
                'message' => 'User is not suspended',
            ], 400);
        }

        $user->update(['status' => 'active']);

        return response()->json([
            'status' => 'success',
            'message' => "User '{$user->name}' unsuspended successfully",
            'data' => ['user' => $user]
        ]);
    }
}
