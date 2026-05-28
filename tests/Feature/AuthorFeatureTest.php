<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AuthorFeatureTest extends TestCase
{
    use RefreshDatabase;

    private function reviewer(): User
    {
        return User::factory()->create([
            'role' => 'reviewer', 'auth_scope' => 'internal',
            'status' => 'active', 'email_verified_at' => now(),
        ]);
    }

    private function author(?int $reviewerId = null): User
    {
        return User::factory()->create([
            'role' => 'author', 'auth_scope' => 'internal',
            'status' => 'active', 'email_verified_at' => now(),
            'assigned_reviewer_id' => $reviewerId,
        ]);
    }

    private function makeCategory(): int
    {
        return DB::table('categories')->insertGetId([
            'name' => 'Test Cat', 'slug' => 'test-cat-' . uniqid(),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    // ── Dashboard ──────────────────────────────────────────────────────────

    public function test_author_dashboard_returns_ok(): void
    {
        $this->actingAs($this->author());
        $this->getJson('/api/author/dashboard')->assertOk()
            ->assertJsonStructure(['data' => ['metrics', 'articles']]);
    }

    // ── Categories ─────────────────────────────────────────────────────────

    public function test_author_can_list_categories(): void
    {
        $this->actingAs($this->author());
        $this->getJson('/api/author/categories')->assertOk()
            ->assertJsonStructure(['data' => ['categories']]);
    }

    public function test_author_can_create_category(): void
    {
        $this->actingAs($this->author());
        $this->postJson('/api/author/categories', ['name' => 'My Cat'])
            ->assertStatus(201)->assertJsonPath('status', 'success');
    }

    public function test_author_category_duplicate_name_rejected(): void
    {
        $this->actingAs($this->author());
        $this->postJson('/api/author/categories', ['name' => 'Dup Cat'])->assertStatus(201);
        $this->postJson('/api/author/categories', ['name' => 'Dup Cat'])->assertStatus(422);
    }

    // ── Article CRUD ───────────────────────────────────────────────────────

    public function test_author_can_create_draft_article(): void
    {
        $this->actingAs($this->author());
        $resp = $this->postJson('/api/author/articles', [
            'title' => 'My Draft',
            'content' => '<p>Hello</p>',
        ]);
        $resp->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonStructure(['id', 'title', 'slug']);
        $this->assertDatabaseHas('articles', ['title' => 'My Draft', 'status' => 'draft']);
    }

    public function test_author_can_create_article_with_category(): void
    {
        $catId = $this->makeCategory();
        $this->actingAs($this->author());
        $resp = $this->postJson('/api/author/articles', [
            'title' => 'Cat Article',
            'content' => '<p>body</p>',
            'category_id' => $catId,
        ]);
        $resp->assertStatus(201);
        $this->assertDatabaseHas('articles', ['title' => 'Cat Article', 'category_id' => $catId]);
    }

    public function test_author_can_submit_article_for_review(): void
    {
        $rev = $this->reviewer();
        $author = $this->author($rev->id);
        $this->actingAs($author);
        $resp = $this->postJson('/api/author/articles', [
            'title' => 'Submit Article',
            'content' => '<p>body</p>',
            'status' => 'pending',
        ]);
        $resp->assertStatus(201);
        $this->assertDatabaseHas('articles', ['title' => 'Submit Article', 'status' => 'pending']);
    }

    public function test_author_cannot_submit_without_reviewer(): void
    {
        $author = $this->author(null); // no reviewer assigned
        $this->actingAs($author);
        $this->postJson('/api/author/articles', [
            'title' => 'No Reviewer',
            'content' => '<p>body</p>',
            'status' => 'pending',
        ])->assertStatus(422);
    }

    public function test_author_can_list_own_articles(): void
    {
        $author = $this->author();
        $this->actingAs($author);
        DB::table('articles')->insert([
            'author_id' => $author->id, 'title' => 'Listed', 'slug' => 'listed-' . uniqid(),
            'content' => '<p>x</p>', 'status' => 'draft', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $resp = $this->getJson('/api/author/articles');
        $resp->assertOk()->assertJsonStructure(['data' => ['articles', 'pagination']]);
        $this->assertGreaterThan(0, count($resp->json('data.articles')));
    }

    public function test_author_can_show_own_article(): void
    {
        $author = $this->author();
        $this->actingAs($author);
        $id = DB::table('articles')->insertGetId([
            'author_id' => $author->id, 'title' => 'Show Me', 'slug' => 'show-me-' . uniqid(),
            'content' => '<p>x</p>', 'status' => 'draft', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->getJson("/api/author/articles/{$id}")->assertOk()
            ->assertJsonPath('id', $id);
    }

    public function test_author_cannot_see_other_authors_article(): void
    {
        $other = $this->author();
        $id = DB::table('articles')->insertGetId([
            'author_id' => $other->id, 'title' => 'Other', 'slug' => 'other-' . uniqid(),
            'content' => '<p>x</p>', 'status' => 'draft', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->actingAs($this->author());
        $this->getJson("/api/author/articles/{$id}")->assertStatus(404);
    }

    public function test_author_can_update_draft_article(): void
    {
        $author = $this->author();
        $this->actingAs($author);
        $id = DB::table('articles')->insertGetId([
            'author_id' => $author->id, 'title' => 'Old Title', 'slug' => 'old-title-' . uniqid(),
            'content' => '<p>x</p>', 'status' => 'draft', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->putJson("/api/author/articles/{$id}", ['title' => 'New Title'])
            ->assertOk()->assertJsonPath('status', 'success');
        $this->assertDatabaseHas('articles', ['id' => $id, 'title' => 'New Title']);
    }

    public function test_author_cannot_update_pending_article(): void
    {
        $rev = $this->reviewer();
        $author = $this->author($rev->id);
        $this->actingAs($author);
        $id = DB::table('articles')->insertGetId([
            'author_id' => $author->id, 'title' => 'Pending', 'slug' => 'pending-' . uniqid(),
            'content' => '<p>x</p>', 'status' => 'pending', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->putJson("/api/author/articles/{$id}", ['title' => 'Changed'])->assertStatus(422);
    }

    public function test_author_can_delete_draft_article(): void
    {
        $author = $this->author();
        $this->actingAs($author);
        $id = DB::table('articles')->insertGetId([
            'author_id' => $author->id, 'title' => 'Delete Me', 'slug' => 'delete-me-' . uniqid(),
            'content' => '<p>x</p>', 'status' => 'draft', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->deleteJson("/api/author/articles/{$id}")->assertOk();
        $this->assertDatabaseMissing('articles', ['id' => $id]);
    }

    public function test_author_cannot_delete_other_authors_article(): void
    {
        $other = $this->author();
        $id = DB::table('articles')->insertGetId([
            'author_id' => $other->id, 'title' => 'Not Mine', 'slug' => 'not-mine-' . uniqid(),
            'content' => '<p>x</p>', 'status' => 'draft', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->actingAs($this->author());
        $this->deleteJson("/api/author/articles/{$id}")->assertStatus(404);
    }

    // ── Autosave ───────────────────────────────────────────────────────────

    public function test_author_can_autosave_draft(): void
    {
        $author = $this->author();
        $this->actingAs($author);
        $id = DB::table('articles')->insertGetId([
            'author_id' => $author->id, 'title' => 'Autosave', 'slug' => 'autosave-' . uniqid(),
            'content' => '<p>x</p>', 'status' => 'draft', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->postJson("/api/author/articles/{$id}/autosave", ['title' => 'Autosaved Title'])
            ->assertOk()->assertJsonPath('status', 'success');
    }

    public function test_author_cannot_autosave_published_article(): void
    {
        $author = $this->author();
        $this->actingAs($author);
        $id = DB::table('articles')->insertGetId([
            'author_id' => $author->id, 'title' => 'Published', 'slug' => 'pub-' . uniqid(),
            'content' => '<p>x</p>', 'status' => 'published', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->postJson("/api/author/articles/{$id}/autosave", ['title' => 'Try'])->assertStatus(422);
    }

    // ── Versions ───────────────────────────────────────────────────────────

    public function test_author_can_view_article_versions(): void
    {
        $author = $this->author();
        $this->actingAs($author);
        $id = DB::table('articles')->insertGetId([
            'author_id' => $author->id, 'title' => 'Versioned', 'slug' => 'versioned-' . uniqid(),
            'content' => '<p>x</p>', 'status' => 'draft', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->getJson("/api/author/articles/{$id}/versions")->assertOk()
            ->assertJsonStructure(['data' => ['versions']]);
    }

    // ── Activities ─────────────────────────────────────────────────────────

    public function test_author_can_view_activities(): void
    {
        $this->actingAs($this->author());
        $this->getJson('/api/author/activities')->assertOk()
            ->assertJsonStructure(['data' => ['activities']]);
    }

    // ── Feedback ───────────────────────────────────────────────────────────

    public function test_author_can_view_feedback(): void
    {
        $this->actingAs($this->author());
        $this->getJson('/api/author/feedback')->assertOk();
    }

    // ── Access Control ─────────────────────────────────────────────────────

    public function test_reviewer_cannot_access_author_create(): void
    {
        $this->actingAs($this->reviewer());
        $this->postJson('/api/author/articles', ['title' => 'x', 'content' => '<p>x</p>'])
            ->assertStatus(403);
    }

    public function test_article_create_requires_title_and_content(): void
    {
        $this->actingAs($this->author());
        $this->postJson('/api/author/articles', [])->assertStatus(422);
        $this->postJson('/api/author/articles', ['title' => 'Only Title'])->assertStatus(422);
    }
}
