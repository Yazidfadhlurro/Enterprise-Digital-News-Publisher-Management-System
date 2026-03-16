<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;


Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login'])->name('login');
    Route::post('/verify-email', [AuthController::class, 'verifyEmail']);
});


Route::middleware('auth:sanctum')->group(function () {
    // Auth Routes (All Users)
    Route::prefix('auth')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
    });


    Route::middleware(['role:admin'])->prefix('admin')->group(function () {
        // User Management
        Route::post('/users', [UserController::class, 'store']);
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/users/{id}', [UserController::class, 'show']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);

        // User Approval & Status Management
        Route::post('/users/{id}/approve', [UserController::class, 'approve']);
        Route::post('/users/{id}/reject', [UserController::class, 'reject']);
        Route::post('/users/{id}/suspend', [UserController::class, 'suspend']);
        Route::post('/users/{id}/unsuspend', [UserController::class, 'unsuspend']);

        // Article Management
        Route::get('/articles', function () {
            return response()->json([
                'status' => 'success',
                'message' => 'All articles retrieved',
                'data' => ['articles' => []]
            ]);
        });

        // Dashboard
        Route::get('/dashboard', function () {
            return response()->json([
                'status' => 'success',
                'message' => 'Dashboard stats retrieved',
                'data' => [
                    'total_users' => 0,
                    'total_articles' => 0,
                    'pending_articles' => 0,
                ]
            ]);
        });
    });


    Route::middleware(['role:author,admin'])->prefix('author')->group(function () {
        Route::post('/articles', function () {
            return response()->json([
                'status' => 'success',
                'message' => 'Article created',
            ]);
        });

        Route::get('/articles', function () {
            return response()->json([
                'status' => 'success',
                'message' => 'Author articles retrieved',
                'data' => ['articles' => []]
            ]);
        });

        Route::put('/articles/{id}', function ($id) {
            return response()->json([
                'status' => 'success',
                'message' => 'Article updated',
            ]);
        });

        Route::delete('/articles/{id}', function ($id) {
            return response()->json([
                'status' => 'success',
                'message' => 'Article deleted',
            ]);
        });
    });



    Route::middleware(['role:reviewer,admin'])->prefix('reviewer')->group(function () {
        Route::get('/articles', function () {
            return response()->json([
                'status' => 'success',
                'message' => 'Pending articles for review',
                'data' => ['articles' => []]
            ]);
        });

        Route::post('/articles/{id}/approve', function ($id) {
            return response()->json([
                'status' => 'success',
                'message' => 'Article approved',
            ]);
        });

        Route::post('/articles/{id}/reject', function ($id) {
            return response()->json([
                'status' => 'success',
                'message' => 'Article rejected',
            ]);
        });
    });



    Route::prefix('user')->group(function () {
        // Browse Articles
        Route::get('/articles', function () {
            return response()->json([
                'status' => 'success',
                'message' => 'User can browse articles',
                'data' => ['articles' => []]
            ]);
        });

        Route::get('/articles/{id}', function ($id) {
            return response()->json([
                'status' => 'success',
                'message' => 'Article details retrieved',
                'data' => ['article' => null]
            ]);
        });

        // Comments
        Route::post('/comments', function () {
            return response()->json([
                'status' => 'success',
                'message' => 'Comment created',
            ]);
        });

        // Likes & Bookmarks
        Route::post('/articles/{id}/like', function ($id) {
            return response()->json([
                'status' => 'success',
                'message' => 'Article liked',
            ]);
        });

        Route::post('/articles/{id}/bookmark', function ($id) {
            return response()->json([
                'status' => 'success',
                'message' => 'Article bookmarked',
            ]);
        });

        Route::get('/bookmarks', function () {
            return response()->json([
                'status' => 'success',
                'message' => 'User bookmarks retrieved',
                'data' => ['bookmarks' => []]
            ]);
        });
    });
});


Route::fallback(function () {
    return response()->json([
        'status' => 'error',
        'message' => 'API endpoint not found',
    ], 404);
});
