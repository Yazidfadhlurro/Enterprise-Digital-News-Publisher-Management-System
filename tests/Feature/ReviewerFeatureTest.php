<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ReviewerFeatureTest extends TestCase
{
    use RefreshDatabase;

    private function reviewer(): User
    {
        return User::factory()->create([
            'role' => 'reviewer', 'auth_scope' => 'internal',
            'status' => 'active', 'email_verified_at' => now(),
        ]);
    }

    private function author(int $reviewerId): User
    {
        return User::factory()->create([
            'role' => 'author', 'auth_scope' => 'internal',
            'status' => 'active', 'email_verified_at' => now(),
            'assigned_reviewer_id' => $reviewerId,
        ]);
    }

    private function makePendingArticle(int $authorId, int $reviewerId): int
    {
        $catId = DB::table('categories')->insertGetId([
            'name' => 'Cat ' . uniqid(), 'slug' => 'cat-' . uniqid(),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return DB::table('articles')->insertGetId([
            'author_id' => $authorId,
            'reviewer_id' => $reviewerId,
            'category_id' => $catId,
            'title' => 'Pending Article Judul Panjang ' . uniqid(), // ≥12 char
            'slug' => 'pending-' . uniqid(),
            'excerpt' => str_repeat('Ringkasan artikel ini cukup panjang untuk memenuhi syarat editorial. ', 2), // ≥80 char
            'content' => '<p>' . str_repeat('Konten artikel ini sangat panjang dan informatif untuk pembaca. ', 6) . '</p>', // ≥300 char
            'featured_image' => 'storage/articles/test.jpg',
            'featured_image_alt' => 'Gambar unggulan artikel',
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    // ── Dashboard ──────────────────────────────────────────────────────────

    public function test_reviewer_dashboard_returns_ok(): void
    {
        $this->actingAs($this->reviewer());
        $this->getJson('/api/reviewer/dashboard')->assertOk()
            ->assertJsonStructure(['data' => ['metrics']]);
    }

    // ── Review Queue ───────────────────────────────────────────────────────

    public function test_reviewer_can_list_review_queue(): void
    {
        $rev = $this->reviewer();
        $author = $this->author($rev->id);
        $this->makePendingArticle($author->id, $rev->id);
        $this->actingAs($rev);
        $resp = $this->getJson('/api/reviewer/articles');
        $resp->assertOk()->assertJsonStructure(['data' => ['articles']]);
    }

    public function test_reviewer_can_show_article_detail(): void
    {
        $rev = $this->reviewer();
        $author = $this->author($rev->id);
        $id = $this->makePendingArticle($author->id, $rev->id);
        $this->actingAs($rev);
        $this->getJson("/api/reviewer/articles/{$id}")->assertOk()
            ->assertJsonStructure(['data' => ['article']]);
    }

    public function test_reviewer_can_approve_article(): void
    {
        $rev = $this->reviewer();
        $author = $this->author($rev->id);
        $id = $this->makePendingArticle($author->id, $rev->id);
        $this->actingAs($rev);
        $this->postJson("/api/reviewer/articles/{$id}/approve")
            ->assertOk()->assertJsonPath('status', 'success');
        $this->assertDatabaseHas('articles', ['id' => $id, 'status' => 'published']);
    }

    public function test_reviewer_can_reject_article(): void
    {
        $rev = $this->reviewer();
        $author = $this->author($rev->id);
        $id = $this->makePendingArticle($author->id, $rev->id);
        $this->actingAs($rev);
        $this->postJson("/api/reviewer/articles/{$id}/reject", ['note' => 'Needs work'])
            ->assertOk()->assertJsonPath('status', 'success');
        $this->assertDatabaseHas('articles', ['id' => $id, 'status' => 'revision']);
    }

    public function test_reviewer_cannot_approve_non_pending_article(): void
    {
        $rev = $this->reviewer();
        $author = $this->author($rev->id);
        $id = DB::table('articles')->insertGetId([
            'author_id' => $author->id, 'reviewer_id' => $rev->id,
            'title' => 'Draft', 'slug' => 'draft-' . uniqid(),
            'content' => '<p>x</p>', 'status' => 'draft',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->actingAs($rev);
        $this->postJson("/api/reviewer/articles/{$id}/approve")->assertStatus(422);
    }

    public function test_reviewer_only_sees_assigned_authors_articles(): void
    {
        $rev1 = $this->reviewer();
        $rev2 = $this->reviewer();
        $author1 = $this->author($rev1->id);
        $author2 = $this->author($rev2->id);

        $id1 = $this->makePendingArticle($author1->id, $rev1->id);
        $this->makePendingArticle($author2->id, $rev2->id);

        $this->actingAs($rev1);
        $resp = $this->getJson('/api/reviewer/articles');
        $resp->assertOk();
        $ids = collect($resp->json('data.articles'))->pluck('id')->all();
        $this->assertContains($id1, $ids);
    }

    // ── Activities ─────────────────────────────────────────────────────────

    public function test_reviewer_can_view_activities(): void
    {
        $this->actingAs($this->reviewer());
        $this->getJson('/api/reviewer/activities')->assertOk()
            ->assertJsonStructure(['data' => ['activities']]);
    }

    // ── Feedback ───────────────────────────────────────────────────────────

    public function test_reviewer_can_view_feedback(): void
    {
        $this->actingAs($this->reviewer());
        $this->getJson('/api/reviewer/feedback')->assertOk();
    }

    // ── Access Control ─────────────────────────────────────────────────────

    public function test_author_cannot_access_reviewer_approve(): void
    {
        $rev = $this->reviewer();
        $author = $this->author($rev->id);
        $id = $this->makePendingArticle($author->id, $rev->id);
        $this->actingAs($author);
        $this->postJson("/api/reviewer/articles/{$id}/approve")->assertStatus(403);
    }

    public function test_unauthenticated_cannot_access_reviewer_routes(): void
    {
        $this->getJson('/api/reviewer/dashboard')->assertStatus(401);
        $this->getJson('/api/reviewer/articles')->assertStatus(401);
    }
}
