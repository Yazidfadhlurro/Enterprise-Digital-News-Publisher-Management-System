<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('categories') && Schema::hasColumn('categories', 'is_active') && Schema::hasColumn('categories', 'name')) {
            Schema::table('categories', function (Blueprint $table) {
                $table->index(['is_active', 'name'], 'categories_active_name_idx');
            });
        }

        if (Schema::hasTable('articles')) {
            $hasStatus = Schema::hasColumn('articles', 'status');
            $hasCategoryId = Schema::hasColumn('articles', 'category_id');
            $hasPublishedAt = Schema::hasColumn('articles', 'published_at');
            $hasCreatedAt = Schema::hasColumn('articles', 'created_at');
            $hasReviewDueAt = Schema::hasColumn('articles', 'review_due_at');
            $hasAuthorId = Schema::hasColumn('articles', 'author_id');
            $hasUpdatedAt = Schema::hasColumn('articles', 'updated_at');

            Schema::table('articles', function (Blueprint $table) use (
                $hasStatus,
                $hasCategoryId,
                $hasPublishedAt,
                $hasCreatedAt,
                $hasReviewDueAt,
                $hasAuthorId,
                $hasUpdatedAt
            ) {
                if ($hasStatus && $hasPublishedAt && $hasCreatedAt) {
                    $table->index(['status', 'published_at', 'created_at'], 'articles_status_published_created_idx');
                }

                if ($hasStatus && $hasCategoryId && $hasPublishedAt) {
                    $table->index(['status', 'category_id', 'published_at'], 'articles_status_category_published_idx');
                }

                if ($hasStatus && $hasReviewDueAt) {
                    $table->index(['status', 'review_due_at'], 'articles_status_review_due_idx');
                }

                if ($hasAuthorId && $hasStatus && $hasUpdatedAt) {
                    $table->index(['author_id', 'status', 'updated_at'], 'articles_author_status_updated_idx');
                }
            });
        }

        if (Schema::hasTable('comments')) {
            $hasArticleId = Schema::hasColumn('comments', 'article_id');
            $hasStatus = Schema::hasColumn('comments', 'status');
            $hasCreatedAt = Schema::hasColumn('comments', 'created_at');

            if ($hasArticleId && $hasStatus && $hasCreatedAt) {
                Schema::table('comments', function (Blueprint $table) {
                    $table->index(['article_id', 'status', 'created_at'], 'comments_article_status_created_idx');
                });
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('comments') && Schema::hasColumn('comments', 'article_id') && Schema::hasColumn('comments', 'status') && Schema::hasColumn('comments', 'created_at')) {
            Schema::table('comments', function (Blueprint $table) {
                $table->dropIndex('comments_article_status_created_idx');
            });
        }

        if (Schema::hasTable('articles')) {
            $hasStatus = Schema::hasColumn('articles', 'status');
            $hasCategoryId = Schema::hasColumn('articles', 'category_id');
            $hasPublishedAt = Schema::hasColumn('articles', 'published_at');
            $hasCreatedAt = Schema::hasColumn('articles', 'created_at');
            $hasReviewDueAt = Schema::hasColumn('articles', 'review_due_at');
            $hasAuthorId = Schema::hasColumn('articles', 'author_id');
            $hasUpdatedAt = Schema::hasColumn('articles', 'updated_at');

            Schema::table('articles', function (Blueprint $table) use (
                $hasStatus,
                $hasCategoryId,
                $hasPublishedAt,
                $hasCreatedAt,
                $hasReviewDueAt,
                $hasAuthorId,
                $hasUpdatedAt
            ) {
                if ($hasAuthorId && $hasStatus && $hasUpdatedAt) {
                    $table->dropIndex('articles_author_status_updated_idx');
                }

                if ($hasStatus && $hasReviewDueAt) {
                    $table->dropIndex('articles_status_review_due_idx');
                }

                if ($hasStatus && $hasCategoryId && $hasPublishedAt) {
                    $table->dropIndex('articles_status_category_published_idx');
                }

                if ($hasStatus && $hasPublishedAt && $hasCreatedAt) {
                    $table->dropIndex('articles_status_published_created_idx');
                }
            });
        }

        if (Schema::hasTable('categories') && Schema::hasColumn('categories', 'is_active') && Schema::hasColumn('categories', 'name')) {
            Schema::table('categories', function (Blueprint $table) {
                $table->dropIndex('categories_active_name_idx');
            });
        }
    }
};
