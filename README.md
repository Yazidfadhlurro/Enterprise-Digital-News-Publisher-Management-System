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


## Struktur Workflow

```
Penulis buat artikel → Draft
Draft dikirim        → Review
Editor setuju        → Published (tampil ke publik)
Editor tolak         → Revisi → Review ulang
```

---

Dibuat oleh [Yazid Fadhlurrohman](https://github.com/username) · 2025