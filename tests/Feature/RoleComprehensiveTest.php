<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class RoleComprehensiveTest extends TestCase
{
    use RefreshDatabase;

    private function createAdmin(): User
    {
        return User::factory()->create([
            'name' => 'Comprehensive Admin',
            'email' => 'comp.admin@portal.test',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'auth_scope' => 'internal',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);
    }

    private function createAuthor(): User
    {
        return User::factory()->create([
            'name' => 'Comprehensive Author',
            'email' => 'comp.author@portal.test',
            'password' => Hash::make('password'),
            'role' => 'author',
            'auth_scope' => 'internal',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);
    }

    private function createReviewer(): User
    {
        return User::factory()->create([
            'name' => 'Comprehensive Reviewer',
            'email' => 'comp.reviewer@portal.test',
            'password' => Hash::make('password'),
            'role' => 'reviewer',
            'auth_scope' => 'internal',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);
    }

    private function createReader(): User
    {
        return User::factory()->create([
            'name' => 'Comprehensive Reader',
            'email' => 'comp.reader@portal.test',
            'password' => Hash::make('password'),
            'role' => 'user',
            'auth_scope' => 'public',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);
    }

    public function test_admin_feature_set(): void
    {
        $admin = $this->createAdmin();
        $this->actingAs($admin);

        // Dashboard
        $resp = $this->getJson('/api/admin/dashboard');
        $this->assertNotEquals(401, $resp->status(), 'Admin dashboard returned 401');

        // Users index
        $resp = $this->getJson('/api/admin/users');
        $this->assertNotEquals(401, $resp->status(), 'Admin users index returned 401');

        // Create a category
        $slug = 'comp-cat-' . time();
        $create = $this->postJson('/api/admin/categories', ['name' => 'Comp Cat', 'slug' => $slug]);
        $this->assertNotEquals(401, $create->status(), 'Admin create category returned 401');

        // Ensure category exists and API returns expected JSON shape from show
        $catId = $create->json('id') ?? DB::table('categories')->where('slug', $slug)->value('id');
        if ($catId) {
            $show = $this->getJson("/api/admin/categories/{$catId}");
            $show->assertOk();
            $show->assertJsonStructure(['id', 'name', 'slug']);
        }

        // Assignment matrix
        $resp = $this->getJson('/api/admin/assignments/matrix');
        $this->assertNotEquals(401, $resp->status(), 'Admin assignments matrix returned 401');

        // Activities
        $resp = $this->getJson('/api/admin/activities');
        $this->assertNotEquals(401, $resp->status(), 'Admin activities returned 401');

        // Invites endpoints
        $resp = $this->getJson('/api/admin/invites');
        $this->assertNotEquals(401, $resp->status(), 'Admin invites index returned 401');
        $resp = $this->postJson('/api/admin/invites', ['email' => 'invitee@portal.test']);
        $this->assertNotEquals(401, $resp->status(), 'Admin invites store returned 401');
    }

    public function test_author_feature_set(): void
    {
        $author = $this->createAuthor();
        $this->actingAs($author);

        // Dashboard
        $resp = $this->getJson('/api/author/dashboard');
        $this->assertNotEquals(401, $resp->status(), 'Author dashboard returned 401');

        // Categories list and create
        $resp = $this->getJson('/api/author/categories');
        $this->assertNotEquals(401, $resp->status(), 'Author categories returned 401');
        $resp = $this->postJson('/api/author/categories', ['name' => 'Author Cat']);
        $this->assertNotEquals(401, $resp->status(), 'Author create category returned 401');

        // Articles CRUD
        $slug = 'comp-article-' . time();
        $create = $this->postJson('/api/author/articles', ['title' => 'Comp Article', 'slug' => $slug, 'content' => '<p>x</p>']);
        $this->assertNotEquals(401, $create->status(), 'Author create article returned 401');
        $id = $create->json('id') ?? DB::table('articles')->where('slug', $slug)->value('id');
        if ($id) {
            $show = $this->getJson("/api/author/articles/{$id}");
            $this->assertNotEquals(401, $show->status(), 'Author show article returned 401');
            $show->assertJsonStructure(['id', 'title', 'slug', 'content']);
            $updateResp = $this->putJson("/api/author/articles/{$id}", ['title' => 'Updated']);
            $this->assertNotEquals(401, $updateResp->status(), 'Author update article returned 401');

            $deleteResp = $this->deleteJson("/api/author/articles/{$id}");
            $this->assertNotEquals(401, $deleteResp->status(), 'Author delete article returned 401');
        }
    }

    public function test_reviewer_feature_set(): void
    {
        $rev = $this->createReviewer();
        $this->actingAs($rev);

        // Dashboard
        $resp = $this->getJson('/api/reviewer/dashboard');
        $this->assertNotEquals(401, $resp->status(), 'Reviewer dashboard returned 401');

        // Activities
        $resp = $this->getJson('/api/reviewer/activities');
        $this->assertNotEquals(401, $resp->status(), 'Reviewer activities returned 401');

        // Review queue
        $resp = $this->getJson('/api/reviewer/articles');
        $this->assertNotEquals(401, $resp->status(), 'Reviewer articles returned 401');
    }

    public function test_permission_checks_for_admin_endpoints(): void
    {
        // Author should be forbidden on admin endpoints
        $author = $this->createAuthor();
        $this->actingAs($author);
        $this->getJson('/api/admin/users')->assertStatus(403);

        // Reviewer should be forbidden on admin endpoints
        $rev = $this->createReviewer();
        $this->actingAs($rev);
        $this->getJson('/api/admin/dashboard')->assertStatus(403);

        // Public reader should be forbidden on admin endpoints
        $reader = $this->createReader();
        $this->actingAs($reader);
        $this->postJson('/api/admin/categories', ['name' => 'x'])->assertStatus(403);
    }

    public function test_permission_checks_for_author_endpoints(): void
    {
        // Reader (public) should not access author internal endpoints
        $reader = $this->createReader();
        $this->actingAs($reader);
        $this->postJson('/api/author/articles', ['title' => 'x', 'slug' => 'x', 'content' => '<p>x</p>'])->assertStatus(403);
    }

    public function test_reader_feature_set(): void
    {
        $reader = $this->createReader();
        $this->actingAs($reader);

        // Create an article to interact with
        $author = User::factory()->create(['role' => 'author', 'auth_scope' => 'internal', 'status' => 'active', 'email_verified_at' => now()]);
        $articleId = DB::table('articles')->insertGetId([
            'author_id' => $author->id,
            'category_id' => null,
            'title' => 'Reader Article',
            'slug' => 'reader-article-' . time(),
            'excerpt' => 'x',
            'content' => '<p>x</p>',
            'status' => 'published',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Index
        $resp = $this->getJson('/api/user/articles');
        $this->assertNotEquals(401, $resp->status(), 'Reader articles index returned 401');

        // Show
        $resp = $this->getJson("/api/user/articles/{$articleId}");
        $this->assertNotEquals(401, $resp->status(), 'Reader article show returned 401');

        // Comments
        $resp = $this->postJson("/api/user/articles/{$articleId}/comments", ['body' => 'Nice']);
        $this->assertNotEquals(401, $resp->status(), 'Reader post comment returned 401');
        if ($resp->status() === 201 || $resp->status() === 200) {
            $resp->assertJsonStructure(['id', 'body', 'user_id']);
        }

        // Like / Bookmark / Rating
        $likeResp = $this->postJson("/api/user/articles/{$articleId}/like");
        $this->assertNotEquals(401, $likeResp->status(), 'Reader like returned 401');

        $bookmarkResp = $this->postJson("/api/user/articles/{$articleId}/bookmark");
        $this->assertNotEquals(401, $bookmarkResp->status(), 'Reader bookmark returned 401');

        $ratingResp = $this->postJson("/api/user/articles/{$articleId}/rating", ['score' => 4]);
        $this->assertNotEquals(401, $ratingResp->status(), 'Reader rating returned 401');

        // Bookmarks list
        $resp = $this->getJson('/api/user/bookmarks');
        $this->assertNotEquals(401, $resp->status(), 'Reader bookmarks returned 401');
    }
}
