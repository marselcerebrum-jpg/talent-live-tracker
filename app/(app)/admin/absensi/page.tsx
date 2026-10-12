import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AttendanceTable, monthRange, type AttRow } from "@/components/AttendanceTable";
import { Notice } from "@/components/Notice";
import { koreksiAbsensi } from "../actions";

export default async function AdminAbsensi({ searchParams }: { searchParams: Promise<{ m?: string; t?: string; s?: string; ok?: string; e?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const r = monthRange(sp.m);
  const supabase = await createClient();
  let q = supabase.from("v_attendance").select("*").gte("slot_date", r.start).lte("slot_date", r.end).order("start_at", { ascending: false });
  if (sp.t) q = q.eq("talent_id", sp.t);
  if (sp.s) q = q.eq("state", sp.s);
  const [{ data }, { data: talents }, { data: accounts }] = await Promise.all([
    q, supabase.from("talents").select("id, nickname").order("nickname"), supabase.from("live_accounts").select("code, name"),
  ]);
  const rows = (data ?? []) as AttRow[];
  const qs = new URLSearchParams(Object.entries({ m: r.month, t: sp.t, s: sp.s }).filter(([, v]) => v) as [string, string][]).toString();
  const ret = `/admin/absensi?${qs}`;
  const count = (st: string) => rows.filter((x) => x.state === st).length;

  return (
    <>
      <div className="page-head">
        <div><h1>Absensi tim</h1><p>{r.label}. Hadir {count("hadir")}, izin {count("izin")}, tidak hadir {count("alpha")}.</p></div>
        <div className="row">
          <Link className="btn btn-ghost btn-sm" href={`/admin/absensi?m=${r.prev}`}>Bulan sebelumnya</Link>
          <Link className="btn btn-ghost btn-sm" href={`/admin/absensi?m=${r.next}`}>Bulan berikutnya</Link>
        </div>
      </div>
      <Notice ok={sp.ok} e={sp.e} />
      <form className="row" action="/admin/absensi" style={{ marginBottom: 16 }}>
        <input type="hidden" name="m" value={r.month} />
        <select name="t" defaultValue={sp.t ?? ""} aria-label="Talent" style={{ width: "auto" }}>
          <option value="">Semua talent</option>
          {(talents ?? []).map((t) => <option key={t.id} value={t.id}>{t.nickname}</option>)}
        </select>
        <select name="s" defaultValue={sp.s ?? ""} aria-label="Status" style={{ width: "auto" }}>
          <option value="">Semua status</option>
          <option value="hadir">Hadir</option><option value="izin">Izin</option><option value="alpha">Tidak hadir</option><option value="terjadwal">Terjadwal</option>
        </select>
        <button className="btn btn-ghost btn-sm" type="submit">Terapkan</button>
      </form>
      <section className="panel">
        <AttendanceTable
          rows={rows}
          accName={new Map((accounts ?? []).map((a) => [a.code, a.name]))}
          nick={new Map((talents ?? []).map((t) => [t.id, t.nickname]))}
          action={(row) => (
            <details>
              <summary className="small" style={{ cursor: "pointer" }}>Koreksi</summary>
              <form action={koreksiAbsensi} className="form" style={{ marginTop: 8, minWidth: 220 }}>
                <input type="hidden" name="slot_id" value={row.slot_id} />
                <input type="hidden" name="ret" value={ret} />
                <select name="state" defaultValue={row.override_note ? row.state : "hadir"} aria-label="Status baru">
                  <option value="hadir">Hadir</option><option value="izin">Izin</option><option value="alpha">Tidak hadir</option>
                  <option value="otomatis">Kembalikan ke otomatis</option>
                </select>
                <input name="note" placeholder="Alasan koreksi" aria-label="Alasan koreksi" />
                <button className="btn btn-sm" type="submit">Simpan koreksi</button>
              </form>
            </details>
          )}
        />
      </section>
    </>
  );
}
