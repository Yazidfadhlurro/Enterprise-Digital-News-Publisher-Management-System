<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class CachedLookups
{
    private const ACTIVE_CATEGORIES_KEY = 'lookups.categories.active.v1';
    private const ACTIVE_CATEGORIES_TTL_SECONDS = 21600;

    public static function activeCategories()
    {
        $payload = Cache::remember(self::ACTIVE_CATEGORIES_KEY, self::ACTIVE_CATEGORIES_TTL_SECONDS, function () {
            return DB::table('categories')
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(function ($category) {
                    return [
                        'id' => (int) $category->id,
                        'name' => $category->name,
                    ];
                })
                ->values()
                ->all();
        });

        return collect(is_array($payload) ? $payload : []);
    }

    public static function forgetActiveCategories(): void
    {
        Cache::forget(self::ACTIVE_CATEGORIES_KEY);
    }
}
