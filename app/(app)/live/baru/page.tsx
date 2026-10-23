// Lokasi di GitHub: app/(app)/live/baru/page.tsx
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, hariIni, isYmd, jam, menitKeJam, tanggalPendek } from "@/lib/time";
import type { GuardData } from "@/components/LiveGuard";
import { Notice } from "@/components/Notice";
import { LiveForm } from "@/components/LiveForm";

export default async function LiveBaru({ searchParams }: {
  searchParams: Promise<{ e?: string; ok?: string; akun?: string; pf?: string; tgl?: string; t?: string; jam?: string }>;
}) {
  const me = await getMe();
  const sp = await searchParams;
  const isAdmin = me.role === "admin";
  const date = isYmd(sp.tgl) ? sp.tgl! : hariIni();
  const who = isAdmin ? sp.t : me.talentId ?? undefined;
  const supabase = await createClient();
  const [{ data: accounts }, { data: talents }, { data: existing }, { data: gSlots }, { data: gSess }, { data: gChk }] = await Promise.all([
    supabase.from("live_accounts").select("code, name").eq("is_active", true).order("name"),
    isAdmin ? supabase.from("talents").select("id, nickname").eq("is_active", true).order("nickname") : Promise.resolve({ data: null }),
    who
      ? supabase.from("live_sessions").select("id, account_code, platform, started_at, duration_minutes, total_views")
          .eq("talent_id", who).eq("session_date", date).order("started_at")
      : Promise.resolve({ data: [] as never[] }),
    who
      ? supabase.from("schedule_slots").select("account_code, slot_date, start_at, end_at").eq("talent_id", who).eq("status", "scheduled")
          .gte("slot_date", addDays(date, -7)).lte("slot_date", addDays(date, 1))
      : Promise.resolve({ data: [] as never[] }),
    who
      ? supabase.from("live_sessions").select("account_code, platform, session_date, started_at, duration_minutes").eq("talent_id", who)
          .gte("session_date", addDays(date, -7)).lte("session_date", addDays(date, 1))
      : Promise.resolve({ data: [] as never[] }),
    who
      ? supabase.from("attendance_checkins").select("checked_in_at, checked_out_at").eq("talent_id", who)
          .gte("checked_in_at", `${addDays(date, -7)}T00:00:00+07:00`)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const guard: GuardData | undefined = who ? {
    slots: ((gSlots ?? []) as { account_code: string; slot_date: string; start_at: string; end_at: string }[])
      .map((x) => ({ account: x.account_code, date: x.slot_date, start: x.start_at, end: x.end_at })),
    existing: ((gSess ?? []) as { account_code: string; platform: string; session_date: string; started_at: string | null; duration_minutes: number | null }[])
      .map((x) => ({ account: x.account_code, platform: x.platform, date: x.session_date, start: x.started_at, minutes: x.duration_minutes })),
    accountNames: Object.fromEntries((accounts ?? []).map((a) => [a.code, a.name])),
    checkins: ((gChk ?? []) as { checked_in_at: string; checked_out_at: string | null }[]).map((c) => ({
      date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(c.checked_in_at)),
      start: c.checked_in_at, end: c.checked_out_at,
    })),
  } : undefined;
  const accName = new Map((accounts ?? []).map((a) => [a.code, a.name]));
  const list = (existing ?? []) as { id: string; account_code: string; platform: string; started_at: string | null; duration_minutes: number | null; total_views: number | null }[];
  const totalMenit = list.reduce((a, x) => a + (x.duration_minutes ?? 0), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Isi data live</h1>
          <p>Isi setiap kali selesai live. Satu sesi boleh punya beberapa data live, isi satu per satu.</p>
        </div>
      </div>
      <Notice ok={sp.ok} e={sp.e} />

      {who && (
        <section className="panel flush" style={{ marginBottom: 20 }}>
          <div className="band sky">
            <h2>Sudah tercatat {date === hariIni() ? "hari ini" : tanggalPendek(date)}</h2>
            <span className="small">{list.length} data live, total {menitKeJam(totalMenit)}</span>
          </div>
          {list.length === 0 ? <p className="muted" style={{ padding: 20 }}>Belum ada data live di tanggal ini.</p> : (
            <div className="list">
              {list.map((x, i) => (
                <div key={x.id} className="li">
                  <span className="av c2" aria-hidden>{i + 1}</span>
                  <div>
                    <div className="t">{accName.get(x.account_code) ?? x.account_code}{x.platform === "instagram" ? " (IG)" : ""}</div>
                    <div className="s">mulai {jam(x.started_at)}, {x.duration_minutes ? menitKeJam(x.duration_minutes) : "durasi ?"}{x.total_views !== null ? `, ${new Intl.NumberFormat("id-ID").format(x.total_views)} tayangan` : ""}</div>
                  </div>
                  <span className="badge badge-hadir">Tersimpan</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <LiveForm
          from={isAdmin ? "/admin/live" : "/live"}
          accounts={(accounts ?? []).map((a) => ({ value: a.code, label: a.name }))}
          talents={talents ? talents.map((t) => ({ value: t.id, label: t.nickname })) : undefined}
          defaults={{ account: sp.akun, platform: sp.pf, date, talent: sp.t, time: /^\d{2}:\d{2}$/.test(sp.jam ?? "") ? sp.jam : undefined }}
          guard={guard}
        />
      </section>
    </>
  );
}
