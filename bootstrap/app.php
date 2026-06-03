<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Trust all proxies (Railway/Render sit behind a load balancer)
        

        $middleware->web(replace: [
            \Illuminate\Cookie\Middleware\EncryptCookies::class => \App\Http\Middleware\EncryptCookies::class,
        ]);

        // Global input sanitization: strips null bytes, control characters from all requests.
        $middleware->api(append: [
            \App\Http\Middleware\NormalizeCsrfToken::class,
            \App\Http\Middleware\SanitizeInput::class,
        ]);

        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureUserHasRole::class,
            'auth-scope' => \App\Http\Middleware\EnsureAuthScope::class,
            'action-permission' => \App\Http\Middleware\EnsureActionPermission::class,
            'throttle-role' => \App\Http\Middleware\ThrottleByRole::class,
            'active-account' => \App\Http\Middleware\EnsureUserIsActive::class,
        ]);

        // Security headers on all responses (X-Content-Type-Options, X-Frame-Options, CSP, etc.)
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
