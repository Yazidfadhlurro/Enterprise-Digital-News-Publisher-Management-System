<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RoleSmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_endpoints_auth_and_smoke(): void
    {
        $admin = User::factory()->create([
            'name' => 'Smoke Admin',
            'email' => 'smoke.admin@portal.test',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'auth_scope' => 'internal',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $this->actingAs($admin);

        // Auth check
        $me = $this->getJson('/api/auth/me');
        $this->assertNotEquals(401, $me->status(), 'Authenticated admin returned 401 on /api/auth/me');

        // Admin dashboard / categories / assignments matrix should not return 401 (may return 200 or 403 depending on permissions)
        $routes = [
            '/api/admin/dashboard',
            '/api/admin/categories',
            '/api/admin/assignments/matrix',
            '/api/admin/users',
        ];

        foreach ($routes as $route) {
            $resp = $this->getJson($route);
            $this->assertNotEquals(401, $resp->status(), "Admin route {$route} unexpectedly returned 401");
        }
    }

    public function test_author_endpoints_auth_and_smoke(): void
    {
        $author = User::factory()->create([
            'name' => 'Smoke Author',
            'email' => 'smoke.author@portal.test',
            'password' => Hash::make('password'),
            'role' => 'author',
            'auth_scope' => 'internal',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $this->actingAs($author);

        $me = $this->getJson('/api/auth/me');
        $this->assertNotEquals(401, $me->status(), 'Authenticated author returned 401 on /api/auth/me');

        $routes = [
            '/api/author/dashboard',
            '/api/author/categories',
            '/api/author/articles',
        ];

        foreach ($routes as $route) {
            $resp = $this->getJson($route);
            $this->assertNotEquals(401, $resp->status(), "Author route {$route} unexpectedly returned 401");
        }
    }

    public function test_reviewer_endpoints_auth_and_smoke(): void
    {
        $rev = User::factory()->create([
            'name' => 'Smoke Reviewer',
            'email' => 'smoke.reviewer@portal.test',
            'password' => Hash::make('password'),
            'role' => 'reviewer',
            'auth_scope' => 'internal',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $this->actingAs($rev);

        $me = $this->getJson('/api/auth/me');
        $this->assertNotEquals(401, $me->status(), 'Authenticated reviewer returned 401 on /api/auth/me');

        $routes = [
            '/api/reviewer/dashboard',
            '/api/reviewer/articles',
            '/api/reviewer/activities',
        ];

        foreach ($routes as $route) {
            $resp = $this->getJson($route);
            $this->assertNotEquals(401, $resp->status(), "Reviewer route {$route} unexpectedly returned 401");
        }
    }
}
