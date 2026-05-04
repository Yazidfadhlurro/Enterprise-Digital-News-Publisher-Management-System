<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReaderArticleTest extends TestCase
{
    use RefreshDatabase;

    public function test_reader_can_list_published_articles_with_bookmark_and_stats(): void
    {
        $reader = $this->createReaderUser();
        $author = $this->createAuthorUser();
        $otherReader = $this->createReaderUser();

        $readerLegacyId = $this->ensureLegacyReader($reader);
        $otherReaderLegacyId = $this->ensureLegacyReader($otherReader);

        $technologyCategoryId = $this->createCategory('Teknologi');
        $sportsCategoryId = $this->createCategory('Olahraga');

        $targetArticleId = $this->createArticle($author->id, $technologyCategoryId, [
            'title' => 'Panduan Teknologi AI untuk Pemula',
            'slug' => 'panduan-teknologi-ai-untuk-pemula',
            'is_featured' => true,
            'published_at' => now()->subHour(),
        ]);

        $this->createArticle($author->id, $sportsCategoryId, [
            'title' => 'Laporan Olahraga Nasional',
            'slug' => 'laporan-olahraga-nasional',
            'published_at' => now()->subHours(2),
        ]);

        $this->createArticle($author->id, $technologyCategoryId, [
            'title' => 'Draft Teknologi yang Belum Terbit',
            'slug' => 'draft-teknologi-yang-belum-terbit',
            'status' => 'draft',
            'published_at' => null,
        ]);

        DB::table('bookmarks')->insert([
            'reader_id' => $readerLegacyId,
            'user_id' => $reader->id,
            'article_id' => $targetArticleId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('article_ratings')->insert([
            [
                'article_id' => $targetArticleId,
                'reader_id' => $readerLegacyId,
                'user_id' => $reader->id,
                'rating' => 5,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'article_id' => $targetArticleId,
                'reader_id' => $otherReaderLegacyId,
                'user_id' => $otherReader->id,
                'rating' => 4,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('comments')->insert([
            [
                'article_id' => $targetArticleId,
                'reader_id' => $otherReaderLegacyId,
                'user_id' => $otherReader->id,
                'parent_id' => null,
                'content' => 'Komentar pertama.',
                'status' => 'approved',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'article_id' => $targetArticleId,
                'reader_id' => $readerLegacyId,
                'user_id' => $reader->id,
                'parent_id' => null,
                'content' => 'Komentar kedua.',
                'status' => 'approved',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        Sanctum::actingAs($reader);

        $response = $this->getJson("/api/user/articles?per_page=10&q=Teknologi&category_id={$technologyCategoryId}");

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.pagination.total', 1);

        $articles = $response->json('data.articles');

        $this->assertCount(1, $articles);
        $this->assertSame($targetArticleId, $articles[0]['id']);
        $this->assertTrue((bool) $articles[0]['bookmarked']);
        $this->assertSame(2, (int) $articles[0]['ratings_total']);
        $this->assertSame(4.5, (float) $articles[0]['average_rating']);
        $this->assertSame(2, (int) $articles[0]['comments_total']);
    }

    public function test_reader_can_open_detail_toggle_bookmark_and_update_rating(): void
    {
        $reader = $this->createReaderUser();
        $author = $this->createAuthorUser();
        $categoryId = $this->createCategory('Ekonomi');

        $articleId = $this->createArticle($author->id, $categoryId, [
            'title' => 'Prospek Ekonomi Digital Nasional',
            'slug' => 'prospek-ekonomi-digital-nasional',
            'views_count' => 0,
        ]);

        Sanctum::actingAs($reader);

        $detailResponse = $this->getJson('/api/user/articles/prospek-ekonomi-digital-nasional');

        $detailResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.article.id', $articleId)
            ->assertJsonPath('data.article.views_count', 1);

        $this->assertDatabaseHas('articles', [
            'id' => $articleId,
            'views_count' => 1,
        ]);

        $secondDetailResponse = $this->getJson('/api/user/articles/prospek-ekonomi-digital-nasional');
        $secondDetailResponse->assertOk()->assertJsonPath('data.article.views_count', 1);

        $this->assertDatabaseHas('articles', [
            'id' => $articleId,
            'views_count' => 1,
        ]);

        $this->assertSame(1, DB::table('article_views')
            ->where('article_id', $articleId)
            ->where('user_id', $reader->id)
            ->count());

        $bookmarkResponse = $this->postJson("/api/user/articles/{$articleId}/bookmark");
        $bookmarkResponse->assertOk()->assertJsonPath('data.bookmarked', true);

        $this->assertDatabaseHas('bookmarks', [
            'article_id' => $articleId,
            'user_id' => $reader->id,
        ]);

        $unbookmarkResponse = $this->postJson("/api/user/articles/{$articleId}/bookmark");
        $unbookmarkResponse->assertOk()->assertJsonPath('data.bookmarked', false);

        $this->assertDatabaseMissing('bookmarks', [
            'article_id' => $articleId,
            'user_id' => $reader->id,
        ]);

        $firstRatingResponse = $this->postJson("/api/user/articles/{$articleId}/rating", [
            'rating' => 5,
        ]);

        $firstRatingResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.current_user_rating', 5)
            ->assertJsonPath('data.ratings_total', 1);

        $this->assertDatabaseHas('article_ratings', [
            'article_id' => $articleId,
            'user_id' => $reader->id,
            'rating' => 5,
        ]);

        $secondRatingResponse = $this->postJson("/api/user/articles/{$articleId}/rating", [
            'rating' => 3,
        ]);

        $secondRatingResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.current_user_rating', 3)
            ->assertJsonPath('data.ratings_total', 1);

        $this->assertDatabaseHas('article_ratings', [
            'article_id' => $articleId,
            'user_id' => $reader->id,
            'rating' => 3,
        ]);

        $this->assertSame(1, DB::table('article_ratings')
            ->where('article_id', $articleId)
            ->where('user_id', $reader->id)
            ->count());
    }

    public function test_reader_comments_endpoint_returns_approved_and_own_pending_only(): void
    {
        $reader = $this->createReaderUser();
        $author = $this->createAuthorUser();
        $otherReader = $this->createReaderUser();

        $readerLegacyId = $this->ensureLegacyReader($reader);
        $otherReaderLegacyId = $this->ensureLegacyReader($otherReader);

        $categoryId = $this->createCategory('Sains');
        $articleId = $this->createArticle($author->id, $categoryId, [
            'title' => 'Eksplorasi Sains Modern',
            'slug' => 'eksplorasi-sains-modern',
        ]);

        $approvedOtherCommentId = DB::table('comments')->insertGetId([
            'article_id' => $articleId,
            'reader_id' => $otherReaderLegacyId,
            'user_id' => $otherReader->id,
            'parent_id' => null,
            'content' => 'Komentar approved dari user lain.',
            'status' => 'approved',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $pendingOtherCommentId = DB::table('comments')->insertGetId([
            'article_id' => $articleId,
            'reader_id' => $otherReaderLegacyId,
            'user_id' => $otherReader->id,
            'parent_id' => null,
            'content' => 'Komentar pending dari user lain.',
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Sanctum::actingAs($reader);

        $storeResponse = $this->postJson("/api/user/articles/{$articleId}/comments", [
            'content' => 'Komentar saya untuk antrean moderasi.',
        ]);

        $storeResponse->assertCreated()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.comment.status', 'pending')
            ->assertJsonPath('data.comment.is_pending', true);

        $ownPendingCommentId = (int) $storeResponse->json('data.comment.id');

        $commentsResponse = $this->getJson("/api/user/articles/{$articleId}/comments?per_page=20");
        $commentsResponse->assertOk()->assertJsonPath('status', 'success');

        $comments = collect($commentsResponse->json('data.comments'));
        $commentIds = $comments->pluck('id')->map(fn ($id) => (int) $id)->all();

        $this->assertContains($approvedOtherCommentId, $commentIds);
        $this->assertContains($ownPendingCommentId, $commentIds);
        $this->assertNotContains($pendingOtherCommentId, $commentIds);

        $ownComment = $comments->firstWhere('id', $ownPendingCommentId);
        $this->assertNotNull($ownComment);
        $this->assertTrue((bool) ($ownComment['is_pending'] ?? false));

        $this->assertDatabaseHas('comments', [
            'id' => $ownPendingCommentId,
            'user_id' => $reader->id,
            'reader_id' => $readerLegacyId,
            'status' => 'pending',
        ]);
    }

    public function test_reader_can_list_search_and_remove_bookmarks(): void
    {
        $reader = $this->createReaderUser();
        $author = $this->createAuthorUser();
        $businessCategoryId = $this->createCategory('Bisnis');
        $technologyCategoryId = $this->createCategory('Teknologi');

        $economyArticleId = $this->createArticle($author->id, $businessCategoryId, [
            'title' => 'Analisis Ekonomi Regional 2026',
            'slug' => 'analisis-ekonomi-regional-2026',
        ]);

        $technologyArticleId = $this->createArticle($author->id, $technologyCategoryId, [
            'title' => 'Pertumbuhan Startup Teknologi',
            'slug' => 'pertumbuhan-startup-teknologi',
            'published_at' => now()->subMinutes(30),
        ]);

        Sanctum::actingAs($reader);

        $this->postJson("/api/user/articles/{$economyArticleId}/bookmark")
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.bookmarked', true);

        $this->postJson("/api/user/articles/{$technologyArticleId}/bookmark")
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.bookmarked', true);

        $allBookmarksResponse = $this->getJson('/api/user/bookmarks?per_page=10');
        $allBookmarksResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.pagination.total', 2);

        $filteredBookmarksResponse = $this->getJson('/api/user/bookmarks?per_page=10&q=Ekonomi');
        $filteredBookmarksResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.pagination.total', 1)
            ->assertJsonPath('data.bookmarks.0.article.id', $economyArticleId);

        $categoryFilteredResponse = $this->getJson("/api/user/bookmarks?per_page=10&category_id={$technologyCategoryId}");
        $categoryFilteredResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.pagination.total', 1)
            ->assertJsonPath('data.bookmarks.0.article.id', $technologyArticleId);

        $this->postJson("/api/user/articles/{$economyArticleId}/bookmark")
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.bookmarked', false);

        $afterRemoveResponse = $this->getJson('/api/user/bookmarks?per_page=10');
        $afterRemoveResponse->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.pagination.total', 1)
            ->assertJsonPath('data.bookmarks.0.article.id', $technologyArticleId);
    }

    public function test_reader_can_load_global_insights_with_limits_and_bookmark_overlay(): void
    {
        Cache::forget('reader.insights.global.v1');

        $reader = $this->createReaderUser();
        $otherReader = $this->createReaderUser();
        $author = $this->createAuthorUser();

        $readerLegacyId = $this->ensureLegacyReader($reader);
        $otherReaderLegacyId = $this->ensureLegacyReader($otherReader);

        $technologyCategoryId = $this->createCategory('Teknologi');
        $businessCategoryId = $this->createCategory('Bisnis');
        $lifestyleCategoryId = $this->createCategory('Gaya Hidup');

        $highSignalArticleId = $this->createArticle($author->id, $technologyCategoryId, [
            'title' => 'Analisis AI Global 2026',
            'slug' => 'analisis-ai-global-2026',
            'is_featured' => true,
            'views_count' => 480,
            'published_at' => now()->subMinutes(30),
        ]);

        $steadyArticleId = $this->createArticle($author->id, $businessCategoryId, [
            'title' => 'Outlook Ekonomi Asia Tenggara',
            'slug' => 'outlook-ekonomi-asia-tenggara',
            'views_count' => 320,
            'published_at' => now()->subHours(2),
        ]);

        $freshArticleId = $this->createArticle($author->id, $lifestyleCategoryId, [
            'title' => 'Tren Produktivitas Hybrid Work',
            'slug' => 'tren-produktivitas-hybrid-work',
            'views_count' => 140,
            'published_at' => now()->subHours(4),
        ]);

        $this->createArticle($author->id, $technologyCategoryId, [
            'title' => 'Draft Internal Riset Newsroom',
            'slug' => 'draft-internal-riset-newsroom',
            'status' => 'draft',
            'published_at' => null,
            'views_count' => 999,
        ]);

        DB::table('article_ratings')->insert([
            [
                'article_id' => $highSignalArticleId,
                'reader_id' => $readerLegacyId,
                'user_id' => $reader->id,
                'rating' => 5,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'article_id' => $highSignalArticleId,
                'reader_id' => $otherReaderLegacyId,
                'user_id' => $otherReader->id,
                'rating' => 4,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'article_id' => $steadyArticleId,
                'reader_id' => $readerLegacyId,
                'user_id' => $reader->id,
                'rating' => 5,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'article_id' => $freshArticleId,
                'reader_id' => $otherReaderLegacyId,
                'user_id' => $otherReader->id,
                'rating' => 4,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('comments')->insert([
            [
                'article_id' => $highSignalArticleId,
                'reader_id' => $otherReaderLegacyId,
                'user_id' => $otherReader->id,
                'parent_id' => null,
                'content' => 'Komentar pada artikel sinyal tinggi 1',
                'status' => 'approved',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'article_id' => $highSignalArticleId,
                'reader_id' => $readerLegacyId,
                'user_id' => $reader->id,
                'parent_id' => null,
                'content' => 'Komentar pada artikel sinyal tinggi 2',
                'status' => 'approved',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'article_id' => $steadyArticleId,
                'reader_id' => $otherReaderLegacyId,
                'user_id' => $otherReader->id,
                'parent_id' => null,
                'content' => 'Komentar pada artikel steady',
                'status' => 'approved',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('bookmarks')->insert([
            'reader_id' => $readerLegacyId,
            'user_id' => $reader->id,
            'article_id' => $highSignalArticleId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Sanctum::actingAs($reader);

        $response = $this->getJson('/api/user/articles/insights?trending_limit=5&picks_limit=5');

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.published_articles_total', 3)
            ->assertJsonPath('data.limits.trending', 5)
            ->assertJsonPath('data.limits.editors_picks', 5);

        $trending = collect($response->json('data.trending_articles'));
        $picks = collect($response->json('data.editors_picks'));

        $this->assertNotEmpty($response->json('data.generated_at'));
        $this->assertCount(3, $trending);
        $this->assertCount(3, $picks);

        $trendingIds = $trending->pluck('id')->map(fn ($id) => (int) $id)->all();
        $pickIds = $picks->pluck('id')->map(fn ($id) => (int) $id)->all();

        $this->assertContains($highSignalArticleId, $trendingIds);
        $this->assertContains($highSignalArticleId, $pickIds);

        $highSignalTrending = $trending->firstWhere('id', $highSignalArticleId);
        $this->assertNotNull($highSignalTrending);
        $this->assertTrue((bool) ($highSignalTrending['bookmarked'] ?? false));

        $highSignalPick = $picks->firstWhere('id', $highSignalArticleId);
        $this->assertNotNull($highSignalPick);
        $this->assertTrue((bool) ($highSignalPick['bookmarked'] ?? false));

        for ($index = 1; $index < $trending->count(); $index += 1) {
            $current = (float) ($trending[$index]['trending_score'] ?? 0);
            $previous = (float) ($trending[$index - 1]['trending_score'] ?? 0);
            $this->assertLessThanOrEqual($previous, $current);
        }

        Cache::forget('reader.insights.global.v1');
    }

    private function createReaderUser(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'role' => 'user',
            'status' => 'active',
            'email_verified_at' => now(),
        ], $overrides));
    }

    private function createAuthorUser(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'role' => 'author',
            'status' => 'active',
            'email_verified_at' => now(),
        ], $overrides));
    }

    private function createCategory(string $name): int
    {
        return (int) DB::table('categories')->insertGetId([
            'name' => $name,
            'slug' => Str::slug($name) . '-' . Str::lower(Str::random(6)),
            'description' => null,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function createArticle(int $authorId, int $categoryId, array $overrides = []): int
    {
        $title = (string) ($overrides['title'] ?? ('Judul Berita ' . Str::random(8)));
        $status = (string) ($overrides['status'] ?? 'published');

        $payload = array_merge([
            'author_id' => $authorId,
            'category_id' => $categoryId,
            'title' => $title,
            'slug' => Str::slug($title) . '-' . Str::lower(Str::random(6)),
            'excerpt' => 'Ringkasan untuk ' . $title,
            'content' => 'Konten lengkap untuk ' . $title . ' ' . Str::repeat('isi ', 60),
            'featured_image' => null,
            'featured_image_alt' => null,
            'status' => $status,
            'reviewer_id' => null,
            'review_notes' => null,
            'published_at' => $status === 'published' ? now()->subDay() : null,
            'is_featured' => false,
            'views_count' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides);

        return (int) DB::table('articles')->insertGetId($payload);
    }

    private function ensureLegacyReader(User $user): int
    {
        $existingId = DB::table('readers')
            ->where('email', $user->email)
            ->value('id');

        if ($existingId) {
            return (int) $existingId;
        }

        return (int) DB::table('readers')->insertGetId([
            'name' => $user->name,
            'email' => $user->email,
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'avatar' => null,
            'status' => 'active',
            'remember_token' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}