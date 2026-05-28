<?php

namespace App\Providers;

use Illuminate\Support\Facades\File;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $publicStorage = public_path('storage');
        $appPublic = storage_path('app/public');

        if (!File::exists($publicStorage) && File::isDirectory($appPublic)) {
            try {
                File::link($appPublic, $publicStorage);
            } catch (\Throwable) {
                // Symlink may require elevated permissions on some hosts.
            }
        }
    }
}
