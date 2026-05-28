<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CsrfSessionFlowTest extends TestCase
{
    use RefreshDatabase;

    private function getXsrfCookieValue($response): ?string
    {
        $cookie = collect($response->baseResponse->headers->getCookies())
            ->first(fn ($cookie) => $cookie->getName() === 'XSRF-TOKEN');

        return $cookie ? urldecode($cookie->getValue()) : null;
    }

    public function test_sanctum_csrf_cookie_endpoint_sets_xsrf_cookie(): void
    {
        $response = $this
            ->withHeader('Origin', config('app.url'))
            ->withHeader('Referer', rtrim(config('app.url'), '/') . '/')
            ->get('/sanctum/csrf-cookie');

        $response->assertNoContent()
            ->assertCookie('XSRF-TOKEN');
    }

    public function test_login_sets_xsrf_and_scope_cookies_for_public_users(): void
    {
        User::factory()->create([
            'name' => 'Publik Test',
            'email' => 'public.test@portal.test',
            'password' => Hash::make('password123'),
            'role' => 'user',
            'auth_scope' => 'public',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $response = $this->postJson('/api/public/auth/login', [
            'email' => 'public.test@portal.test',
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertCookie(config('session.cookie'))
            ->assertCookie('public_session')
            ->assertCookie('XSRF-TOKEN');
    }

    public function test_logout_then_relogin_refreshes_csrf_for_public_users(): void
    {
        User::factory()->create([
            'name' => 'Publik Test',
            'email' => 'cycle.public@portal.test',
            'password' => Hash::make('password123'),
            'role' => 'user',
            'auth_scope' => 'public',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        User::factory()->create([
            'name' => 'Internal Test',
            'email' => 'cycle.internal@portal.test',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'auth_scope' => 'internal',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $publicLogin = $this->postJson('/api/public/auth/login', [
            'email' => 'cycle.public@portal.test',
            'password' => 'password123',
        ]);

        $publicLogin->assertOk()->assertCookie('XSRF-TOKEN');
        $publicXsrfToken = $this->getXsrfCookieValue($publicLogin);
        $this->assertNotNull($publicXsrfToken);

        $this->withHeader('Origin', config('app.url'))
            ->withHeader('Referer', rtrim(config('app.url'), '/') . '/')
            ->withHeader('X-XSRF-TOKEN', $publicXsrfToken)
            ->postJson('/api/auth/logout')
            ->assertOk();

        $publicRelogin = $this->postJson('/api/public/auth/login', [
            'email' => 'cycle.public@portal.test',
            'password' => 'password123',
        ]);

        $publicRelogin->assertOk()->assertCookie('XSRF-TOKEN');
    }

    public function test_logout_then_relogin_refreshes_csrf_for_internal_users(): void
    {
        User::factory()->create([
            'name' => 'Internal Test',
            'email' => 'cycle.internal@portal.test',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'auth_scope' => 'internal',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $internalLogin = $this->postJson('/api/internal/auth/login', [
            'email' => 'cycle.internal@portal.test',
            'password' => 'password123',
        ]);

        $internalLogin->assertOk()->assertCookie('XSRF-TOKEN');
        $internalXsrfToken = $this->getXsrfCookieValue($internalLogin);
        $this->assertNotNull($internalXsrfToken);

        $this->withHeader('Origin', config('app.url'))
            ->withHeader('Referer', rtrim(config('app.url'), '/') . '/')
            ->withHeader('X-XSRF-TOKEN', $internalXsrfToken)
            ->postJson('/api/auth/logout')
            ->assertOk();

        $internalRelogin = $this->postJson('/api/internal/auth/login', [
            'email' => 'cycle.internal@portal.test',
            'password' => 'password123',
        ]);

        $internalRelogin->assertOk()->assertCookie('XSRF-TOKEN');
    }

    public function test_logout_then_switches_from_public_to_internal_refreshes_csrf_cookie(): void
    {
        User::factory()->create([
            'name' => 'Publik Switch',
            'email' => 'switch.public@portal.test',
            'password' => Hash::make('password123'),
            'role' => 'user',
            'auth_scope' => 'public',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        User::factory()->create([
            'name' => 'Internal Switch',
            'email' => 'switch.internal@portal.test',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'auth_scope' => 'internal',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $publicLogin = $this->postJson('/api/public/auth/login', [
            'email' => 'switch.public@portal.test',
            'password' => 'password123',
        ]);

        $publicLogin->assertOk()->assertCookie('XSRF-TOKEN');
        $publicXsrfToken = $this->getXsrfCookieValue($publicLogin);
        $this->assertNotNull($publicXsrfToken);

        $this->withHeader('Origin', config('app.url'))
            ->withHeader('Referer', rtrim(config('app.url'), '/') . '/')
            ->withHeader('X-XSRF-TOKEN', $publicXsrfToken)
            ->postJson('/api/auth/logout')
            ->assertOk();

        $internalLogin = $this->postJson('/api/internal/auth/login', [
            'email' => 'switch.internal@portal.test',
            'password' => 'password123',
        ]);

        $internalLogin->assertOk()
            ->assertCookie('XSRF-TOKEN')
            ->assertCookie('internal_session');
    }

    public function test_logout_then_switches_from_internal_to_public_refreshes_csrf_cookie(): void
    {
        User::factory()->create([
            'name' => 'Internal Switch',
            'email' => 'switch2.internal@portal.test',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'auth_scope' => 'internal',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        User::factory()->create([
            'name' => 'Publik Switch',
            'email' => 'switch2.public@portal.test',
            'password' => Hash::make('password123'),
            'role' => 'user',
            'auth_scope' => 'public',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $internalLogin = $this->postJson('/api/internal/auth/login', [
            'email' => 'switch2.internal@portal.test',
            'password' => 'password123',
        ]);

        $internalLogin->assertOk()->assertCookie('XSRF-TOKEN');
        $internalXsrfToken = $this->getXsrfCookieValue($internalLogin);
        $this->assertNotNull($internalXsrfToken);

        $this->withHeader('Origin', config('app.url'))
            ->withHeader('Referer', rtrim(config('app.url'), '/') . '/')
            ->withHeader('X-XSRF-TOKEN', $internalXsrfToken)
            ->postJson('/api/auth/logout')
            ->assertOk();

        $publicLogin = $this->postJson('/api/public/auth/login', [
            'email' => 'switch2.public@portal.test',
            'password' => 'password123',
        ]);

        $publicLogin->assertOk()
            ->assertCookie('XSRF-TOKEN')
            ->assertCookie('public_session');
    }
}