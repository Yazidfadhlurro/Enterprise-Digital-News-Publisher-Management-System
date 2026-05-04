<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class RealisticReaderArticlesSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::query()
            ->where('role', 'author')
            ->where('status', 'active')
            ->orderBy('id')
            ->first();

        if (!$author) {
            $author = User::query()->create([
                'name' => 'Author Real News',
                'email' => 'author.realnews@portal.com',
                'password' => Hash::make('password'),
                'role' => 'author',
                'assigned_reviewer_id' => null,
                'status' => 'active',
                'email_verified_at' => now(),
                'email_verification_code' => null,
            ]);
        }

        $reviewerId = User::query()
            ->where('role', 'reviewer')
            ->where('status', 'active')
            ->value('id');

        $categoryMap = $this->ensureCategories();

        // Remove all existing articles so previous dummy content is fully replaced.
        DB::table('articles')->delete();

        $articles = [
            [
                'title' => 'Pemerintah Resmikan Pusat Data Nasional Tahap Kedua di Jawa Barat',
                'slug' => 'pemerintah-resmikan-pusat-data-nasional-tahap-kedua-di-jawa-barat',
                'category_slug' => 'teknologi',
                'excerpt' => 'Fasilitas baru ini ditargetkan mempercepat integrasi layanan publik digital lintas kementerian dan pemerintah daerah.',
                'content' => '<p>Pemerintah resmi meresmikan Pusat Data Nasional (PDN) tahap kedua di wilayah Jawa Barat pada Selasa pagi. Proyek ini menjadi bagian dari strategi percepatan transformasi digital nasional untuk menyatukan infrastruktur data instansi pusat maupun daerah dalam satu kerangka tata kelola.</p><p>Menteri Komunikasi dan Digital menyebut fasilitas baru tersebut dirancang dengan standar keamanan berlapis, termasuk pemantauan jaringan 24 jam, segmentasi data kritikal, serta skema pemulihan bencana yang dapat dijalankan otomatis bila terjadi gangguan layanan.</p><p>Dalam tahap awal operasional, PDN tahap kedua akan menampung layanan prioritas seperti administrasi kependudukan, sistem pembayaran pemerintah, dan layanan perizinan digital. Pemerintah juga menargetkan efisiensi belanja infrastruktur TI lintas lembaga hingga dua digit dalam tiga tahun.</p><p>Sejumlah pakar menilai keberhasilan PDN bukan hanya ditentukan oleh teknologi, melainkan juga konsistensi migrasi data, peningkatan kompetensi SDM, dan kepatuhan instansi terhadap standar interoperabilitas nasional.</p>',
                'is_featured' => true,
                'views_count' => 412,
                'hours_ago' => 2,
            ],
            [
                'title' => 'Nilai Ekspor Produk Olahan Pangan Naik 12 Persen pada Kuartal Pertama 2026',
                'slug' => 'nilai-ekspor-produk-olahan-pangan-naik-12-persen-pada-kuartal-pertama-2026',
                'category_slug' => 'bisnis',
                'excerpt' => 'Kenaikan didorong permintaan pasar Asia Timur dan Timur Tengah terhadap produk makanan siap saji asal Indonesia.',
                'content' => '<p>Kementerian Perdagangan melaporkan nilai ekspor produk olahan pangan Indonesia pada kuartal pertama 2026 meningkat 12 persen dibanding periode yang sama tahun lalu. Pertumbuhan tertinggi datang dari produk makanan siap saji, bumbu instan, dan minuman berbasis herbal.</p><p>Direktur Jenderal Pengembangan Ekspor Nasional menyatakan peningkatan ini dipicu kombinasi perbaikan rantai pasok, perluasan sertifikasi mutu, serta promosi dagang yang lebih terarah pada negara tujuan potensial.</p><p>Pelaku industri menilai tantangan terbesar saat ini adalah stabilitas biaya logistik dan kepastian pasokan bahan baku. Asosiasi produsen mendorong sinkronisasi kebijakan antardaerah agar proses distribusi antarpelabuhan lebih efisien, khususnya menjelang puncak permintaan semester kedua.</p><p>Pemerintah menargetkan tren positif ini berlanjut hingga akhir tahun dengan memperkuat skema pembiayaan ekspor untuk UMKM dan memperluas akses pendampingan kepatuhan standar internasional.</p>',
                'is_featured' => false,
                'views_count' => 287,
                'hours_ago' => 6,
            ],
            [
                'title' => 'DPR Mulai Bahas RUU Perlindungan Data Anak di Ruang Digital',
                'slug' => 'dpr-mulai-bahas-ruu-perlindungan-data-anak-di-ruang-digital',
                'category_slug' => 'politik',
                'excerpt' => 'Pembahasan awal menyoroti kewajiban platform digital untuk membatasi profilisasi dan iklan tertarget kepada anak.',
                'content' => '<p>Dewan Perwakilan Rakyat memulai pembahasan awal RUU Perlindungan Data Anak di ruang digital dalam rapat kerja bersama pemerintah dan pemangku kepentingan. Agenda utama pembahasan mencakup batasan pengumpulan data, mekanisme persetujuan orang tua, serta tata kelola pelaporan pelanggaran.</p><p>Sejumlah anggota panitia kerja menekankan bahwa regulasi baru harus mampu menjawab perkembangan model bisnis platform digital yang semakin kompleks, termasuk penggunaan kecerdasan buatan untuk rekomendasi konten.</p><p>Di sisi lain, pelaku industri meminta aturan yang disusun tetap memberikan kepastian implementasi teknis agar tidak menimbulkan beban kepatuhan yang tidak proporsional bagi pelaku usaha kecil dan menengah.</p><p>Rapat lanjutan dijadwalkan pekan depan dengan fokus pada penyusunan norma sanksi administratif dan penguatan mekanisme audit independen atas sistem pemrosesan data anak.</p>',
                'is_featured' => false,
                'views_count' => 198,
                'hours_ago' => 10,
            ],
            [
                'title' => 'Timnas U-23 Menang Tipis 2-1 dalam Laga Persahabatan Jelang Kualifikasi',
                'slug' => 'timnas-u23-menang-tipis-2-1-dalam-laga-persahabatan-jelang-kualifikasi',
                'category_slug' => 'olahraga',
                'excerpt' => 'Pelatih menilai transisi bertahan ke menyerang mulai membaik meski koordinasi lini belakang masih perlu evaluasi.',
                'content' => '<p>Tim nasional U-23 meraih kemenangan 2-1 dalam laga persahabatan internasional yang digelar di Stadion Utama pada Senin malam. Hasil ini menjadi modal penting menjelang rangkaian kualifikasi yang akan berlangsung bulan depan.</p><p>Dua gol timnas dicetak pada babak pertama melalui skema bola mati dan serangan balik cepat. Meski unggul lebih dulu, tim lawan sempat memperkecil ketertinggalan di babak kedua setelah memanfaatkan celah antarlini pertahanan.</p><p>Pelatih kepala menyatakan aspek yang paling berkembang adalah intensitas pressing dan akurasi umpan vertikal. Namun, ia menyoroti konsentrasi bertahan pada 20 menit terakhir yang dinilai masih belum konsisten.</p><p>Staf pelatih akan memanfaatkan jeda latihan pekan ini untuk memperbaiki koordinasi lini belakang dan mematangkan variasi serangan di sisi sayap.</p>',
                'is_featured' => false,
                'views_count' => 349,
                'hours_ago' => 14,
            ],
            [
                'title' => 'Kementerian Kesehatan Perluas Program Skrining Diabetes di 200 Puskesmas',
                'slug' => 'kementerian-kesehatan-perluas-program-skrining-diabetes-di-200-puskesmas',
                'category_slug' => 'kesehatan',
                'excerpt' => 'Program menargetkan deteksi dini kelompok usia produktif melalui pemeriksaan gula darah dan edukasi gaya hidup sehat.',
                'content' => '<p>Kementerian Kesehatan mengumumkan perluasan program skrining diabetes di 200 puskesmas tambahan pada semester ini. Kebijakan ini difokuskan pada deteksi dini warga usia produktif dengan faktor risiko tinggi seperti obesitas, hipertensi, dan riwayat keluarga.</p><p>Direktur Pencegahan Penyakit Tidak Menular menyebut pendekatan layanan akan menggabungkan pemeriksaan laboratorium sederhana, konsultasi gizi, serta pemantauan berkala melalui aplikasi kesehatan primer.</p><p>Sejumlah daerah telah melaporkan peningkatan partisipasi warga setelah puskesmas menerapkan jadwal layanan malam dan akhir pekan. Model tersebut dinilai efektif menjangkau pekerja formal yang sulit hadir pada jam kerja biasa.</p><p>Pemerintah menargetkan program ini mampu menekan keterlambatan diagnosis serta meningkatkan kepatuhan terapi melalui penguatan sistem rujukan dan edukasi keluarga.</p>',
                'is_featured' => false,
                'views_count' => 236,
                'hours_ago' => 20,
            ],
        ];

        foreach ($articles as $index => $article) {
            $publishedAt = now()->subHours((int) $article['hours_ago']);

            DB::table('articles')->insert([
                'author_id' => $author->id,
                'category_id' => $categoryMap[$article['category_slug']] ?? null,
                'title' => $article['title'],
                'slug' => $article['slug'],
                'excerpt' => $article['excerpt'],
                'content' => $article['content'],
                'featured_image' => null,
                'featured_image_alt' => null,
                'status' => 'published',
                'priority_score' => $index === 0 ? 85 : 65,
                'review_due_at' => null,
                'reviewer_id' => $reviewerId,
                'review_notes' => null,
                'published_at' => $publishedAt,
                'is_featured' => (bool) $article['is_featured'],
                'views_count' => (int) $article['views_count'],
                'created_at' => $publishedAt,
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * @return array<string, int>
     */
    private function ensureCategories(): array
    {
        $definitions = [
            [
                'name' => 'Teknologi',
                'slug' => 'teknologi',
                'description' => 'Berita seputar teknologi digital dan inovasi.',
            ],
            [
                'name' => 'Bisnis',
                'slug' => 'bisnis',
                'description' => 'Berita ekonomi, industri, dan pasar.',
            ],
            [
                'name' => 'Politik',
                'slug' => 'politik',
                'description' => 'Perkembangan kebijakan dan dinamika politik nasional.',
            ],
            [
                'name' => 'Olahraga',
                'slug' => 'olahraga',
                'description' => 'Informasi pertandingan dan performa atlet.',
            ],
            [
                'name' => 'Kesehatan',
                'slug' => 'kesehatan',
                'description' => 'Edukasi kesehatan publik dan layanan medis.',
            ],
        ];

        $result = [];

        foreach ($definitions as $definition) {
            DB::table('categories')->updateOrInsert(
                ['slug' => $definition['slug']],
                [
                    'name' => $definition['name'],
                    'description' => $definition['description'],
                    'is_active' => true,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );

            $result[$definition['slug']] = (int) DB::table('categories')
                ->where('slug', $definition['slug'])
                ->value('id');
        }

        return $result;
    }
}
