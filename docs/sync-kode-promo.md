# Sync kode promo Live Hub (manual lewat chat Claude)

Aplikasi tidak mengakses Centil. Admin menekan **Minta sinkronisasi** di halaman Kode promo, lalu permintaan
masuk ke tabel `sync_requests`. Claude memprosesnya lewat konektor **Supabase (Live Tracker)** dan **Centil**.

## Cara pakai

1. Di aplikasi, buka **Kode promo**, pilih rentang tanggal, lalu tekan **Minta sinkronisasi**.
2. Buka chat Claude di project Live Hub (konektor **Supabase (Live Tracker)** dan **Centil** aktif), lalu ketik:
   **proses sync kode promo Live Hub**
3. Setelah Claude melaporkan selesai, muat ulang halaman Kode promo.

Simpan dokumen ini di **Project knowledge** supaya chat baru di project ini tahu langkah-langkahnya.
Kalau Claude belum tahu, tempel blok "Langkah untuk Claude" di bawah ke chat.

## Langkah untuk Claude

```
Proses antrean sinkronisasi kode promo aplikasi Live Hub.
Project Supabase: qbunkjdkhuawbmzhklgs (konektor "Supabase (Live Tracker)").

1. Ambil satu permintaan dan kunci, dengan execute_sql:
   update sync_requests set status = 'processing', started_at = now()
   where id = (select id from sync_requests where status = 'pending' and kind = 'centil_promo'
               order by requested_at limit 1)
   returning id, range_start, range_end;
   Kalau tidak ada baris yang kembali, sampaikan bahwa tidak ada permintaan menunggu (minta admin menekan tombol dulu), lalu berhenti.

2. Ambil kode aktif per sumber:
   select centil_source_id, string_agg(code, ',' order by code) as codes
   from promo_codes where is_active group by centil_source_id;

3. Jalankan tool Centil centil_execute_query_template SEKALI untuk semua sumber:
   template_id "promo-code-sales-daily-range", all_compatible true, mode "separate",
   params { start_date: range_start, end_date: range_end, codes: <semua kode dari langkah 2, dipisah koma> }.
   Dari results_by_source, ambil hanya baris yang kodenya terdaftar untuk sumber itu di langkah 2
   (abaikan sumber lain seperti jagotpa/toeflacademy). Kalau ada sumber "truncated": true,
   ulangi untuk sumber itu saja dengan rentang dipotong per 14 hari.

4. Simpan semua baris hasil dengan satu execute_sql:
   insert into promo_sales_daily (centil_source_id, code, sale_date, trx_success, buyers_unique, revenue_idr)
   values (...)
   on conflict (centil_source_id, code, sale_date) do update
     set trx_success = excluded.trx_success, buyers_unique = excluded.buyers_unique,
         revenue_idr = excluded.revenue_idr, synced_at = now();
   Lewati langkah ini kalau tidak ada baris.

5. Tandai selesai dan catat:
   update sync_requests set status = 'done', finished_at = now(), rows = <jumlah baris>,
     note = '<ringkas: sumber yang ada penjualannya>' where id = <id>;
   insert into sync_runs (kind, params, finished_at, status, rows)
   values ('centil_promo', '{"via":"scheduled task Claude","request_id":<id>}', now(), 'success', <jumlah baris>);

6. Kalau ada langkah yang gagal: update sync_requests set status = 'failed', finished_at = now(),
   note = '<pesan error singkat>' where id = <id>; lalu berhenti.

7. Laporkan singkat: rentang tanggal, jumlah baris, dan talent mana yang ada penjualannya.

Hanya baca dari Centil. Jangan ubah tabel lain selain sync_requests, promo_sales_daily, dan sync_runs.
```

## Kalau permintaan macet di "Diproses"

Biasanya karena chat terhenti di tengah proses. Minta Claude menandainya gagal, atau Jalankan di Supabase SQL Editor:

```sql
update sync_requests set status = 'failed', finished_at = now(), note = 'Macet, direset manual'
where status = 'processing' and started_at < now() - interval '30 minutes';
```

Setelah itu tombol **Minta sinkronisasi** aktif lagi.
