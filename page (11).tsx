import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rupiah, tanggalPanjang, tanggalPendek, jam } from "@/lib/time";
import { attribute, dateRange, sumBy, type PromoCode, type PromoDaily } from "@/lib/promo";
import { fmtNum } from "@/lib/perf";
import { BarChart } from "@/components/Chart";
import { Notice } from "@/components/Notice";
import { aturFitur, aturKode, batalSinkron, mintaSinkron, simpanKode } from "../actions";
import { addDays, hariIni } from "@/lib/time";
import { featureOn } from "@/lib/features";

export default async function AdminPromo({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; ok?: string; e?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  if (!(await featureOn("feature_promo"))) {
    return (
      <>
        <div className="page-head"><div><h1>Kode promo</h1><p>Fitur ini sedang dikunci.</p></div></div>
        <Notice ok={sp.ok} e={sp.e} />
        <section className="panel" style={{ maxWidth: 620 }}>
          <h2 style={{ marginBottom: 8 }}>Menunggu data dari Centil</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Laporan kode promo disembunyikan dari menu admin dan halaman Performa talent sampai template Centil #110 disetujui
            dan data penjualan mulai masuk. Data kode promo per talent tetap tersimpan.
          </p>
          <form action={aturFitur}>
            <input type="hidden" name="key" value="feature_promo" /><input type="hidden" name="on" value="1" />
            <button className="btn btn-ghost" type="submit">Buka kunci fitur</button>
          </form>
        </section>
      </>
    );
  }
  const r = dateRange(sp.from, sp.to);
  const supabase = await createClient();
  const [{ data: codes }, { data: daily }, { data: talents }, { data: accounts }, { data: lastSync }] = await Promise.all([
    supabase.from("promo_codes").select("code, talent_id, account_code, centil_source_id, valid_from, valid_to, is_active").order("code"),
    supabase.from("promo_sales_daily").select("centil_source_id, code, sale_date, trx_success, buyers_unique, revenue_idr").gte("sale_date", r.start).lte("sale_date", r.end),
    supabase.from("talents").select("id, nickname, is_active").order("nickname"),
    supabase.from("live_accounts").select("code, name").order("name"),
    supabase.from("sync_runs").select("finished_at, status, rows, error").eq("kind", "centil_promo").order("started_at", { ascending: false }).limit(1),
  ]);
  const { data: requests } = await supabase.from("sync_requests")
    .select("id, range_start, range_end, status, requested_at, finished_at, rows, note").order("requested_at", { ascending: false }).limit(5);
  const active = (requests ?? []).find((q) => q.status === "pending" || q.status === "processing");
  const nick = new Map((talents ?? []).map((t) => [t.id, t.nickname]));
  const acc = new Map((accounts ?? []).map((a) => [a.code, a.name]));
  const rows = attribute((daily ?? []) as PromoDaily[], (codes ?? []) as PromoCode[]);
  const perTalent = sumBy(rows, (x) => x.talent_id);
  const perCode = sumBy(rows, (x) => x.code);
  const total = rows.reduce((a, x) => ({ trx: a.trx + x.trx_success, rev: a.rev + x.revenue }), { trx: 0, rev: 0 });
  const days: { label: string; value: number }[] = [];
  for (let d = new Date(`${r.start}T12:00:00Z`); d.toISOString().slice(0, 10) <= r.end; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    days.push({ label: k.slice(8), value: rows.filter((x) => x.sale_date === k).reduce((a, x) => a + x.revenue, 0) });
  }
  const sync = lastSync?.[0];
  const noData = (daily ?? []).length === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kode promo</h1>
          <p>{tanggalPanjang(r.start)} sampai {tanggalPanjang(r.end)}. Data dari Centil, transaksi sukses saja.</p>
        </div>
      </div>
      <Notice ok={sp.ok} e={sp.e} />

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2>Sinkronisasi dari Centil</h2>
          <span className="small muted">
            {sync ? `Data terakhir masuk: ${tanggalPendek(sync.finished_at)} ${jam(sync.finished_at)}` : "Belum pernah sinkronisasi"}
          </span>
        </div>
        {active ? (
          <div className="row">
            <span className="badge badge-pending">{active.status === "processing" ? "Sedang diproses" : "Menunggu Claude"}</span>
            <span className="small">{tanggalPendek(active.range_start)} s.d. {tanggalPendek(active.range_end)}, diminta {jam(active.requested_at)}</span>
            {active.status === "pending" && (
              <form action={batalSinkron}><input type="hidden" name="id" value={active.id} /><button className="btn btn-ghost btn-sm" type="submit">Batalkan</button></form>
            )}
          </div>
        ) : (
          <form action={mintaSinkron} className="row">
            <input type="hidden" name="from" value={r.start} /><input type="hidden" name="to" value={r.end} />
            <label className="row small" style={{ gap: 6 }}>Dari <input type="date" name="sync_from" defaultValue={addDays(hariIni(), -6)} style={{ width: "auto" }} /></label>
            <label className="row small" style={{ gap: 6 }}>Sampai <input type="date" name="sync_to" defaultValue={hariIni()} max={hariIni()} style={{ width: "auto" }} /></label>
            <button className="btn" type="submit">Minta sinkronisasi</button>
          </form>
        )}
        <p className="metric-note">
          Aplikasi tidak mengakses Centil langsung. Setelah menekan tombol, ketik di chat Claude (project Live Hub): "proses sync kode promo Live Hub". Setelah Claude selesai, muat ulang halaman ini.
        </p>
        {(requests ?? []).length > 0 && (
          <div className="table-wrap" style={{ marginTop: 10 }}><table>
            <thead><tr><th>Diminta</th><th>Rentang</th><th>Status</th><th className="num">Baris</th><th>Catatan</th></tr></thead>
            <tbody>{(requests ?? []).map((q) => (
              <tr key={q.id}>
                <td className="nw small">{tanggalPendek(q.requested_at)} {jam(q.requested_at)}</td>
                <td className="nw small">{q.range_start} s.d. {q.range_end}</td>
                <td><span className={`badge ${q.status === "done" ? "badge-approved" : q.status === "failed" ? "badge-rejected" : "badge-pending"}`}>
                  {({ pending: "Menunggu", processing: "Diproses", done: "Selesai", failed: "Gagal" } as Record<string, string>)[q.status]}</span></td>
                <td className="num">{q.rows ?? "–"}</td><td className="small">{q.note ?? ""}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <form className="row" action="/admin/promo" style={{ marginBottom: 16 }}>
        <label className="row small" style={{ gap: 6 }}>Dari <input type="date" name="from" defaultValue={r.start} style={{ width: "auto" }} /></label>
        <label className="row small" style={{ gap: 6 }}>Sampai <input type="date" name="to" defaultValue={r.end} style={{ width: "auto" }} /></label>
        <button className="btn btn-ghost btn-sm" type="submit">Terapkan</button>
        <span className="spacer" />
        <button className="btn btn-ghost btn-sm" type="submit" formAction={aturFitur} name="on" value="0">Kunci fitur</button>
        <input type="hidden" name="key" value="feature_promo" />
      </form>

      {noData ? (
        <div className="panel empty">
          <strong>Belum ada data penjualan kode promo untuk periode ini</strong>
          Data masuk otomatis setelah template Centil #110 disetujui dan sinkronisasi berjalan.
        </div>
      ) : (
        <>
          <section className="panel">
            <div className="stats">
              <div className="stat"><strong>{fmtNum(total.trx)}</strong><span>Transaksi pakai kode talent</span></div>
              <div className="stat"><strong>{rupiah(total.rev)}</strong><span>Revenue dari kode talent</span></div>
              <div className="stat"><strong>{perTalent.length}</strong><span>Talent dengan penjualan</span></div>
            </div>
            <p className="metric-note">Satu transaksi bisa memakai lebih dari satu kode. Angka per kode dan per talent dihitung terpisah, jadi totalnya bisa sedikit lebih besar dari revenue sebenarnya.</p>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Revenue kode talent per hari</h2><span className="small muted">Batang gelap = hari tertinggi</span></div>
            <BarChart title="Revenue kode promo talent per hari" unit=" rupiah" data={days} />
          </section>
          <section className="panel">
            <h2 style={{ marginBottom: 14 }}>Per talent</h2>
            <div className="table-wrap"><table>
              <thead><tr><th>Talent</th><th>Kode terpakai</th><th className="num">Transaksi</th><th className="num">Pembeli</th><th className="num key">Revenue</th></tr></thead>
              <tbody>{perTalent.map((a) => (
                <tr key={a.key}><td><strong>{nick.get(a.key)}</strong></td><td className="small">{[...a.codes].join(", ")}</td>
                  <td className="num">{fmtNum(a.trx)}</td><td className="num">{fmtNum(a.buyers)}</td><td className="num key">{rupiah(a.revenue)}</td></tr>
              ))}</tbody>
            </table></div>
          </section>
          <section className="panel">
            <h2 style={{ marginBottom: 14 }}>Per kode</h2>
            <div className="table-wrap"><table>
              <thead><tr><th>Kode</th><th>Talent</th><th className="num">Transaksi</th><th className="num">Revenue</th></tr></thead>
              <tbody>{perCode.map((a) => {
                const c = (codes ?? []).find((x) => x.code === a.key);
                return <tr key={a.key}><td><strong>{a.key}</strong></td><td>{c ? nick.get(c.talent_id) : "–"}</td><td className="num">{fmtNum(a.trx)}</td><td className="num">{rupiah(a.revenue)}</td></tr>;
              })}</tbody>
            </table></div>
          </section>
        </>
      )}

      <div className="grid-2" style={{ marginTop: 16, alignItems: "start" }}>
        <section className="panel">
          <h2 style={{ marginBottom: 14 }}>Daftar kode ({(codes ?? []).length})</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Kode</th><th>Talent</th><th>Akun</th><th>Berlaku</th><th /></tr></thead>
            <tbody>{(codes ?? []).map((c) => (
              <tr key={c.code} style={c.is_active ? undefined : { opacity: 0.55 }}>
                <td><strong>{c.code}</strong></td><td>{nick.get(c.talent_id)}</td><td className="small">{acc.get(c.account_code)}</td>
                <td className="small nw">{c.valid_from || c.valid_to ? `${c.valid_from ?? "awal"} s.d. ${c.valid_to ?? "sekarang"}` : "Selalu"}</td>
                <td className="num"><form action={aturKode}><input type="hidden" name="code" value={c.code} /><input type="hidden" name="active" value={c.is_active ? "0" : "1"} />
                  <button className="btn btn-ghost btn-sm" type="submit">{c.is_active ? "Nonaktifkan" : "Aktifkan"}</button></form></td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>Tambah atau ubah kode</h2>
          <p className="small muted" style={{ marginBottom: 14 }}>Kode yang sudah ada akan diperbarui. Isi tanggal berlaku kalau kode pindah ke talent lain, supaya penjualan lama tetap tercatat ke pemilik lama.</p>
          <form action={simpanKode} className="form">
            <div className="form-grid">
              <div className="field"><label htmlFor="code">Kode</label><input id="code" name="code" required placeholder="KEBUTCPNS" style={{ textTransform: "uppercase" }} /></div>
              <div className="field"><label htmlFor="talent_id">Talent</label>
                <select id="talent_id" name="talent_id" required defaultValue=""><option value="" disabled>Pilih talent</option>
                  {(talents ?? []).filter((t) => t.is_active).map((t) => <option key={t.id} value={t.id}>{t.nickname}</option>)}</select></div>
              <div className="field"><label htmlFor="account_code">Aplikasi</label>
                <select id="account_code" name="account_code" required defaultValue=""><option value="" disabled>Pilih aplikasi</option>
                  {(accounts ?? []).map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}</select></div>
              <div className="field"><label htmlFor="valid_from">Berlaku dari</label><input id="valid_from" name="valid_from" type="date" /></div>
              <div className="field"><label htmlFor="valid_to">Berlaku sampai</label><input id="valid_to" name="valid_to" type="date" /></div>
            </div>
            <div className="row"><button className="btn" type="submit">Simpan kode</button></div>
          </form>
        </section>
      </div>
    </>
  );
}
