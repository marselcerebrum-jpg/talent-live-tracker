import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { jam } from "@/lib/time";
import { AttendanceTable, monthRange, type AttRow } from "@/components/AttendanceTable";
import { Notice } from "@/components/Notice";
import { hapusPerubahan, koreksiAbsensi } from "../actions";
import { ChangeReport, type ChangeRow } from "@/components/ChangeReport";



function SlotActions({ row, ret }: { row: AttRow; ret: string }) {
  return (
    <div className="act">
      {row.change_kind && (
        <form action={hapusPerubahan}>
          <input type="hidden" name="slot_id" value={row.slot_id} /><input type="hidden" name="ret" value={ret} />
          <button className="btn btn-ghost btn-sm" type="submit">Batalkan perubahan ini</button>
        </form>
      )}
      <details>
        <summary className="small">Koreksi status</summary>
        <form action={koreksiAbsensi} className="row" style={{ marginTop: 8 }}>
          <input type="hidden" name="slot_id" value={row.slot_id} /><input type="hidden" name="ret" value={ret} />
          <select name="state" defaultValue={row.override_note ? row.state : "hadir"} aria-label="Status baru" style={{ width: "auto" }}>
            <option value="hadir">Hadir</option><option value="izin">Izin</option><option value="alpha">Tidak hadir</option>
            <option value="otomatis">Kembalikan ke otomatis</option>
          </select>
          <input name="note" placeholder="Alasan koreksi" aria-label="Alasan koreksi" style={{ flex: 1, minWidth: 160 }} />
          <button className="btn btn-sm" type="submit">Simpan</button>
        </form>
      </details>
    </div>
  );
}

export default async function AdminAbsensi({ searchParams }: { searchParams: Promise<{ m?: string; t?: string; s?: string; k?: string; ok?: string; e?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const r = monthRange(sp.m);
  const supabase = await createClient();
  let q = supabase.from("v_attendance").select("*").gte("slot_date", r.start).lte("slot_date", r.end).order("start_at", { ascending: false });
  if (sp.t) q = q.eq("talent_id", sp.t);
  if (sp.s) q = q.eq("state", sp.s);
  const [{ data }, { data: talents }, { data: accounts }, { data: changes }] = await Promise.all([
    q, supabase.from("talents").select("id, nickname, is_active").order("nickname"), supabase.from("live_accounts").select("code, name"),
    supabase.from("schedule_changes").select("*, slot:schedule_slots(account_code, talent_id)")
      .gte("original_start_at", `${r.start}T00:00:00+07:00`).lte("original_start_at", `${r.end}T23:59:59+07:00`).order("created_at", { ascending: false }),
  ]);
  let rows = (data ?? []) as AttRow[];
  const nick = new Map((talents ?? []).map((t) => [t.id, t.nickname]));
  const qs = new URLSearchParams(Object.entries({ m: r.month, t: sp.t, s: sp.s, k: sp.k }).filter(([, v]) => v) as [string, string][]).toString();
  const ret = `/admin/absensi?${qs}`;
  const count = (st: string) => rows.filter((x) => x.state === st).length;

  // rekap kesesuaian jadwal per talent (bulan ini, sebelum filter jenis)
  type Rek = { tidak: number; tukar: number; pindah: number; tanpaIzin: number; auto: number };
  const rek = new Map<string, Rek>();
  rows.forEach((x) => {
    const key = x.change_kind === "tukar_shift" ? x.change_original_talent_id ?? x.talent_id : x.talent_id;
    const v = rek.get(key) ?? { tidak: 0, tukar: 0, pindah: 0, tanpaIzin: 0, auto: 0 };
    if (x.change_kind === "tidak_sesuai") v.tidak++;
    if (x.change_kind === "tukar_shift") v.tukar++;
    if (x.change_kind === "pindah_jadwal") v.pindah++;
    if (x.change_unauthorized) v.tanpaIzin++;
    if (!x.change_kind && (x.flag_live_di_jam_lain || x.flag_diisi_talent_lain)) v.auto++;
    rek.set(key, v);
  });
  const rekRows = [...rek.entries()].filter(([, v]) => v.tidak + v.tukar + v.pindah + v.auto > 0)
    .sort((a, b) => (b[1].tanpaIzin + b[1].auto) - (a[1].tanpaIzin + a[1].auto));

  if (sp.k === "perubahan") rows = rows.filter((x) => x.change_kind || x.flag_live_di_jam_lain || x.flag_diisi_talent_lain);

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

      <section className="panel flush" style={{ marginBottom: 20 }}>
        <div className="band pink"><h2>Kesesuaian jadwal</h2><Link href={`/admin/absensi?${new URLSearchParams({ m: r.month, k: "perubahan" })}`}>Lihat slotnya</Link></div>
        {rekRows.length === 0 ? <p className="muted" style={{ padding: 20 }}>Semua talent sesuai jadwal di {r.label}.</p> : (
          <div className="table-wrap" style={{ margin: 0, padding: "0 20px" }}><table>
            <thead><tr><th>Talent</th><th className="num">Tidak sesuai</th><th className="num">Tukar shift</th><th className="num">Pindah jadwal</th><th className="num key">Tanpa izin</th><th className="num">Terdeteksi, tidak dilaporkan</th></tr></thead>
            <tbody>{rekRows.map(([id, v]) => (
              <tr key={id}><td><strong>{nick.get(id) ?? "?"}</strong></td><td className="num">{v.tidak}</td><td className="num">{v.tukar}</td><td className="num">{v.pindah}</td><td className="num key">{v.tanpaIzin}</td><td className="num">{v.auto}</td></tr>
            ))}</tbody>
          </table></div>
        )}
        <p className="metric-note" style={{ padding: "0 20px 16px" }}>
          Talent melaporkan sendiri saat absen di luar jadwal. "Tidak sesuai jadwal" selalu dihitung tanpa izin. Kolom terakhir adalah slot yang terdeteksi otomatis (live di jam lain atau diisi talent lain) tapi tidak dilaporkan.
        </p>
      </section>

      <section className="panel flush" style={{ marginBottom: 20 }}>
        <div className="band sky"><h2>Laporan perubahan jadwal</h2><span className="small">{(changes ?? []).length} laporan {r.label}</span></div>
        <ChangeReport rows={(changes ?? []) as ChangeRow[]} nick={nick} accName={new Map((accounts ?? []).map((a) => [a.code, a.name]))} empty={`Belum ada laporan perubahan jadwal di ${r.label}.`} />
      </section>

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
        <select name="k" defaultValue={sp.k ?? ""} aria-label="Kesesuaian" style={{ width: "auto" }}>
          <option value="">Semua slot</option>
          <option value="perubahan">Hanya yang tidak sesuai / berubah</option>
        </select>
        <button className="btn btn-ghost btn-sm" type="submit">Terapkan</button>
      </form>

      <section className="panel flush">
        <AttendanceTable
          rows={rows}
          accName={new Map((accounts ?? []).map((a) => [a.code, a.name]))}
          nick={nick}
          action={(row) => <SlotActions row={row} ret={ret} />}
        />
      </section>
      <p className="metric-note">Tukar shift dan pindah jadwal yang dilaporkan talent langsung mengubah slot, sehingga absensi dan gaji ikut ke slot baru. "Batalkan perubahan ini" mengembalikan slot ke jadwal semula.</p>
    </>
  );
}
