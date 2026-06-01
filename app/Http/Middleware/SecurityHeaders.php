<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        if (app()->environment('production')) {
            $response->headers->set('Content-Security-Policy', $this->buildCsp());

            // HSTS hanya aman saat koneksi HTTPS aktif (langsung atau via proxy).
            $isHttps = $request->isSecure()
                || strtolower((string) $request->headers->get('X-Forwarded-Proto')) === 'https';

            if ($isHttps) {
                $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
            }
        }

        return $response;
    }

    private function buildCsp(): string
    {
        $directives = [
            "default-src 'self'",
            "img-src 'self' data: blob: https:",
            "style-src 'self' 'unsafe-inline'",
            "script-src 'self' 'unsafe-inline'",
            "script-src-attr 'unsafe-inline'",
            "connect-src 'self' https:",
            "font-src 'self' data: https:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "block-all-mixed-content",
        ];

        return implode('; ', $directives);
    }
}
