FROM php:8.3-cli

RUN apt-get update && apt-get install -y \
    git curl zip unzip libpq-dev libpng-dev libxml2-dev libzip-dev \
    && docker-php-ext-install pdo pdo_pgsql pgsql mbstring xml zip gd bcmath \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs && apt-get clean

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build \
    && composer dump-autoload --optimize \
    && mkdir -p storage/framework/views storage/framework/sessions storage/framework/cache/data storage/logs storage/app/public \
    && chmod -R 775 storage bootstrap/cache \
    && chmod +x docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
