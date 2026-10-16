import Link from "next/link";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, hariIni, isYmd, jam, senin, tanggalPanjang } from "@/lib/time";

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export default async function JadwalPage({ searchParams }: { searchParams: Promise<{ w?: string; akun?: string; saya?: string }> }) {
  const me = await getMe();
  const sp = await searchParams;
  const today = hariIni();
  const start = senin(isYmd(sp.w) ? sp.w : today);
  const end = addDays(start, 6);
  const onlyMine = sp.saya === "1" && !!me.talentId;
  const supabase = await createClient();

  let q = supabase.from("schedule_slots")
    .select("id, account_code, talent_id, start_at, end_at, slot_date, is_event, note")
    .eq("status", "scheduled").gte("slot_date", start).lte("slot_date", end).order("start_at");
  if (sp.akun) q = q.eq("account_code", sp.akun);
  if (onlyMine) q = q.eq("talent_id", me.talentId!);

  const [{ data: slots }, { data: talents }, { data: accounts }] = await Promise.all([
    q,
    supabase.from("v_talent_directory").select("id, nickname"),
    supabase.from("live_accounts").select("code, name, rooms(name)").eq("is_active", true).order("name"),
  ]);
  const nick = new Map((talents ?? []).map((t) => [t.id, t.nickname]));
  const accName = new Map((accounts ?? []).map((a) => [a.code, a.name]));
  const roomName = new Map((accounts ?? []).map((a) => {
    const r = (a as { rooms?: { name: string } | { name: string }[] | null }).rooms;
    return [a.code, (Array.isArray(r) ? r[0]?.name : r?.name) ?? null] as const;
  }));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const link = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    const merged = { w: start, akun: sp.akun, saya: sp.saya, ...p };
    Object.entries(merged).forEach(([k, v]) => v && s.set(k, v));
    return `/jadwal?${s}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Jadwal live</h1>
          <p>{tanggalPanjang(start)} sampai {tanggalPanjang(end)}</p>
        </div>
        <div className="row">
          <Link className="btn btn-ghost btn-sm" href={link({ w: addDays(start, -7) })}>Minggu lalu</Link>
          <Link className="btn btn-ghost btn-sm" href={link({ w: today })}>Minggu ini</Link>
          <Link className="btn btn-ghost btn-sm" href={link({ w: addDays(start, 7) })}>Minggu depan</Link>
        </div>
      </div>

      <form className="row" style={{ marginBottom: 16 }} action="/jadwal">
        <input type="hidden" name="w" value={start} />
        <select name="akun" defaultValue={sp.akun ?? ""} aria-label="Filter akun" style={{ width: "auto" }}>
          <option value="">Semua akun</option>
          {(accounts ?? []).map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
        </select>
        {me.talentId && (
          <label className="row small" style={{ gap: 6 }}>
            <input type="checkbox" name="saya" value="1" defaultChecked={onlyMine} style={{ width: "auto" }} /> Hanya jadwal saya
          </label>
        )}
        <button className="btn btn-ghost btn-sm" type="submit">Terapkan</button>
      </form>

      <div className="week">
        {days.map((d, i) => {
          const list = (slots ?? []).filter((s) => s.slot_date === d);
          return (
            <section key={d} className={`day${d === today ? " is-today" : ""}`} aria-label={`${HARI[i]} ${d}`}>
              <div className="day-head">{HARI[i]}<span>{tanggalPanjang(d)}</span></div>
              <div className="day-body">
                {list.length === 0 && <span className="muted small" style={{ padding: 4 }}>Kosong</span>}
                {list.map((s) => (
                  <div key={s.id} className={`chip${s.talent_id === me.talentId ? " mine" : ""}${s.is_event ? " event" : ""}`}>
                    <strong>{jam(s.start_at)}–{jam(s.end_at)}</strong>
                    {accName.get(s.account_code) ?? s.account_code}
                    <div>{nick.get(s.talent_id) ?? "?"}{s.is_event ? ", event" : ""}</div>
                    {roomName.get(s.account_code) && <div style={{ opacity: 0.8 }}>{roomName.get(s.account_code)}</div>}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
