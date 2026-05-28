Halo {{ $user->name }},

Kode verifikasi email Anda adalah: {{ $verificationCode }}

Silakan gunakan kode ini untuk memverifikasi alamat email Anda dalam waktu 24 jam.

Masuk ke aplikasi di sini:
{{ url('/') }}

Atau buka halaman verifikasi dan masukkan kode Anda:
{{ url('/verify-email?email=' . urlencode($user->email)) }}

Jika Anda tidak membuat akun ini, abaikan email ini.

Salam hormat,
Tim Portal Berita
