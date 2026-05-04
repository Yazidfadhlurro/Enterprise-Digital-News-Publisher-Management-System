<?php

namespace App\Http\Controllers;

use App\Support\Access\PermissionMatrix;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminPermissionController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'message' => 'Permission matrix berhasil dimuat.',
            'data' => [
                'roles' => PermissionMatrix::roles(),
                'actions' => PermissionMatrix::actions(),
                'matrix' => PermissionMatrix::matrix(),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'entries' => ['required', 'array', 'min:1'],
            'entries.*.role' => ['required', 'string', 'in:admin,reviewer,author,user'],
            'entries.*.action_key' => ['required', 'string', 'max:120'],
            'entries.*.is_allowed' => ['required', 'boolean'],
        ]);

        PermissionMatrix::upsertMany($validated['entries'], $request->user()?->id);

        return response()->json([
            'status' => 'success',
            'message' => 'Permission matrix berhasil diperbarui.',
            'data' => [
                'roles' => PermissionMatrix::roles(),
                'actions' => PermissionMatrix::actions(),
                'matrix' => PermissionMatrix::matrix(),
            ],
        ]);
    }
}
