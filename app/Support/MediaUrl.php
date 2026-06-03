<?php

namespace App\Support;

class MediaUrl
{
    public static function resolve(?string $path): ?string
    {
        $path = trim((string) ($path ?? ''));
        if ($path === '') {
            return null;
        }

        if (preg_match('#^https?://#i', $path)) {
            return $path;
        }

        $normalized = ltrim(str_replace('\\', '/', $path), '/');

        // Strip leading "storage/" prefix so we can build a consistent relative URL
        if (str_starts_with($normalized, 'storage/')) {
            $normalized = substr($normalized, strlen('storage/'));
        }

        // Return a root-relative URL so it works regardless of APP_URL domain value
        return '/storage/' . $normalized;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public static function withFeaturedImageUrl(array $payload): array
    {
        if (array_key_exists('featured_image', $payload)) {
            $payload['featured_image_url'] = self::resolve(
                is_string($payload['featured_image'] ?? null) ? $payload['featured_image'] : null
            );
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public static function withFileUrl(array $payload, string $pathKey = 'file_path', string $urlKey = 'url'): array
    {
        if (array_key_exists($pathKey, $payload)) {
            $payload[$urlKey] = self::resolve(
                is_string($payload[$pathKey] ?? null) ? $payload[$pathKey] : null
            );
        }

        return $payload;
    }
}
