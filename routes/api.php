<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AdminPermissionController;
use App\Http\Controllers\AdminArticleController;
use App\Http\Controllers\AdminCategoryController;
use App\Http\Controllers\AdminActivityController;
use App\Http\Controllers\AdminAssignmentController;
use App\Http\Controllers\ArticleFeedbackController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\RegistrationInviteController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\ReviewerArticleController;
use App\Http\Controllers\AuthorArticleController;
use App\Http\Controllers\ReaderArticleController;

Route::prefix('public/auth')->middleware([
    \App\Http\Middleware\EncryptCookies::class,
    \App\Http\Middleware\NormalizeCsrfToken::class,
    \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
    \Illuminate\Session\Middleware\StartSession::class,
])->group(function () {
    Route::post('/register', [AuthController::class, 'registerPublic'])
        ->middleware('throttle:5,1');
    Route::post('/register/invite', [AuthController::class, 'registerInvite'])
        ->middleware('throttle:5,1');
    Route::post('/login', [AuthController::class, 'loginPublic'])
        ->middleware('throttle:10,1')
        ->name('public.login');
    Route::post('/forgot-password', [AuthController::class, 'forgotPasswordPublic'])
        ->middleware('throttle:5,1');
    Route::post('/reset-password', [AuthController::class, 'resetPasswordPublic'])
        ->middleware('throttle:5,1');
    Route::post('/verify-email', [AuthController::class, 'verifyEmailPublic'])
        ->middleware('throttle:5,1');
    Route::post('/resend-verification', [AuthController::class, 'resendVerification'])
        ->middleware('throttle:3,1');
    Route::get('/invites/{token}', [RegistrationInviteController::class, 'showPublic'])
        ->middleware('throttle:30,1');
});

Route::prefix('internal/auth')->middleware([
    \App\Http\Middleware\EncryptCookies::class,
    \App\Http\Middleware\NormalizeCsrfToken::class,
    \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
    \Illuminate\Session\Middleware\StartSession::class,
])->group(function () {
    Route::post('/login', [AuthController::class, 'loginInternal'])
        ->middleware('throttle:10,1')
        ->name('internal.login');
});

// Compatibility mode untuk klien lama.
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'registerLegacy'])
        ->middleware('throttle:5,1');
    Route::post('/login', [AuthController::class, 'loginLegacy'])
        ->middleware('throttle:10,1')
        ->name('login');
    Route::post('/forgot-password', [AuthController::class, 'forgotPasswordLegacy'])
        ->middleware('throttle:5,1');
    Route::post('/reset-password', [AuthController::class, 'resetPasswordLegacy'])
        ->middleware('throttle:5,1');
    Route::post('/verify-email', [AuthController::class, 'verifyEmailLegacy'])
        ->middleware('throttle:5,1');
});


// Public reader routes — tidak perlu login
Route::prefix('public')->group(function () {
    Route::get('/articles', [ReaderArticleController::class, 'index']);
    Route::get('/articles/insights', [ReaderArticleController::class, 'insights']);
    Route::get('/articles/{identifier}/comments', [ReaderArticleController::class, 'comments']);
    Route::get('/articles/{identifier}', [ReaderArticleController::class, 'show']);
});

Route::middleware([
    \App\Http\Middleware\EncryptCookies::class,
    \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
    \App\Http\Middleware\MapScopeSessionCookie::class,
    \Illuminate\Session\Middleware\StartSession::class,
    \App\Http\Middleware\NormalizeCsrfToken::class,
    'auth:web',
    'throttle-role',
    'active-account',
])->group(function () {
    // Auth Routes (All Users)
    Route::prefix('auth')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/profile', [AuthController::class, 'updateProfileDeprecated']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
    });


    Route::middleware(['auth-scope:internal', 'role:admin'])->prefix('admin')->group(function () {
        // User Management
        Route::post('/users', [UserController::class, 'store'])
            ->middleware('action-permission:admin.users.create');
        Route::get('/users', [UserController::class, 'index'])
            ->middleware('action-permission:admin.users.view');
        Route::get('/users/{id}', [UserController::class, 'show'])
            ->middleware('action-permission:admin.users.view');
        Route::put('/users/{id}', [UserController::class, 'update'])
            ->middleware('action-permission:admin.users.update');
        Route::delete('/users/{id}', [UserController::class, 'destroy'])
            ->middleware('action-permission:admin.users.delete');

        // User Approval & Status Management
        Route::post('/users/{id}/approve', [UserController::class, 'approve'])
            ->middleware('action-permission:admin.users.status');
        Route::post('/users/{id}/reject', [UserController::class, 'reject'])
            ->middleware('action-permission:admin.users.status');
        Route::post('/users/{id}/suspend', [UserController::class, 'suspend'])
            ->middleware('action-permission:admin.users.status');
        Route::post('/users/{id}/unsuspend', [UserController::class, 'unsuspend'])
            ->middleware('action-permission:admin.users.status');

        // Assignment Matrix
        Route::get('/assignments/matrix', [AdminAssignmentController::class, 'matrix'])
            ->middleware('action-permission:admin.assignments.view');
        Route::post('/assignments/move', [AdminAssignmentController::class, 'moveAuthor'])
            ->middleware('action-permission:admin.assignments.update');
        Route::post('/assignments/bulk-move', [AdminAssignmentController::class, 'bulkMoveAuthors'])
            ->middleware('action-permission:admin.assignments.update');
        Route::post('/assignments/reassign-inactive-reviewer', [AdminAssignmentController::class, 'reassignInactiveReviewer'])
            ->middleware('action-permission:admin.assignments.update');
        Route::get('/assignments/logs', [AdminAssignmentController::class, 'logs'])
            ->middleware('action-permission:admin.assignments.view');

        // Article Management
        Route::post('/articles', [AdminArticleController::class, 'store'])
            ->middleware('action-permission:admin.articles.create');
        Route::get('/articles', [AdminArticleController::class, 'index'])
            ->middleware('action-permission:admin.articles.view');
        Route::get('/articles/{id}', [AdminArticleController::class, 'show'])
            ->middleware('action-permission:admin.articles.view');
        Route::put('/articles/{id}', [AdminArticleController::class, 'update'])
            ->middleware('action-permission:admin.articles.update');
        Route::patch('/articles/{id}/featured', [AdminArticleController::class, 'toggleFeatured'])
            ->middleware('action-permission:admin.articles.update');
        Route::delete('/articles/{id}', [AdminArticleController::class, 'destroy'])
            ->middleware('action-permission:admin.articles.delete');

        // Category Management
        Route::post('/categories', [AdminCategoryController::class, 'store'])
            ->middleware('action-permission:admin.categories.create');
        Route::get('/categories', [AdminCategoryController::class, 'index'])
            ->middleware('action-permission:admin.categories.view');
        Route::get('/categories/{id}', [AdminCategoryController::class, 'show'])
            ->middleware('action-permission:admin.categories.view');
        Route::put('/categories/{id}', [AdminCategoryController::class, 'update'])
            ->middleware('action-permission:admin.categories.update');
        Route::delete('/categories/{id}', [AdminCategoryController::class, 'destroy'])
            ->middleware('action-permission:admin.categories.delete');

        // Dashboard
        Route::get('/dashboard', [AdminDashboardController::class, 'index'])
            ->middleware('action-permission:admin.dashboard.view');

        Route::get('/feedback', [ArticleFeedbackController::class, 'adminIndex'])
            ->middleware('action-permission:admin.activities.view');

        // Permission Matrix
        Route::get('/permissions', [AdminPermissionController::class, 'index'])
            ->middleware('action-permission:admin.permissions.view');
        Route::put('/permissions', [AdminPermissionController::class, 'update'])
            ->middleware('action-permission:admin.permissions.update');

        // Activity Logs
        Route::get('/activities', [AdminActivityController::class, 'index'])
            ->middleware('action-permission:admin.activities.view');
        Route::get('/activities/export', [AdminActivityController::class, 'exportCsv'])
            ->middleware('action-permission:admin.activities.export');

        // Internal registration invites
        Route::get('/invites', [RegistrationInviteController::class, 'index']);
        Route::post('/invites', [RegistrationInviteController::class, 'store']);
        Route::post('/invites/{id}/revoke', [RegistrationInviteController::class, 'revoke']);
    });


    Route::middleware(['auth-scope:internal', 'role:author,admin'])->prefix('author')->group(function () {
        Route::get('/dashboard', [AuthorArticleController::class, 'dashboard'])
            ->middleware('action-permission:author.dashboard.view');
        Route::get('/activities', [AuthorArticleController::class, 'activities'])
            ->middleware('action-permission:author.activities.view');
        Route::get('/categories', [AuthorArticleController::class, 'categories']);
        Route::post('/categories', [AuthorArticleController::class, 'storeCategory']);
        Route::post('/articles', [AuthorArticleController::class, 'store'])
            ->middleware('action-permission:author.articles.create');
        Route::get('/articles', [AuthorArticleController::class, 'index'])
            ->middleware('action-permission:author.articles.view');
        Route::get('/articles/{id}', [AuthorArticleController::class, 'show'])
            ->middleware('action-permission:author.articles.view');
        Route::put('/articles/{id}', [AuthorArticleController::class, 'update'])
            ->middleware('action-permission:author.articles.update');
        Route::post('/articles/{id}/autosave', [AuthorArticleController::class, 'autosave'])
            ->middleware('action-permission:author.articles.autosave');
        Route::get('/articles/{id}/versions', [AuthorArticleController::class, 'versions'])
            ->middleware('action-permission:author.articles.versions.view');
        Route::delete('/articles/{id}', [AuthorArticleController::class, 'destroy'])
            ->middleware('action-permission:author.articles.delete');
        Route::get('/media', [AuthorArticleController::class, 'mediaIndex'])
            ->middleware('action-permission:author.media.view');
        Route::post('/media', [AuthorArticleController::class, 'mediaStore'])
            ->middleware('action-permission:author.media.upload');
        Route::delete('/media/{id}', [AuthorArticleController::class, 'mediaDestroy'])
            ->middleware('action-permission:author.media.upload');
        Route::get('/feedback', [ArticleFeedbackController::class, 'authorIndex'])
            ->middleware('action-permission:author.activities.view');
    });



    Route::middleware(['auth-scope:internal', 'role:reviewer,admin'])->prefix('reviewer')->group(function () {
        Route::get('/dashboard', [ReviewerArticleController::class, 'dashboard'])
            ->middleware('action-permission:reviewer.dashboard.view');
        Route::get('/activities', [ReviewerArticleController::class, 'activities'])
            ->middleware('action-permission:reviewer.activities.view');
        Route::get('/articles', [ReviewerArticleController::class, 'index'])
            ->middleware('action-permission:reviewer.review.queue.view');
        Route::get('/articles/{id}', [ReviewerArticleController::class, 'show'])
            ->middleware('action-permission:reviewer.review.detail.view');
        Route::post('/articles/{id}/approve', [ReviewerArticleController::class, 'approve'])
            ->middleware('action-permission:reviewer.review.approve');
        Route::post('/articles/{id}/reject', [ReviewerArticleController::class, 'reject'])
            ->middleware('action-permission:reviewer.review.reject');
        Route::get('/feedback', [ArticleFeedbackController::class, 'reviewerIndex'])
            ->middleware('action-permission:reviewer.activities.view');
    });



    Route::middleware(['auth-scope:public,internal', 'role:user,admin'])->prefix('user')->group(function () {
        Route::post('/articles/{identifier}/comments', [ReaderArticleController::class, 'storeComment']);
        Route::post('/articles/{identifier}/like', [ReaderArticleController::class, 'toggleLike']);
        Route::post('/articles/{identifier}/bookmark', [ReaderArticleController::class, 'toggleBookmark']);
        Route::post('/articles/{identifier}/rating', [ReaderArticleController::class, 'rate']);
        Route::get('/bookmarks', [ReaderArticleController::class, 'bookmarks']);
    });
});


Route::fallback(function () {
    return response()->json([
        'status' => 'error',
        'message' => 'Endpoint API tidak ditemukan.',
    ], 404);
});
