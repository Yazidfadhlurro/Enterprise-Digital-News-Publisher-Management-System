<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class MapScopeSessionCookie
{
    public function handle(Request $request, Closure $next)
    {
        try {
            $sessionCookie = config('session.cookie');

            // Prefer scoped session cookies for API requests.
            // If a scope-specific session cookie is present (internal or public),
            // map it to the standard session cookie so Laravel session/auth picks
            // up the correct session even when a stale laravel-session exists.
            if ($request->cookies->has('internal_session')) {
                $val = $request->cookies->get('internal_session');
                $request->cookies->set($sessionCookie, $val);
                // Also ensure PHP global cookie is set so StartSession and other
                // early code that reads $_COOKIE will see the mapped session id.
                try {
                    $_COOKIE[$sessionCookie] = $val;
                } catch (\Throwable $_) {
                }
                Log::debug('MapScopeSessionCookie mapped internal_session to '.$sessionCookie, ['session_id' => $val]);
            } elseif ($request->cookies->has('public_session')) {
                $val = $request->cookies->get('public_session');
                $request->cookies->set($sessionCookie, $val);
                try {
                    $_COOKIE[$sessionCookie] = $val;
                } catch (\Throwable $_) {
                }
                Log::debug('MapScopeSessionCookie mapped public_session to '.$sessionCookie, ['session_id' => $val]);
            }
        } catch (\Throwable $e) {
        }

        return $next($request);
    }
}
