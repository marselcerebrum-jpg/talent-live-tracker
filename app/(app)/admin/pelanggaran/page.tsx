// Lokasi di GitHub: app/(app)/admin/pelanggaran/page.tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tanggalPendek } from "@/lib/time";
import { payrollStartDay, resolvePeriod } from "@/lib/period";
import { PeriodPicker } from "@/components/PeriodPicker";
import { Avatar } from "@/components/Avatar";

type Pay = { talent_id: string; slot_date: string; sesi: number; sesi_label: string; accounts: string[]; pelanggaran: string[] };

const JENIS: { key: string; label: string; match: (p: string) => boolean }[] = [
  { key: "absen", label: "Jam live tidak sesuai jam absen", match: (p) => p.startsWith("jam live tidak sesuai jam absen") },
  { key: "jadwal", label: "Tidak sesuai jadwal / tanpa izin", match: (p) => p.startsWith("tidak sesuai jadwal") },
  { key: "isi", label: "Tidak mengisi data live", match: (p) => p.startsWith("tidak mengisi data live") },
  { key: "statistik", label: "Statistik TikTok tidak diisi", match: (p) => p.startsWith("statistik TikTok") },
  { key: "pendek", label: "Live kurang dari 2 jam", match: (p) => p.startsWith("live kurang dari") },
];
const jenisOf = (p: string) => JENIS.find((j) => j.match(p)) ?? { key: "lain", label: "Lainnya", match: () => true };

export default async function Pelanggaran({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; p?: string; t?: string; j?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [period, day] = await Promise.all([resolvePeriod(sp), payrollStartDay()]);
  const supabase = await createClient();
  const [{ data }, { data: talents }, { data: accounts }, { data: changes }] = await Promise.all([
    supabase.from("v_slot_pay").select("talent_id, slot_date, sesi, sesi_label, accounts, pelanggaran")
      .gte("slot_date", period.start).lte("slot_date", period.end).order("slot_date", { ascending: false }),
    supabase.from("talents").select("id, nickname").order("nickname"),
    supabase.from("live_accounts").select("code, name"),
    supabase.from("schedule_changes").select("kind, note, reported_by, original_talent_id, original_start_at, unauthorized")
      .eq("kind", "tidak_sesuai").gte("original_start_at", `${period.start}T00:00:00+07:00`).lte("original_start_at", `${period.end}T23:59:59+07:00`),
  ]);
  const nick = new Map((talents ?? []).map((t) => [t.id, t.nickname]));
  const acc = new Map((accounts ?? []).map((a) => [a.code, a.name]));
  const noteOf = (talent: string, date: string) =>
    (changes ?? []).find((c) => c.original_talent_id === talent &&
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(c.original_start_at)) === date)?.note ?? null;

  // satu baris per pelanggaran
  const all = ((data ?? []) as Pay[]).flatMap((r) => r.pelanggaran.map((p) => ({ ...r, detail: p, jenis: jenisOf(p) })));
  const rows = all.filter((x) => (!sp.t || x.talent_id === sp.t) && (!sp.j || x.jenis.key === sp.j));

  const perTalent = new Map<string, Record<string, number>>();
  all.forEach((x) => {
    const m = perTalent.get(x.talent_id) ?? {};
    m[x.jenis.key] = (m[x.jenis.key] ?? 0) + 1;
    perTalent.set(x.talent_id, m);
  });
  const rekap = [...perTalent.entries()].map(([id, m]) => ({ id, m, total: Object.values(m).reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total);
  const qs = (o: Record<string, string | undefined>) =>
    "/admin/pelanggaran?" + new URLSearchParams(Object.entries({ from: sp.from, to: sp.to, p: sp.p, t: sp.t, j: sp.j, ...o }).filter(([, v]) => v) as [string, string][]);

  return (
    <>
      <div className="page-head">
        <div><h1>Pelanggaran</h1><p>{period.label}. Sesi dengan pelanggaran tetap dibayar; daftar ini untuk evaluasi.</p></div>
        <span className="sticker">{all.length} pelanggaran</span>
      </div>
      <PeriodPicker base="/admin/pelanggaran" period={period} startDay={day} />

      <section className="panel flush" style={{ marginBottom: 20 }}>
        <div className="band pink"><h2>Rekap per talent</h2><span className="small">klik angka untuk menyaring daftar</span></div>
        {rekap.length === 0 ? <p className="muted" style={{ padding: 20 }}>Tidak ada pelanggaran di rentang ini.</p> : (
          <div className="table-wrap" style={{ margin: 0, padding: "0 20px" }}><table>
            <thead><tr><th>Talent</th>{JENIS.map((j) => <th key={j.key} className="num">{j.label}</th>)}<th className="num key">Total</th></tr></thead>
            <tbody>{rekap.map((r) => (
              <tr key={r.id}>
                <td><Link href={qs({ t: r.id, j: "" })}><strong>{nick.get(r.id) ?? "?"}</strong></Link></td>
                {JENIS.map((j) => <td key={j.key} className="num">{r.m[j.key] ? <Link href={qs({ t: r.id, j: j.key })}>{r.m[j.key]}</Link> : <span className="muted">0</span>}</td>)}
                <td className="num key">{r.total}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <form className="row" action="/admin/pelanggaran" style={{ marginBottom: 16 }}>
        {sp.from && <input type="hidden" name="from" value={sp.from} />}{sp.to && <input type="hidden" name="to" value={sp.to} />}{sp.p && <input type="hidden" name="p" value={sp.p} />}
        <select name="t" defaultValue={sp.t ?? ""} aria-label="Talent" style={{ width: "auto" }}>
          <option value="">Semua talent</option>
          {(talents ?? []).map((t) => <option key={t.id} value={t.id}>{t.nickname}</option>)}
        </select>
        <select name="j" defaultValue={sp.j ?? ""} aria-label="Jenis pelanggaran" style={{ width: "auto" }}>
          <option value="">Semua jenis</option>
          {JENIS.map((j) => <option key={j.key} value={j.key}>{j.label}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" type="submit">Terapkan</button>
        {(sp.t || sp.j) && <Link className="btn btn-ghost btn-sm" href={qs({ t: "", j: "" })}>Hapus filter</Link>}
      </form>

      <section className="panel flush">
        <div className="band"><h2>Daftar pelanggaran</h2><span className="small">{rows.length} baris</span></div>
        {rows.length === 0 ? <div className="empty"><strong>Tidak ada pelanggaran</strong>Coba ubah rentang atau filter.</div> : (
          <div className="list">
            {rows.map((x, i) => {
              const note = x.jenis.key === "jadwal" ? noteOf(x.talent_id, x.slot_date) : null;
              return (
                <div key={i} className="li">
                  <Avatar name={nick.get(x.talent_id) ?? "?"} />
                  <div>
                    <div className="t">{nick.get(x.talent_id) ?? "?"} <span className="s">{tanggalPendek(x.slot_date)}, sesi {x.sesi} ({x.sesi_label}), {x.accounts.map((a) => acc.get(a) ?? a).join(", ")}</span></div>
                    <div className="s">{x.detail}</div>
                    {note && <div className="s">Catatan: {note}</div>}
                  </div>
                  <span className="badge badge-alpha">{x.jenis.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <p className="metric-note">Sumber: perhitungan gaji per sesi. Pelanggaran tidak memotong gaji. Untuk memeriksa kebenarannya, pakai Cek tayangan ulang.</p>
    </>
  );
}
