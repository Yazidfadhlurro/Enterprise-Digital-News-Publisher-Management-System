<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminFeatureTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'role' => 'admin', 'auth_scope' => 'internal',
            'status' => 'active', 'email_verified_at' => now(),
        ]);
    }

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

    // ── Dashboard ──────────────────────────────────────────────────────────

    public function test_admin_dashboard_returns_ok(): void
    {
        $this->actingAs($this->admin());
        $this->getJson('/api/admin/dashboard')->assertOk()
            ->assertJsonStructure(['status', 'data']);
    }

    // ── Category CRUD ──────────────────────────────────────────────────────

    public function test_admin_can_create_category(): void
    {
        $this->actingAs($this->admin());
        $resp = $this->postJson('/api/admin/categories', ['name' => 'Tech News']);
        $resp->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonStructure(['id', 'name', 'slug']);
    }

    public function test_admin_can_list_categories(): void
    {
        $this->actingAs($this->admin());
        $this->getJson('/api/admin/categories')->assertOk()
            ->assertJsonStructure(['data' => ['categories']]);
    }

    public function test_admin_can_show_category(): void
    {
        $this->actingAs($this->admin());
        $id = DB::table('categories')->insertGetId(['name' => 'Show Cat', 'slug' => 'show-cat', 'created_at' => now(), 'updated_at' => now()]);
        $this->getJson("/api/admin/categories/{$id}")->assertOk()
            ->assertJsonPath('id', $id);
    }

    public function test_admin_can_update_category(): void
    {
        $this->actingAs($this->admin());
        $id = DB::table('categories')->insertGetId(['name' => 'Old', 'slug' => 'old-cat', 'created_at' => now(), 'updated_at' => now()]);
        $this->putJson("/api/admin/categories/{$id}", ['name' => 'New Name'])
            ->assertOk()->assertJsonPath('status', 'success');
    }

    public function test_admin_can_delete_category(): void
    {
        $this->actingAs($this->admin());
        $id = DB::table('categories')->insertGetId(['name' => 'Del Cat', 'slug' => 'del-cat', 'created_at' => now(), 'updated_at' => now()]);
        $this->deleteJson("/api/admin/categories/{$id}")->assertOk();
        $this->assertDatabaseMissing('categories', ['id' => $id]);
    }

    public function test_admin_category_create_requires_name(): void
    {
        $this->actingAs($this->admin());
        $this->postJson('/api/admin/categories', [])->assertStatus(422);
    }

    // ── User Management ────────────────────────────────────────────────────

    public function test_admin_can_list_users(): void
    {
        $this->actingAs($this->admin());
        $this->getJson('/api/admin/users')->assertOk()
            ->assertJsonStructure(['data' => ['users', 'pagination']]);
    }

    public function test_admin_can_show_user(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);
        $this->getJson("/api/admin/users/{$admin->id}")->assertOk()
            ->assertJsonPath('data.user.id', $admin->id);
    }

    public function test_admin_can_create_user(): void
    {
        $rev = $this->reviewer();
        $this->actingAs($this->admin());
        $resp = $this->postJson('/api/admin/users', [
            'name' => 'New Author',
            'email' => 'newauthor@portal.test',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'author',
            'assigned_reviewer_id' => $rev->id,
        ]);
        $resp->assertStatus(201)->assertJsonPath('status', 'success');
    }

    public function test_admin_can_update_user(): void
    {
        $admin = $this->admin();
        $target = $this->reviewer();
        $this->actingAs($admin);
        $this->putJson("/api/admin/users/{$target->id}", ['name' => 'Updated Name'])
            ->assertOk()->assertJsonPath('status', 'success');
    }

    public function test_admin_can_suspend_and_unsuspend_user(): void
    {
        $admin = $this->admin();
        $target = $this->reviewer();
        $this->actingAs($admin);

        $this->postJson("/api/admin/users/{$target->id}/suspend")->assertOk();
        $this->assertDatabaseHas('users', ['id' => $target->id, 'status' => 'suspended']);

        $this->postJson("/api/admin/users/{$target->id}/unsuspend")->assertOk();
        $this->assertDatabaseHas('users', ['id' => $target->id, 'status' => 'active']);
    }

    public function test_admin_can_delete_user(): void
    {
        $admin = $this->admin();
        $target = User::factory()->create(['role' => 'user', 'auth_scope' => 'public', 'status' => 'active', 'email_verified_at' => now()]);
        $this->actingAs($admin);
        $this->deleteJson("/api/admin/users/{$target->id}")->assertOk();
        $this->assertDatabaseMissing('users', ['id' => $target->id]);
    }

    public function test_admin_cannot_delete_self(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);
        $this->deleteJson("/api/admin/users/{$admin->id}")->assertStatus(403);
    }

    // ── Article Management ─────────────────────────────────────────────────

    public function test_admin_can_list_articles(): void
    {
        $this->actingAs($this->admin());
        $this->getJson('/api/admin/articles')->assertOk()
            ->assertJsonStructure(['data' => ['articles']]);
    }

    public function test_admin_can_create_article(): void
    {
        $rev = $this->reviewer();
        $author = $this->author($rev->id);
        $this->actingAs($this->admin());
        $resp = $this->postJson('/api/admin/articles', [
            'title' => 'Admin Article',
            'content' => '<p>body</p>',
            'author_id' => $author->id,
        ]);
        $resp->assertStatus(201)->assertJsonPath('status', 'success');
    }

    // ── Assignment Matrix ──────────────────────────────────────────────────

    public function test_admin_can_view_assignment_matrix(): void
    {
        $this->actingAs($this->admin());
        $this->getJson('/api/admin/assignments/matrix')->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_admin_can_view_assignment_logs(): void
    {
        $this->actingAs($this->admin());
        $this->getJson('/api/admin/assignments/logs')->assertOk();
    }

    // ── Activity Logs ──────────────────────────────────────────────────────

    public function test_admin_can_view_activities(): void
    {
        $this->actingAs($this->admin());
        $this->getJson('/api/admin/activities')->assertOk()
            ->assertJsonStructure(['data']);
    }

    // ── Permission Matrix ──────────────────────────────────────────────────

    public function test_admin_can_view_permissions(): void
    {
        $this->actingAs($this->admin());
        $this->getJson('/api/admin/permissions')->assertOk()
            ->assertJsonStructure(['data']);
    }

    // ── Invites ────────────────────────────────────────────────────────────

    public function test_admin_can_list_invites(): void
    {
        $this->actingAs($this->admin());
        $this->getJson('/api/admin/invites')->assertOk();
    }

    public function test_admin_can_create_invite(): void
    {
        $this->actingAs($this->admin());
        $resp = $this->postJson('/api/admin/invites', [
            'email' => 'invite@portal.test',
            'role' => 'author',
        ]);
        $resp->assertStatus(201)->assertJsonPath('status', 'success');
    }

    // ── Feedback ───────────────────────────────────────────────────────────

    public function test_admin_can_view_feedback(): void
    {
        $this->actingAs($this->admin());
        $this->getJson('/api/admin/feedback')->assertOk();
    }

    // ── Access Control ─────────────────────────────────────────────────────

    public function test_non_admin_cannot_access_admin_routes(): void
    {
        $this->actingAs($this->reviewer());
        $this->getJson('/api/admin/dashboard')->assertStatus(403);
        $this->getJson('/api/admin/users')->assertStatus(403);

        $this->actingAs($this->author());
        $this->getJson('/api/admin/categories')->assertStatus(403);
    }

    public function test_unauthenticated_cannot_access_admin_routes(): void
    {
        $this->getJson('/api/admin/dashboard')->assertStatus(401);
    }

    // ── Auth: me, profile, change-password, logout ─────────────────────────

    public function test_admin_can_get_me(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);
        $this->getJson('/api/auth/me')->assertOk()
            ->assertJsonPath('data.user.id', $admin->id);
    }

    public function test_admin_can_update_profile(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);
        $this->putJson('/api/auth/profile', [
            'name' => 'Updated Admin',
            'email' => $admin->email,
        ])->assertOk()->assertJsonPath('status', 'success');
    }

    public function test_admin_can_change_password(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);
        $this->postJson('/api/auth/change-password', [
            'current_password' => 'password',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ])->assertOk();
    }

    public function test_admin_can_logout(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);
        $this->postJson('/api/auth/logout')->assertOk();
    }
}
