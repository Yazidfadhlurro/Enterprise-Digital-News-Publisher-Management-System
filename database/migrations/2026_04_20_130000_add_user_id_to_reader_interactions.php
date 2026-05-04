<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('comments') && !Schema::hasColumn('comments', 'user_id')) {
            Schema::table('comments', function (Blueprint $table) {
                $table->foreignId('user_id')
                    ->nullable()
                    ->after('reader_id')
                    ->constrained('users')
                    ->nullOnDelete();
            });
        }

        if (Schema::hasTable('likes') && !Schema::hasColumn('likes', 'user_id')) {
            Schema::table('likes', function (Blueprint $table) {
                $table->foreignId('user_id')
                    ->nullable()
                    ->after('reader_id')
                    ->constrained('users')
                    ->nullOnDelete();

                $table->unique(['user_id', 'article_id'], 'likes_user_article_unique');
            });
        }

        if (Schema::hasTable('bookmarks') && !Schema::hasColumn('bookmarks', 'user_id')) {
            Schema::table('bookmarks', function (Blueprint $table) {
                $table->foreignId('user_id')
                    ->nullable()
                    ->after('reader_id')
                    ->constrained('users')
                    ->nullOnDelete();

                $table->unique(['user_id', 'article_id'], 'bookmarks_user_article_unique');
            });
        }

        if (Schema::hasTable('article_ratings') && !Schema::hasColumn('article_ratings', 'user_id')) {
            Schema::table('article_ratings', function (Blueprint $table) {
                $table->foreignId('user_id')
                    ->nullable()
                    ->after('reader_id')
                    ->constrained('users')
                    ->nullOnDelete();

                $table->unique(['article_id', 'user_id'], 'article_ratings_article_user_unique');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('article_ratings') && Schema::hasColumn('article_ratings', 'user_id')) {
            Schema::table('article_ratings', function (Blueprint $table) {
                $table->dropUnique('article_ratings_article_user_unique');
                $table->dropConstrainedForeignId('user_id');
            });
        }

        if (Schema::hasTable('bookmarks') && Schema::hasColumn('bookmarks', 'user_id')) {
            Schema::table('bookmarks', function (Blueprint $table) {
                $table->dropUnique('bookmarks_user_article_unique');
                $table->dropConstrainedForeignId('user_id');
            });
        }

        if (Schema::hasTable('likes') && Schema::hasColumn('likes', 'user_id')) {
            Schema::table('likes', function (Blueprint $table) {
                $table->dropUnique('likes_user_article_unique');
                $table->dropConstrainedForeignId('user_id');
            });
        }

        if (Schema::hasTable('comments') && Schema::hasColumn('comments', 'user_id')) {
            Schema::table('comments', function (Blueprint $table) {
                $table->dropConstrainedForeignId('user_id');
            });
        }
    }
};
