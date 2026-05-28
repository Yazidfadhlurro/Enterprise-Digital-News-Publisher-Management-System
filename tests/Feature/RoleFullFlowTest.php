<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RoleFullFlowTest extends TestCase
{
    use RefreshDatabase;

    private function ensureCsrf(): void
    {
        $this->withHeader('Origin', config('app.url'))
            ->withHeader('Referer', rtrim(config('app.url'), '/') . '/')
            ->get('/sanctum/csrf-cookie')
            ->assertNoContent();
    }

    public function test_admin_category_crud_with_cookie_login(): void
    {
        $admin = User::factory()->create([
            'name' => 'Full Admin',
            'email' => 'full.admin@portal.test',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'auth_scope' => 'internal',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $this->ensureCsrf();

        $login = $this->postJson('/api/internal/auth/login', [
            'email' => 'full.admin@portal.test',
            'password' => 'password',
        ]);

        $login->assertOk()->assertCookie('XSRF-TOKEN');

        // Create category
        $slug = 'smoke-cat-' . time();
        $create = $this->postJson('/api/admin/categories', [
            'name' => 'Smoke Category',
            'slug' => $slug,
        ]);

        $this->assertNotEquals(401, $create->status(), 'Create category returned 401');

        if ($create->status() === 201 || $create->status() === 200) {
            $id = $create->json('id') ?? $create->json('data.id');
            if (is_null($id)) {
                $id = \Illuminate\Support\Facades\DB::table('categories')->where('slug', $slug)->value('id');
            }
            $this->assertNotNull($id, 'Category creation did not return id and category not found by slug');

            // Update
            $update = $this->putJson("/api/admin/categories/{$id}", [
                'name' => 'Smoke Category Updated',
            ]);
            $this->assertNotEquals(401, $update->status(), 'Update category returned 401');

            // Delete
            $delete = $this->deleteJson("/api/admin/categories/{$id}");
            $this->assertNotEquals(401, $delete->status(), 'Delete category returned 401');
        }
    }

    public function test_author_article_crud_with_cookie_login(): void
    {
        $author = User::factory()->create([
            'name' => 'Full Author',
            'email' => 'full.author@portal.test',
            'password' => Hash::make('password'),
            'role' => 'author',
            'auth_scope' => 'internal',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $this->ensureCsrf();

        $login = $this->postJson('/api/internal/auth/login', [
            'email' => 'full.author@portal.test',
            'password' => 'password',
        ]);

        $login->assertOk()->assertCookie('XSRF-TOKEN');

        // Create article (minimal payload)
        $slug = 'smoke-article-' . time();
        $create = $this->postJson('/api/author/articles', [
            'title' => 'Smoke Article',
            'slug' => $slug,
            'content' => '<p>Test</p>',
        ]);

        $this->assertNotEquals(401, $create->status(), 'Create article returned 401');

        if (in_array($create->status(), [200, 201])) {
            $id = $create->json('id') ?? $create->json('data.id');
            if (is_null($id)) {
                $id = \Illuminate\Support\Facades\DB::table('articles')->where('slug', $slug)->value('id');
            }
            $this->assertNotNull($id, 'Article creation did not return id and article not found by slug');

            // Delete article
            $delete = $this->deleteJson("/api/author/articles/{$id}");
            $this->assertNotEquals(401, $delete->status(), 'Delete article returned 401');
        }
    }

    public function test_reviewer_queue_access_with_cookie_login(): void
    {
        $rev = User::factory()->create([
            'name' => 'Full Reviewer',
            'email' => 'full.reviewer@portal.test',
            'password' => Hash::make('password'),
            'role' => 'reviewer',
            'auth_scope' => 'internal',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $this->ensureCsrf();

        $login = $this->postJson('/api/internal/auth/login', [
            'email' => 'full.reviewer@portal.test',
            'password' => 'password',
        ]);

        $login->assertOk()->assertCookie('XSRF-TOKEN');

        $resp = $this->getJson('/api/reviewer/articles');
        $this->assertNotEquals(401, $resp->status(), 'Reviewer queue returned 401');
    }
}
