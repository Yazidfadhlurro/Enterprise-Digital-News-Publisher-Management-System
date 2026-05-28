<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class NormalizeCsrfToken
{
    /**
     * If the request doesn't include CSRF headers but the XSRF-TOKEN cookie exists,
     * populate `X-XSRF-TOKEN` and `X-CSRF-TOKEN` headers from the cookie.
     */
    public function handle(Request $request, Closure $next)
    {
        $hasCsrfHeader = $request->header('X-CSRF-TOKEN') || $request->header('X-XSRF-TOKEN');

        if (! $hasCsrfHeader) {
            $cookie = $request->cookie('XSRF-TOKEN');
            if ($cookie) {
                // Ensure header values are raw (clients usually send the cookie value URL-encoded)
                $value = is_string($cookie) ? urldecode($cookie) : $cookie;
                $request->headers->set('X-CSRF-TOKEN', $value);
                $request->headers->set('X-XSRF-TOKEN', $value);
            }
        }

        return $next($request);
    }
}
