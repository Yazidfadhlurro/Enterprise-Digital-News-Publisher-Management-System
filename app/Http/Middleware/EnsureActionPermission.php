<?php

namespace App\Http\Middleware;

use App\Support\Access\PermissionMatrix;
use Closure;
use Illuminate\Http\Request;

class EnsureActionPermission
{
    public function handle(Request $request, Closure $next, string $actionKey)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Silakan login terlebih dahulu.',
            ], 401);
        }

        if (!PermissionMatrix::isAllowed((string) $user->role, $actionKey)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki izin untuk aksi ini.',
                'data' => [
                    'action_key' => $actionKey,
                    'role' => $user->role,
                ],
            ], 403);
        }

        return $next($request);
    }
}
