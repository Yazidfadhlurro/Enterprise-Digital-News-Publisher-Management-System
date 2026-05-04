<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, ...$roles)
    {
        if (!$request->user()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Silakan login terlebih dahulu.',
            ], 401);
        }

        if (!in_array($request->user()->role, $roles)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki akses ke halaman ini.',
            ], 403);
        }

        return $next($request);
    }
}
