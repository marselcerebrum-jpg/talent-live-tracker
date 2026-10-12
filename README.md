# Talent Live Tracker — aplikasi (Fase 1 + 2)

Next.js 15 (App Router) + Supabase. Database: project `talent-live-tracker` (ref `qbunkjdkhuawbmzhklgs`).

## Fitur Fase 1

**Talent** (tampilan dioptimalkan untuk HP)
- **Hari ini**: timeline slot hari ini dan 6 hari ke depan. Tombol **Absen** muncul mulai 60 menit sebelum slot dibuka sampai slot ditutup. Jam absen dikunci ke jam server. Ada juga tombol **Selesai live**.
- **Jadwal**: kalender mingguan tim, bisa difilter per akun atau hanya jadwal sendiri.
- **Data live**: form isi data setelah live (pengganti spreadsheet), plus riwayat 30 hari. Sesi otomatis terhubung ke slot jadwal.
- **Absensi**: rekap per bulan berisi status, jam absen, keterangan, total jam live, dan estimasi gaji.
- **Izin**: ajukan dan batalkan izin, lihat status serta catatan admin.
- **Performa**: tayangan per jam, puncak penonton, dan median durasi tonton dibanding rata-rata tim per akun, grafik harian, serta 5 sesi terbaik.
- **Akun**: ganti kata sandi.

**Admin**
- **Ringkasan**: absensi hari ini, izin menunggu, data perlu dicek, total live, dan estimasi gaji bulan ini.
- **Kelola jadwal**: tambah slot satu kali atau berulang (pilih hari dan tanggal akhir), batalkan slot.
- **Persetujuan izin**: setujui atau tolak dengan catatan.
- **Absensi tim**: filter per talent dan status, plus koreksi manual dengan alasan.
- **Data live tim**: rekap jam dan estimasi gaji per talent, daftar sesi, dan input atas nama talent.
- **Performa live**: KPI bulanan, grafik tayangan per hari, peringkat per talent dan per akun (berdasarkan tayangan per jam), dan 10 sesi teratas. Bisa difilter per akun dan talent.
- **Kode promo** (bisa dikunci lewat saklar `feature_promo` di `app_settings`; saat dikunci menu disembunyikan): sales per talent dan per kode untuk periode custom, grafik revenue harian, kelola kode (pemilik, aplikasi, masa berlaku). Tombol **Minta sinkronisasi** diproses manual lewat chat Claude, lihat `docs/sync-kode-promo.md`.
- **Talent & akun**: tambah talent, aktif/nonaktif, buat akun login, atur ulang sandi.
- **Perlu dicek**: perbaiki sesi bermasalah dari impor spreadsheet.

Semua hak akses dijaga di database (RLS), bukan hanya di tampilan.

## Deploy ke Vercel

### 1. Ambil kunci Supabase
Buka Supabase Dashboard, pilih project `talent-live-tracker`, lalu **Project Settings → API Keys**. Salin dua kunci ini:
- **anon / publishable key**: aman dipakai di browser.
- **service_role / secret key**: RAHASIA. Hanya dipakai server untuk membuat akun talent.

### 2. Matikan pendaftaran publik
Buka **Authentication → Sign In / Providers**, lalu matikan **Allow new users to sign up**.
Semua akun dibuat admin dari aplikasi. Kalau pendaftaran dibiarkan aktif, orang luar bisa membuat akun (tanpa akses data, tapi tetap tidak perlu).

### 3. Upload kode ke GitHub
Buat repo baru (private), lalu upload isi folder ini. Jangan sertakan `node_modules`, `.next`, atau file `.env`.

### 4. Import di Vercel
1. Buka vercel.com, pilih **Add New → Project**, lalu import repo tadi.
2. Framework akan terdeteksi otomatis sebagai Next.js. Biarkan pengaturan build default.
3. Di **Environment Variables**, isi:

| Nama | Nilai |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qbunkjdkhuawbmzhklgs.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key |
| `PROMO_INGEST_SECRET` | opsional. String acak panjang (Secret) untuk endpoint `/api/promo/ingest` |

4. Klik **Deploy**.

### 5. Atur URL di Supabase
Buka **Authentication → URL Configuration**. Isi **Site URL** dengan URL Vercel, misalnya `https://talent-live-tracker.vercel.app`.

### 6. Coba masuk
Masuk dengan akun admin `faisaldzakycere@gmail.com`. Setelah itu buka **Talent & akun**, lalu buat akun untuk tiap talent.

## Jalankan di komputer sendiri (opsional)

```bash
cp .env.example .env.local   # isi kuncinya
npm install
npm run dev                  # http://localhost:3000
```

## Catatan teknis
- Zona waktu tampilan dan input: WIB (Asia/Jakarta). Tersimpan sebagai `timestamptz`.
- Gaji dihitung database (`v_session_pay`, `generate_payroll`). Halaman slip dan finalisasi periode masuk Fase 3.
- Data kode promo masuk lewat `POST /api/promo/ingest` (header `Authorization: Bearer <PROMO_INGEST_SECRET>`).
  Isinya baris hasil template Centil `promo-code-sales-daily-range`: `centil_source_id` (atau `_source_id`), `sale_date`,
  `promo_code`, `trx_success`, `buyers_unique`, `revenue_idr`. Upsert per sumber + kode + tanggal, jadi kirim ulang aman.
  Setiap kiriman tercatat di tabel `sync_runs` dan tampil sebagai "Sinkronisasi terakhir" di halaman Kode promo.
