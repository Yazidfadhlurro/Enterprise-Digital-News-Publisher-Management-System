# Portal Berita

Portal berita berbasis Laravel + React + PostgreSQL.

## Tech Stack

- Laravel 12
- React 18
- PostgreSQL
- Tailwind CSS
- Vite

## Setup

1. Install dependencies:
```bash
composer install
npm install
```

2. Setup environment:
```bash
cp .env.example .env
php artisan key:generate
```

3. Konfigurasi database PostgreSQL di `.env`:
```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=portal_berita
DB_USERNAME=postgres
DB_PASSWORD=your_password
```

4. Jalankan migrasi:
```bash
php artisan migrate
```

5. Start development:
```bash
composer dev
```

## Routes

- `/` - Homepage
- `/react` - React App

## License

MIT
