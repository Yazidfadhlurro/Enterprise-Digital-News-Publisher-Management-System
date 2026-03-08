# Enterprise Digital News & Publisher Management System

Sistem manajemen portal berita berbasis web dengan alur editorial terstruktur. Dibangun menggunakan Laravel dan React.js sebagai bagian dari proyek magang di PT. Winnicode Garuda Teknologi.

---

## Tech Stack

- **Backend** — Laravel
- **Frontend** — React.js
- **Database** — PostgreSQL
- **Auth** — Laravel Sanctum / JWT
- **API** — REST API over HTTPS

---

## Fitur Utama

- Login dengan Role-Based Access Control (Admin, Editor, Penulis)
- Manajemen artikel: buat, edit, hapus, kategori, tag, metadata SEO
- Workflow editorial: `Draft → Review → Revisi → Published`
- Dashboard berbeda untuk setiap role
- Halaman publik untuk artikel yang sudah dipublish
- Audit log untuk aktivitas penting (login, publish, edit, delete)

---

## Role Pengguna

| Role | Akses |
|---|---|
| Administrator | Kelola akun pengguna dan konfigurasi sistem |
| Editor | Review artikel, approve atau minta revisi |
| Penulis | Buat dan kelola artikel milik sendiri |

---

## Instalasi

```bash
# Clone repo
git clone https://github.com/username/ednpms.git
cd ednpms

# Backend
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve

# Frontend
cd frontend
npm install
cp .env.example .env
npm run dev
```

---

## Environment Variables

Salin `.env.example` menjadi `.env` lalu sesuaikan:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=ednpms
DB_USERNAME=postgres
DB_PASSWORD=your_password

VITE_API_URL=http://localhost:8000/api
```

---

## Struktur Workflow

```
Penulis buat artikel → Draft
Draft dikirim        → Review
Editor setuju        → Published (tampil ke publik)
Editor tolak         → Revisi → Review ulang
```

---

Dibuat oleh [Yazid Fadhlurrohman](https://github.com/username) · 2025