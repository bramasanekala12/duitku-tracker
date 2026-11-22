# 💰 DuitKu - Tracker Keuangan & Pengeluaran Pribadi (Supabase Cloud Edition)

Aplikasi web modern, ringan, dan lengkap untuk mencatat dan mengelola keuangan pribadi Anda sehari-hari dengan dukungan penyimpanan **Cloud Supabase**, **SQLite Lokal**, dan **Mode Offline Browser (LocalStorage)**.

---

## 📊 Status Proyek Saat Ini

Proyek ini telah berkembang pesat dan saat ini sudah berada dalam status **Production-Ready & Cloud-Connected**.

### 1. Fitur Frontend & Aplikasi (100% Selesai)
- **Dashboard Ringkasan Keuangan**:
  - Saldo Total Bersih gabungan dari seluruh dompet/rekening.
  - Total Pemasukan & Pengeluaran bulan berjalan serta Sisa Arus Kas (*Net Savings*).
  - Donut Chart kategori pengeluaran & Bar Chart tren arus kas 6 bulan terakhir (menggunakan Chart.js).
- **Pencatatan Transaksi**:
  - Pemasukan, Pengeluaran, dan Transfer Antar-Dompet.
  - Input nominal dengan format Rupiah otomatis (`Rp 50.000`).
  - Kategori dinamis, tanggal, waktu, dan catatan/deskripsi.
- **Multi-Dompet / Rekening**:
  - Dukungan Kas Tunai (*Cash*), Bank (BCA, Mandiri, BRI, dll.), dan E-Wallet (GoPay, OVO, Dana).
  - Saldo dinamis terhitung otomatis *real-time*.
- **Anggaran Bulanan (Budgeting)**:
  - Pasang batas anggaran per kategori pengeluaran.
  - Indikator bar warna pintar: **Aman (Hijau)**, **Hampir Habis (Kuning)**, dan **Overbudget (Merah)**.
- **Laporan & Analisis**:
  - Rata-rata pengeluaran harian, rasio tabungan (*Savings Rate %*), kategori terbesar, dan rincian tabel proporsi pengeluaran.
- **Cadangan & Impor/Ekspor**:
  - Ekspor/Backup JSON lengkap & ekspor CSV ke spreadsheet Excel.
  - Impor dan pulihkan data kapan saja.
- **Desain Mobile-First & Dark Mode**:
  - Responsive untuk HP Android / iOS & Desktop PC.
  - Toggle Tema Gelap & Terang, serta dukungan PWA (*Add to Home Screen*).

### 2. Status Integrasi Supabase Cloud (Sudah Terhubung & Aktif)
- **Kredensial Cloud**:
  - Supabase URL: `https://mxsdpopdrindskskishv.supabase.co`
  - Anon Key: Terkonfigurasi di `static/js/config.js`
- **Database Cloud (PostgreSQL)**:
  - Tabel `wallets`, `categories`, `transactions`, dan `budgets` **sudah aktif di Supabase**.
  - Row Level Security (RLS) terpasang untuk menjaga keamanan data per pengguna.
- **Autentikasi (Supabase Auth)**:
  - Pendaftaran akun baru (*Register*) dan Masuk (*Login*) via email & kata sandi.
  - Listener sesi aktif otomatis menyimpan status login pengguna.
- **Sinkronisasi Data Offline ke Cloud**:
  - Transaksi yang sempat dibuat sebelum login dapat langsung diunggah ke Supabase melalui menu Pengaturan.

---

## 🌐 Cara Menjalankan & Membuat Online

Aplikasi ini dapat dijalankan dengan 2 cara:

### Opsi A: Jalankan Online Secara Gratis (Recommended)
Karena DuitKu dibangun sebagai aplikasi berbasis *Static Web (SPA)* yang terhubung langsung ke Supabase Cloud melalui client SDK, Anda dapat menghostingnya **secara gratis 24/7** tanpa perlu menyewa VPS:

#### 1. Melalui Vercel (Paling Mudah)
1. Unggah folder proyek ini ke repositori **GitHub** Anda.
2. Buka [vercel.com](https://vercel.com) dan login dengan akun GitHub Anda.
3. Klik **"Add New Project"** dan pilih repositori DuitKu.
4. Pengaturan konfigurasi `vercel.json` sudah disediakan otomatis. Klik **"Deploy"**.
5. Aplikasi Anda langsung aktif dengan domain gratis seperti: `https://duitku-anda.vercel.app`.

#### 2. Melalui Netlify
1. Buka [netlify.com](https://app.netlify.com).
2. Anda bisa menghubungkan repositori GitHub atau langsung *Drag & Drop* folder proyek ini ke dashboard Netlify.
3. Konfigurasi `netlify.toml` sudah disiapkan. Aplikasi langsung online!

---

### Opsi B: Jalankan Secara Lokal di Komputer / Termux HP
Jika ingin menggunakan server lokal Python:

```bash
# Di terminal Linux, macOS, atau Termux:
python3 server.py
# atau
bash start.sh
```

Di Windows PowerShell / Command Prompt:
```powershell
python server.py
```

Lalu buka browser Anda di:
👉 **`http://localhost:5000`**

---

## 📁 Struktur Berkas Proyek

```
newprojecttest/
├── static/                     # Frontend Web SPA
│   ├── index.html              # Antarmuka utama aplikasi
│   ├── manifest.json           # Konfigurasi PWA Mobile
│   ├── css/
│   │   └── style.css           # Styling kustom & animasi
│   └── js/
│       ├── config.js           # Kredensial & URL Supabase Cloud
│       ├── api.js              # Client Supabase & Offline LocalStorage Fallback
│       ├── charts.js           # Visualisasi Chart.js
│       └── app.js              # Logika state, modal, auth, dan interaksi UI
├── server.py                   # Server Python lokal (SQLite REST API)
├── supabase_schema.sql         # Skema database & RLS Supabase
├── supabase.txt                # Catatan API key Supabase
├── vercel.json                 # Konfigurasi deploy online Vercel
├── netlify.toml                # Konfigurasi deploy online Netlify
├── start.sh                    # Skrip peluncuran terminal
└── README.md                   # Dokumentasi lengkap
```
