<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Role-aware rate limiting middleware.
 *
 * Protects against brute-force and abuse by enforcing
 * per-user + per-route throttle windows that vary by role.
 */
class ThrottleByRole
{
    /**
     * Maximum requests per minute by role.
     */
    private const LIMITS = [
        'admin'    => 120,
        'reviewer' => 90,
        'author'   => 60,
        'user'     => 45,
        'guest'    => 20,
    ];

    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        $role = $user?->role ?? 'guest';
        $maxAttempts = self::LIMITS[$role] ?? self::LIMITS['guest'];

        $key = sprintf(
            'throttle:%s:%s:%s',
            $role,
            $user?->id ?? $request->ip(),
            sha1($request->path())
        );

        if (RateLimiter::tooManyAttempts($key, $maxAttempts)) {
            $retryAfter = RateLimiter::availableIn($key);

            return response()->json([
                'status'  => 'error',
                'message' => 'Terlalu banyak permintaan. Coba lagi nanti.',
                'data'    => [
                    'retry_after_seconds' => $retryAfter,
                ],
            ], 429)->withHeaders([
                'Retry-After'           => $retryAfter,
                'X-RateLimit-Limit'     => $maxAttempts,
                'X-RateLimit-Remaining' => 0,
            ]);
        }

        RateLimiter::hit($key, 60);

        $response = $next($request);

        $response->headers->set('X-RateLimit-Limit', (string) $maxAttempts);
        $response->headers->set(
            'X-RateLimit-Remaining',
            (string) RateLimiter::remaining($key, $maxAttempts)
        );

        return $response;
    }
}
