<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $allowDemoSeeders = (bool) config('app.allow_demo_seeders', false);

        if (App::environment('production') && !$allowDemoSeeders) {
            throw new RuntimeException('Demo seeder diblokir di production. Set APP_ALLOW_DEMO_SEEDERS=true jika benar-benar diperlukan.');
        }

        $this->truncateTables([
            'author_assignment_activities',
            'article_views',
            'article_ratings',
            'registration_invites',
            'editorial_activities',
            'media_assets',
            'role_action_permissions',
            'article_versions',
            'likes',
            'bookmarks',
            'comments',
            'articles',
            'tags',
            'categories',
            'readers',
            'users',
            'personal_access_tokens',
            'password_reset_tokens',
            'cache',
            'cache_locks',
            'jobs',
            'job_batches',
            'failed_jobs',
            'sessions',
        ]);

        $now = now();

        DB::table('users')->insert([
            [
                'name' => 'Admin User',
                'email' => 'admin@portal.com',
                'password' => Hash::make('password'),
                'role' => 'admin',
                'auth_scope' => 'internal',
                'assigned_reviewer_id' => null,
                'status' => 'active',
                'email_verified_at' => $now,
                'email_verification_code' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Editor User',
                'email' => 'editor@portal.com',
                'password' => Hash::make('password'),
                'role' => 'reviewer',
                'auth_scope' => 'internal',
                'assigned_reviewer_id' => null,
                'status' => 'active',
                'email_verified_at' => $now,
                'email_verification_code' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        $reviewerId = DB::table('users')->where('email', 'editor@portal.com')->value('id');

        DB::table('users')->insert([
            [
                'name' => 'Author User',
                'email' => 'author@portal.com',
                'password' => Hash::make('password'),
                'role' => 'author',
                'auth_scope' => 'internal',
                'assigned_reviewer_id' => $reviewerId,
                'status' => 'active',
                'email_verified_at' => $now,
                'email_verification_code' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    /**
     * @param array<int, string> $tables
     */
    private function truncateTables(array $tables): void
    {
        Schema::disableForeignKeyConstraints();

        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->truncate();
            }
        }

        Schema::enableForeignKeyConstraints();
    }
}
