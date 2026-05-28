<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Security & edge-case tests:
 * - IDOR (cross-user data access)
 * - Role bypass attempts
 * - Input validation / injection
 * - Suspended/inactive account blocking
 * - Pagination & filter edge cases
 * - Auth: wrong password, unverified email
 * - Workflow state machine enforcement
 */
class SecurityEdgeCaseTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role, string $scope = 'internal', string $status = 'active', bool $verified = true): User
    {
        return User::factory()->create([
            'role' => $role,
            'auth_scope' => $scope,
            'status' => $status,
            'email_verified_at' => $verified ? now() : null,
        ]);
    }

    private function makeReviewer(): User { return $this->makeUser('reviewer'); }
    private function makeAuthor(?int $revId = null): User
    {
        return User::factory()->create([
            'role' => 'author', 'auth_scope' => 'internal',
            'status' => 'active', 'email_verified_at' => now(),
            'assigned_reviewer_id' => $revId,
        ]);
    }

    private function makeArticle(int $authorId, string $status = 'draft', ?int $catId = null): int
    {
        return DB::table('articles')->insertGetId([
            'author_id' => $authorId, 'category_id' => $catId,
            'title' => 'Article ' . uniqid(), 'slug' => 'art-' . uniqid(),
            'content' => '<p>body</p>', 'status' => $status,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function makePublished(int $authorId): int
    {
        return DB::table('articles')->insertGetId([
            'author_id' => $authorId, 'title' => 'Pub ' . uniqid(),
            'slug' => 'pub-' . uniqid(), 'content' => '<p>x</p>',
            'status' => 'published', 'published_at' => now(),
            'views_count' => 0, 'is_featured' => false,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    // ── IDOR: Author cannot access another author's article ────────────────

    public function test_author_idor_show(): void
    {
        $a1 = $this->makeAuthor();
        $a2 = $this->makeAuthor();
        $id = $this->makeArticle($a1->id);
        $this->actingAs($a2);
        $this->getJson("/api/author/articles/{$id}")->assertStatus(404);
    }

    public function test_author_idor_update(): void
    {
        $a1 = $this->makeAuthor();
        $a2 = $this->makeAuthor();
        $id = $this->makeArticle($a1->id);
        $this->actingAs($a2);
        $this->putJson("/api/author/articles/{$id}", ['title' => 'Hacked'])->assertStatus(404);
    }

    public function test_author_idor_delete(): void
    {
        $a1 = $this->makeAuthor();
        $a2 = $this->makeAuthor();
        $id = $this->makeArticle($a1->id);
        $this->actingAs($a2);
        $this->deleteJson("/api/author/articles/{$id}")->assertStatus(404);
    }

    public function test_author_idor_autosave(): void
    {
        $a1 = $this->makeAuthor();
        $a2 = $this->makeAuthor();
        $id = $this->makeArticle($a1->id);
        $this->actingAs($a2);
        $this->postJson("/api/author/articles/{$id}/autosave", ['title' => 'x'])->assertStatus(404);
    }

    public function test_author_idor_versions(): void
    {
        $a1 = $this->makeAuthor();
        $a2 = $this->makeAuthor();
        $id = $this->makeArticle($a1->id);
        $this->actingAs($a2);
        $this->getJson("/api/author/articles/{$id}/versions")->assertStatus(404);
    }

    // ── IDOR: Reviewer cannot approve article outside assignment ──────────

    public function test_reviewer_idor_approve(): void
    {
        $rev1 = $this->makeReviewer();
        $rev2 = $this->makeReviewer();
        $author = $this->makeAuthor($rev1->id);
        $id = $this->makeArticle($author->id, 'pending');
        $this->actingAs($rev2);
        $this->postJson("/api/reviewer/articles/{$id}/approve")->assertStatus(403);
    }

    public function test_reviewer_idor_reject(): void
    {
        $rev1 = $this->makeReviewer();
        $rev2 = $this->makeReviewer();
        $author = $this->makeAuthor($rev1->id);
        $id = $this->makeArticle($author->id, 'pending');
        $this->actingAs($rev2);
        $this->postJson("/api/reviewer/articles/{$id}/reject")->assertStatus(403);
    }

    // ── Role bypass: public user tries internal endpoints ─────────────────

    public function test_reader_cannot_create_article(): void
    {
        $this->actingAs($this->makeUser('user', 'public'));
        $this->postJson('/api/author/articles', ['title' => 'x', 'content' => '<p>x</p>'])
            ->assertStatus(403);
    }

    public function test_reader_cannot_access_admin(): void
    {
        $this->actingAs($this->makeUser('user', 'public'));
        $this->getJson('/api/admin/dashboard')->assertStatus(403);
        $this->getJson('/api/admin/users')->assertStatus(403);
    }

    public function test_reader_cannot_access_reviewer_routes(): void
    {
        $this->actingAs($this->makeUser('user', 'public'));
        $this->getJson('/api/reviewer/articles')->assertStatus(403);
    }

    public function test_author_cannot_access_reviewer_routes(): void
    {
        $this->actingAs($this->makeAuthor());
        $this->getJson('/api/reviewer/articles')->assertStatus(403);
    }

    public function test_reviewer_cannot_access_admin_routes(): void
    {
        $this->actingAs($this->makeReviewer());
        $this->getJson('/api/admin/users')->assertStatus(403);
        $this->postJson('/api/admin/categories', ['name' => 'x'])->assertStatus(403);
    }

    // ── Suspended account blocked ─────────────────────────────────────────

    public function test_suspended_user_blocked_on_all_routes(): void
    {
        $suspended = $this->makeUser('author', 'internal', 'suspended');
        $this->actingAs($suspended);
        $this->getJson('/api/author/dashboard')->assertStatus(403);
        $this->getJson('/api/auth/me')->assertStatus(403);
    }

    // ── Workflow state machine ─────────────────────────────────────────────

    public function test_author_cannot_edit_published_article(): void
    {
        $author = $this->makeAuthor();
        $id = $this->makeArticle($author->id, 'published');
        $this->actingAs($author);
        $this->putJson("/api/author/articles/{$id}", ['title' => 'New'])->assertStatus(422);
    }

    public function test_author_cannot_delete_published_article(): void
    {
        $author = $this->makeAuthor();
        $id = $this->makeArticle($author->id, 'published');
        $this->actingAs($author);
        $this->deleteJson("/api/author/articles/{$id}")->assertStatus(422);
    }

    public function test_author_cannot_delete_pending_article(): void
    {
        $rev = $this->makeReviewer();
        $author = $this->makeAuthor($rev->id);
        $id = $this->makeArticle($author->id, 'pending');
        $this->actingAs($author);
        $this->deleteJson("/api/author/articles/{$id}")->assertStatus(422);
    }

    public function test_reviewer_cannot_approve_draft(): void
    {
        $rev = $this->makeReviewer();
        $author = $this->makeAuthor($rev->id);
        $id = $this->makeArticle($author->id, 'draft');
        $this->actingAs($rev);
        $this->postJson("/api/reviewer/articles/{$id}/approve")->assertStatus(422);
    }

    public function test_reviewer_cannot_approve_published(): void
    {
        $rev = $this->makeReviewer();
        $author = $this->makeAuthor($rev->id);
        $id = $this->makeArticle($author->id, 'published');
        $this->actingAs($rev);
        $this->postJson("/api/reviewer/articles/{$id}/approve")->assertStatus(422);
    }

    // ── Input validation / injection ──────────────────────────────────────

    public function test_category_name_cannot_be_empty(): void
    {
        $this->actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/categories', ['name' => ''])->assertStatus(422);
        $this->postJson('/api/admin/categories', ['name' => '   '])->assertStatus(422);
    }

    public function test_article_invalid_category_id_rejected(): void
    {
        $this->actingAs($this->makeAuthor());
        $this->postJson('/api/author/articles', [
            'title' => 'Test', 'content' => '<p>x</p>', 'category_id' => 99999,
        ])->assertStatus(422);
    }

    public function test_rating_requires_integer(): void
    {
        $author = $this->makeAuthor();
        $id = $this->makePublished($author->id);
        $this->actingAs($this->makeUser('user', 'public'));
        $this->postJson("/api/user/articles/{$id}/rating", ['rating' => 'abc'])->assertStatus(422);
        $this->postJson("/api/user/articles/{$id}/rating", [])->assertStatus(422);
    }

    public function test_comment_too_short_rejected(): void
    {
        $author = $this->makeAuthor();
        $id = $this->makePublished($author->id);
        $this->actingAs($this->makeUser('user', 'public'));
        $this->postJson("/api/user/articles/{$id}/comments", ['content' => 'x'])->assertStatus(422);
    }

    public function test_comment_too_long_rejected(): void
    {
        $author = $this->makeAuthor();
        $id = $this->makePublished($author->id);
        $this->actingAs($this->makeUser('user', 'public'));
        $this->postJson("/api/user/articles/{$id}/comments", [
            'content' => str_repeat('a', 1001),
        ])->assertStatus(422);
    }

    // ── Pagination & filter ────────────────────────────────────────────────

    public function test_articles_per_page_capped_at_50(): void
    {
        $this->actingAs($this->makeUser('admin'));
        $resp = $this->getJson('/api/admin/articles?per_page=999');
        $resp->assertOk();
        $this->assertLessThanOrEqual(50, $resp->json('data.pagination.per_page'));
    }

    public function test_users_search_filter_works(): void
    {
        $this->makeUser('author');
        $this->actingAs($this->makeUser('admin'));
        $resp = $this->getJson('/api/admin/users?q=nonexistentxyz123');
        $resp->assertOk();
        $this->assertCount(0, $resp->json('data.users'));
    }

    public function test_users_role_filter_works(): void
    {
        $this->makeUser('reviewer');
        $this->actingAs($this->makeUser('admin'));
        $resp = $this->getJson('/api/admin/users?role=reviewer');
        $resp->assertOk();
        foreach ($resp->json('data.users') as $u) {
            $this->assertEquals('reviewer', $u['role']);
        }
    }

    // ── Non-existent resources ─────────────────────────────────────────────

    public function test_admin_show_nonexistent_user_returns_404(): void
    {
        $this->actingAs($this->makeUser('admin'));
        $this->getJson('/api/admin/users/99999')->assertStatus(404);
    }

    public function test_admin_show_nonexistent_category_returns_404(): void
    {
        $this->actingAs($this->makeUser('admin'));
        $this->getJson('/api/admin/categories/99999')->assertStatus(404);
    }

    public function test_reader_show_nonexistent_article_returns_404(): void
    {
        $this->actingAs($this->makeUser('user', 'public'));
        $this->getJson('/api/user/articles/99999')->assertStatus(404);
    }

    public function test_reviewer_show_nonexistent_article_returns_404(): void
    {
        $this->actingAs($this->makeReviewer());
        $this->getJson('/api/reviewer/articles/99999')->assertStatus(404);
    }

    // ── Unauthenticated fallback ───────────────────────────────────────────

    public function test_unknown_api_route_returns_404_json(): void
    {
        $this->getJson('/api/nonexistent/route')->assertStatus(404)
            ->assertJsonPath('status', 'error');
    }

    public function test_all_protected_routes_require_auth(): void
    {
        $routes = [
            ['GET', '/api/auth/me'],
            ['GET', '/api/admin/dashboard'],
            ['GET', '/api/author/dashboard'],
            ['GET', '/api/reviewer/dashboard'],
            ['GET', '/api/user/articles'],
        ];
        foreach ($routes as [$method, $path]) {
            $resp = $this->json($method, $path);
            $this->assertEquals(401, $resp->status(), "{$method} {$path} should return 401");
        }
    }
}
