<?php

namespace App\Providers;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoTransportFactory;
use Symfony\Component\Mailer\Transport\Dsn;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Mail::extend('brevo', function () {
            return (new BrevoTransportFactory)->create(
                new Dsn('brevo+api', 'default', config('services.brevo.key'))
            );
        });

        $publicStorage = public_path('storage');
        $appPublic = storage_path('app/public');

        if (!File::exists($publicStorage) && File::isDirectory($appPublic)) {
            try {
                File::link($appPublic, $publicStorage);
            } catch (\Throwable) {}
        }
    }
}
