<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Users - All Roles
        DB::table('users')->insert([
            [
                'name' => 'Admin User',
                'email' => 'admin@portal.com',
                'password' => Hash::make('password'),
                'role' => 'admin',
                'status' => 'active',
                'email_verified_at' => now(),
                'email_verification_code' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Reviewer User',
                'email' => 'reviewer@portal.com',
                'password' => Hash::make('password'),
                'role' => 'reviewer',
                'status' => 'active',
                'email_verified_at' => now(),
                'email_verification_code' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Author User',
                'email' => 'author@portal.com',
                'password' => Hash::make('password'),
                'role' => 'author',
                'status' => 'active',
                'email_verified_at' => now(),
                'email_verification_code' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Regular User',
                'email' => 'user@portal.com',
                'password' => Hash::make('password'),
                'role' => 'user',
                'status' => 'active',
                'email_verified_at' => now(),
                'email_verification_code' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            // Test users untuk approval flow
            [
                'name' => 'Test Author (Inactive)',
                'email' => 'testauthor@portal.com',
                'password' => Hash::make('password'),
                'role' => 'author',
                'status' => 'inactive',
                'email_verified_at' => now(),
                'email_verification_code' => '123456',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Test Reviewer (Inactive)',
                'email' => 'testreviewer@portal.com',
                'password' => Hash::make('password'),
                'role' => 'reviewer',
                'status' => 'inactive',
                'email_verified_at' => now(),
                'email_verification_code' => '654321',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Suspended User',
                'email' => 'suspended@portal.com',
                'password' => Hash::make('password'),
                'role' => 'user',
                'status' => 'suspended',
                'email_verified_at' => now(),
                'email_verification_code' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        // Readers
        DB::table('readers')->insert([
            ['name' => 'Reader 1', 'email' => 'reader1@gmail.com', 'password' => Hash::make('password'), 'status' => 'active', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Reader 2', 'email' => 'reader2@gmail.com', 'password' => Hash::make('password'), 'status' => 'active', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Categories
        DB::table('categories')->insert([
            ['name' => 'Teknologi', 'slug' => 'teknologi', 'description' => 'Berita teknologi', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Bisnis', 'slug' => 'bisnis', 'description' => 'Berita bisnis', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Olahraga', 'slug' => 'olahraga', 'description' => 'Berita olahraga', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Tags
        DB::table('tags')->insert([
            ['name' => 'Trending', 'slug' => 'trending', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Viral', 'slug' => 'viral', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Breaking', 'slug' => 'breaking', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Articles
        DB::table('articles')->insert([
            [
                'author_id' => 3,
                'category_id' => 1,
                'title' => 'Perkembangan AI di Indonesia',
                'slug' => 'perkembangan-ai-di-indonesia',
                'excerpt' => 'Teknologi AI berkembang pesat di Indonesia',
                'content' => '<p>Teknologi AI semakin berkembang di Indonesia.</p>',
                'status' => 'published',
                'reviewer_id' => 2,
                'published_at' => now(),
                'is_featured' => true,
                'views_count' => 100,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'author_id' => 3,
                'category_id' => 2,
                'title' => 'Startup Lokal Raih Pendanaan',
                'slug' => 'startup-lokal-raih-pendanaan',
                'excerpt' => 'Startup Indonesia dapat pendanaan besar',
                'content' => '<p>Startup teknologi Indonesia berhasil raih pendanaan.</p>',
                'status' => 'pending',
                'reviewer_id' => null,
                'published_at' => null,
                'is_featured' => false,
                'views_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        // Article Tags
        DB::table('article_tag')->insert([
            ['article_id' => 1, 'tag_id' => 1],
            ['article_id' => 1, 'tag_id' => 2],
        ]);

        // Comments
        DB::table('comments')->insert([
            ['article_id' => 1, 'reader_id' => 1, 'parent_id' => null, 'content' => 'Artikel yang bagus!', 'status' => 'approved', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Likes
        DB::table('likes')->insert([
            ['reader_id' => 1, 'article_id' => 1, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Bookmarks
        DB::table('bookmarks')->insert([
            ['reader_id' => 1, 'article_id' => 1, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}
