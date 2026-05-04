<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProfileSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_update_profile_biodata_fields(): void
    {
        $user = User::factory()->create([
            'name' => 'Old User',
            'email' => 'old.user@example.com',
        ]);

        Sanctum::actingAs($user);

        $response = $this->putJson('/api/auth/profile', [
            'name' => 'Admin User',
            'email' => 'admin.user@example.com',
            'phone' => '081234567890',
            'address' => 'Jl. Mawar No. 7',
            'bio' => 'Bio singkat admin untuk pengujian profile settings.',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.user.name', 'Admin User')
            ->assertJsonPath('data.user.email', 'admin.user@example.com')
            ->assertJsonPath('data.user.phone', '081234567890')
            ->assertJsonPath('data.user.address', 'Jl. Mawar No. 7')
            ->assertJsonPath('data.user.bio', 'Bio singkat admin untuk pengujian profile settings.');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Admin User',
            'email' => 'admin.user@example.com',
            'phone' => '081234567890',
            'address' => 'Jl. Mawar No. 7',
            'bio' => 'Bio singkat admin untuk pengujian profile settings.',
        ]);
    }

    public function test_me_endpoint_returns_new_profile_fields(): void
    {
        $user = User::factory()->create([
            'name' => 'Profile User',
            'email' => 'profile.user@example.com',
            'phone' => '081111111111',
            'address' => 'Bandung',
            'bio' => 'Bio dari user profile.',
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/auth/me');

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.user.phone', '081111111111')
            ->assertJsonPath('data.user.address', 'Bandung')
            ->assertJsonPath('data.user.bio', 'Bio dari user profile.');
    }
}
