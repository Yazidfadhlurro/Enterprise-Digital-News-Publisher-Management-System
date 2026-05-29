#!/bin/sh
set -e

php artisan config:clear
php artisan migrate --force
php artisan storage:link

# Run queue worker in background
php artisan queue:work --daemon --tries=3 --timeout=90 --sleep=3 &

# Start web server
exec php artisan serve --host=0.0.0.0 --port=${PORT:-8000}
