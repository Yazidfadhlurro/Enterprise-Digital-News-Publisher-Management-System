<?php

use Illuminate\Support\Facades\Route;

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


