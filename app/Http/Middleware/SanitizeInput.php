<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Global input sanitization middleware.
 *
 * Strips null bytes and dangerous control characters from all
 * string inputs before they reach controllers. This is a defence-in-depth
 * layer against SQL injection, XSS, and header injection.
 */
class SanitizeInput
{
    /**
     * Fields excluded from sanitization (binary or rich-text content).
     */
    private const EXCLUDED_FIELDS = [
        'password',
        'password_confirmation',
        'current_password',
        'content',        // Rich-text: handled by HTMLPurifier in ContentSanitizer
        'avatar',         // May be a file or base64
    ];

    public function handle(Request $request, Closure $next)
    {
        $input = $request->all();

        $sanitized = $this->sanitizeArray($input);

        $request->merge($sanitized);

        return $next($request);
    }

    private function sanitizeArray(array $data): array
    {
        $result = [];

        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $result[$key] = $this->sanitizeArray($value);
                continue;
            }

            if (!is_string($value) || in_array($key, self::EXCLUDED_FIELDS, true)) {
                $result[$key] = $value;
                continue;
            }

            $result[$key] = $this->sanitizeString($value);
        }

        return $result;
    }

    private function sanitizeString(string $value): string
    {

        $value = str_replace("\0", '', $value);

        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value) ?? $value;

        return $value;
    }
}
