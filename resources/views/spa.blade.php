<!DOCTYPE html>
<html lang="id" translate="no">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="google" content="notranslate">
    <title>Portal Berita</title>
    @viteReactRefresh
    @vite(['resources/js/main.jsx'])
</head>
<body>
    <div id="app" class="notranslate">
        <div id="app-loading" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f3f6fb; color: #334155; font-family: Arial, sans-serif;">
            Memuat aplikasi...
        </div>
    </div>
    <script>
        // Tampilkan pesan error jika React gagal mount dalam 10 detik
        setTimeout(function() {
            var app = document.getElementById('app');
            var loading = document.getElementById('app-loading');
            if (loading && loading.parentNode === app && app.children.length === 1) {
                loading.innerHTML = '<div style="text-align:center;padding:2rem"><h2 style="color:#dc2626">Gagal memuat aplikasi</h2><p>Coba refresh halaman. Jika masalah berlanjut, hubungi administrator.</p><button onclick="location.reload()" style="padding:0.5rem 1.5rem;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:1rem">Refresh</button></div>';
            }
        }, 10000);
    </script>
</body>
</html>
