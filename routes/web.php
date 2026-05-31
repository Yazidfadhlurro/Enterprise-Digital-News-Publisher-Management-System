<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;

// ── Debug endpoint (hapus setelah masalah teridentifikasi) ──────────────────
Route::get('/debug-info', function () {
    $checks = [];

    // 1. APP_KEY
    $checks['app_key_set'] = !empty(config('app.key'));

    // 2. DB connection
    try {
        DB::connection()->getPdo();
        $checks['db_connected'] = true;
        $checks['db_tables'] = DB::select("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    } catch (\Throwable $e) {
        $checks['db_connected'] = false;
        $checks['db_error'] = $e->getMessage();
    }

    // 3. Sessions table
    try {
        $checks['sessions_table'] = DB::table('sessions')->count() >= 0 ? 'exists' : 'exists';
    } catch (\Throwable $e) {
        $checks['sessions_table'] = 'MISSING: ' . $e->getMessage();
    }

    // 4. Build assets
    $manifestPath = public_path('build/manifest.json');
    $checks['manifest_exists'] = file_exists($manifestPath);
    if ($checks['manifest_exists']) {
        $manifest = json_decode(file_get_contents($manifestPath), true);
        $checks['main_js'] = isset($manifest['resources/js/main.jsx']) ? $manifest['resources/js/main.jsx']['file'] : 'NOT FOUND';
    }

    // 5. Env
    $checks['app_env'] = config('app.env');
    $checks['app_url'] = config('app.url');
    $checks['session_driver'] = config('session.driver');
    $checks['sanctum_stateful'] = config('sanctum.stateful');

    return response()->json($checks);
});
// ───────────────────────────────────────────────────────────────────────────

$spa = function () {
    return response(view('spa'))
        ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
        ->header('Pragma', 'no-cache')
        ->header('Expires', '0');
};

Route::get('/', $spa);
Route::get('/register', $spa);
Route::get('/verify-email', $spa);
Route::get('/invite/{token}', $spa);
Route::get('/welcome', $spa);
Route::get('/internal/login', $spa);
Route::get('/forgot-password', $spa);
Route::get('/reset-password/{token}', $spa);
Route::get('/admin/dashboard', $spa);
Route::get('/admin/articles', $spa);
Route::get('/admin/categories', $spa);
Route::get('/admin/users', $spa);
Route::get('/admin/assignments', $spa);
Route::get('/admin/activities', $spa);
Route::get('/admin/feedback', $spa);
Route::get('/admin/permissions', $spa);
Route::get('/admin/settings', $spa);
Route::get('/editor', $spa);
Route::get('/editor/dashboard', $spa);
Route::get('/editor/review', $spa);
Route::get('/editor/review/{id}', $spa);
Route::get('/editor/published', $spa);
Route::get('/editor/activities', $spa);
Route::get('/editor/feedback', $spa);
Route::get('/editor/settings', $spa);
Route::get('/author', $spa);
Route::get('/author/dashboard', $spa);
Route::get('/author/articles', $spa);
Route::get('/author/articles/create', $spa);
Route::get('/author/articles/{id}/edit', $spa);
Route::get('/author/activities', $spa);
Route::get('/author/feedback', $spa);
Route::get('/author/settings', $spa);
Route::get('/reader', $spa);
Route::get('/reader/home', $spa);
Route::get('/reader/articles/{identifier}', $spa);
Route::get('/reader/bookmarks', $spa);
Route::get('/reader/settings', $spa);


