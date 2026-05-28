<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ReaderFeatureTest extends TestCase
{
    use RefreshDatabase;

    private function reader(): User
    {
        return User::factory()->create([
            'role' => 'user', 'auth_scope' => 'public',
            'status' => 'active', 'email_verified_at' => now(),
        ]);
    }

    private function author(): User
    {
        return User::factory()->create([
            'role' => 'author', 'auth_scope' => 'internal',
            'status' => 'active', 'email_verified_at' => now(),
        ]);
    }

    private function makePublishedArticle(int $authorId, ?int $catId = null): int
    {
        return DB::table('articles')->insertGetId([
            'author_id' => $authorId,
            'category_id' => $catId,
            'title' => 'Published Article ' . uniqid(),
            'slug' => 'pub-' . uniqid(),
            'excerpt' => 'excerpt',
            'content' => '<p>body</p>',
            'status' => 'published',
            'published_at' => now(),
            'views_count' => 0,
            'is_featured' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    // ── Article Index ──────────────────────────────────────────────────────

    public function test_reader_can_list_published_articles(): void
    {
        $author = $this->author();
        $this->makePublishedArticle($author->id);
        $this->actingAs($this->reader());
        $resp = $this->getJson('/api/user/articles');
        $resp->assertOk()->assertJsonStructure(['data' => ['articles', 'pagination']]);
    }

    public function test_reader_articles_only_shows_published(): void
    {
        $author = $this->author();
        $pubId = $this->makePublishedArticle($author->id);
        DB::table('articles')->insertGetId([
            'author_id' => $author->id, 'title' => 'Draft', 'slug' => 'draft-' . uniqid(),
            'content' => '<p>x</p>', 'status' => 'draft', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->actingAs($this->reader());
        $resp = $this->getJson('/api/user/articles');
        $ids = collect($resp->json('data.articles'))->pluck('id')->all();
        $this->assertContains($pubId, $ids);
    }

    public function test_reader_can_search_articles(): void
    {
        $author = $this->author();
        DB::table('articles')->insertGetId([
            'author_id' => $author->id, 'title' => 'Unique Keyword XYZ', 'slug' => 'xyz-' . uniqid(),
            'content' => '<p>x</p>', 'status' => 'published', 'published_at' => now(),
            'views_count' => 0, 'is_featured' => false, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->actingAs($this->reader());
        $resp = $this->getJson('/api/user/articles?q=Unique+Keyword+XYZ');
        $resp->assertOk();
        $this->assertGreaterThan(0, count($resp->json('data.articles')));
    }

    // ── Article Show ───────────────────────────────────────────────────────

    public function test_reader_can_view_article_by_id(): void
    {
        $author = $this->author();
        $id = $this->makePublishedArticle($author->id);
        $this->actingAs($this->reader());
        $this->getJson("/api/user/articles/{$id}")->assertOk()
            ->assertJsonStructure(['data' => ['article']]);
    }

    public function test_reader_can_view_article_by_slug(): void
    {
        $author = $this->author();
        $slug = 'slug-test-' . uniqid();
        DB::table('articles')->insertGetId([
            'author_id' => $author->id, 'title' => 'Slug Test', 'slug' => $slug,
            'content' => '<p>x</p>', 'status' => 'published', 'published_at' => now(),
            'views_count' => 0, 'is_featured' => false, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->actingAs($this->reader());
        $this->getJson("/api/user/articles/{$slug}")->assertOk();
    }

    public function test_reader_cannot_view_draft_article(): void
    {
        $author = $this->author();
        $id = DB::table('articles')->insertGetId([
            'author_id' => $author->id, 'title' => 'Draft', 'slug' => 'draft-' . uniqid(),
            'content' => '<p>x</p>', 'status' => 'draft', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->actingAs($this->reader());
        $this->getJson("/api/user/articles/{$id}")->assertStatus(404);
    }

    public function test_viewing_article_increments_views(): void
    {
        $author = $this->author();
        $id = $this->makePublishedArticle($author->id);
        $this->actingAs($this->reader());
        $this->getJson("/api/user/articles/{$id}");
        $views = DB::table('articles')->where('id', $id)->value('views_count');
        $this->assertGreaterThan(0, $views);
    }

    // ── Insights ───────────────────────────────────────────────────────────

    public function test_reader_can_get_insights(): void
    {
        $this->actingAs($this->reader());
        $this->getJson('/api/user/articles/insights')->assertOk()
            ->assertJsonStructure(['data' => ['trending_articles', 'editors_picks']]);
    }

    // ── Comments ───────────────────────────────────────────────────────────

    public function test_reader_can_post_comment(): void
    {
        $author = $this->author();
        $id = $this->makePublishedArticle($author->id);
        $this->actingAs($this->reader());
        $resp = $this->postJson("/api/user/articles/{$id}/comments", ['content' => 'Great article!']);
        $resp->assertStatus(201)->assertJsonPath('status', 'success');
        $this->assertDatabaseHas('comments', ['article_id' => $id, 'content' => 'Great article!']);
    }

    public function test_reader_comment_requires_content(): void
    {
        $author = $this->author();
        $id = $this->makePublishedArticle($author->id);
        $this->actingAs($this->reader());
        $this->postJson("/api/user/articles/{$id}/comments", [])->assertStatus(422);
    }

    public function test_reader_can_list_comments(): void
    {
        $author = $this->author();
        $id = $this->makePublishedArticle($author->id);
        $this->actingAs($this->reader());
        $this->getJson("/api/user/articles/{$id}/comments")->assertOk()
            ->assertJsonStructure(['data' => ['comments', 'pagination']]);
    }

    // ── Like ───────────────────────────────────────────────────────────────

    public function test_reader_can_like_article(): void
    {
        $author = $this->author();
        $id = $this->makePublishedArticle($author->id);
        $this->actingAs($this->reader());
        $resp = $this->postJson("/api/user/articles/{$id}/like");
        $resp->assertOk()->assertJsonPath('data.liked', true);
    }

    public function test_reader_can_unlike_article(): void
    {
        $author = $this->author();
        $id = $this->makePublishedArticle($author->id);
        $reader = $this->reader();
        $this->actingAs($reader);
        $this->postJson("/api/user/articles/{$id}/like"); // like
        $resp = $this->postJson("/api/user/articles/{$id}/like"); // unlike
        $resp->assertOk()->assertJsonPath('data.liked', false);
    }

    // ── Bookmark ───────────────────────────────────────────────────────────

    public function test_reader_can_bookmark_article(): void
    {
        $author = $this->author();
        $id = $this->makePublishedArticle($author->id);
        $this->actingAs($this->reader());
        $resp = $this->postJson("/api/user/articles/{$id}/bookmark");
        $resp->assertOk()->assertJsonPath('data.bookmarked', true);
    }

    public function test_reader_can_remove_bookmark(): void
    {
        $author = $this->author();
        $id = $this->makePublishedArticle($author->id);
        $reader = $this->reader();
        $this->actingAs($reader);
        $this->postJson("/api/user/articles/{$id}/bookmark"); // add
        $resp = $this->postJson("/api/user/articles/{$id}/bookmark"); // remove
        $resp->assertOk()->assertJsonPath('data.bookmarked', false);
    }

    public function test_reader_can_list_bookmarks(): void
    {
        $this->actingAs($this->reader());
        $this->getJson('/api/user/bookmarks')->assertOk()
            ->assertJsonStructure(['data' => ['bookmarks', 'pagination']]);
    }

    // ── Rating ─────────────────────────────────────────────────────────────

    public function test_reader_can_rate_article(): void
    {
        $author = $this->author();
        $id = $this->makePublishedArticle($author->id);
        $this->actingAs($this->reader());
        $resp = $this->postJson("/api/user/articles/{$id}/rating", ['rating' => 4]);
        $resp->assertOk()->assertJsonPath('data.current_user_rating', 4);
    }

    public function test_reader_rating_must_be_1_to_5(): void
    {
        $author = $this->author();
        $id = $this->makePublishedArticle($author->id);
        $this->actingAs($this->reader());
        $this->postJson("/api/user/articles/{$id}/rating", ['rating' => 0])->assertStatus(422);
        $this->postJson("/api/user/articles/{$id}/rating", ['rating' => 6])->assertStatus(422);
    }

    public function test_reader_can_update_rating(): void
    {
        $author = $this->author();
        $id = $this->makePublishedArticle($author->id);
        $reader = $this->reader();
        $this->actingAs($reader);
        $this->postJson("/api/user/articles/{$id}/rating", ['rating' => 3]);
        $resp = $this->postJson("/api/user/articles/{$id}/rating", ['rating' => 5]);
        $resp->assertOk()->assertJsonPath('data.current_user_rating', 5);
    }

    // ── Access Control ─────────────────────────────────────────────────────

    public function test_internal_user_cannot_access_reader_routes(): void
    {
        $author = User::factory()->create([
            'role' => 'author', 'auth_scope' => 'internal',
            'status' => 'active', 'email_verified_at' => now(),
        ]);
        $this->actingAs($author);
        $this->getJson('/api/user/articles')->assertStatus(403);
    }

    public function test_unauthenticated_cannot_access_reader_routes(): void
    {
        $this->getJson('/api/user/articles')->assertStatus(401);
        $this->getJson('/api/user/bookmarks')->assertStatus(401);
    }
}
