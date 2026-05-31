<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user) {
            return $next($request);
        }

        if ($user->isSuspended()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akun Anda sedang dinonaktifkan. Hubungi admin untuk bantuan.',
            ], 403);
        }

        if ($user->isInactive()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akun Anda tidak aktif. Hubungi admin untuk bantuan.',
            ], 403);
        }

        return $next($request);
    }
}