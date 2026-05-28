<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

class ReaderCache
{
    public const INSIGHTS_KEY = 'reader.insights.global.v1';

    public static function forgetInsights(): void
    {
        Cache::forget(self::INSIGHTS_KEY);
    }

    public static function tagsKey(int $articleId): string
    {
        return "reader.article.tags.{$articleId}.v1";
    }

    public static function relatedKey(int $articleId): string
    {
        return "reader.article.related.{$articleId}.v1";
    }

    public static function ratingSummaryKey(int $articleId): string
    {
        return "reader.article.rating_summary.{$articleId}.v1";
    }

    public static function commentsTotalKey(int $articleId): string
    {
        return "reader.article.comments_total.{$articleId}.v1";
    }

    public static function forgetArticleCaches(int $articleId): void
    {
        Cache::forget(self::tagsKey($articleId));
        Cache::forget(self::relatedKey($articleId));
        Cache::forget(self::ratingSummaryKey($articleId));
        Cache::forget(self::commentsTotalKey($articleId));
    }

    public static function bookmarksCategoryOptionsKey(int $userId): string
    {
        return "reader.bookmarks.category_options.user.{$userId}.v1";
    }

    public static function forgetBookmarksCategoryOptions(int $userId): void
    {
        Cache::forget(self::bookmarksCategoryOptionsKey($userId));
    }
}
