<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureAuthScope
{
    public function handle(Request $request, Closure $next, ...$scopes)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Silakan login terlebih dahulu.',
            ], 401);
        }

        $authScope = $user->authScope();

        if (!in_array($authScope, $scopes, true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Scope autentikasi tidak sesuai untuk endpoint ini.',
            ], 403);
        }

        return $next($request);
    }
}
