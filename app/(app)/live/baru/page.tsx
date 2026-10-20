import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hariIni, isYmd, jam, menitKeJam, tanggalPendek } from "@/lib/time";
import { Notice } from "@/components/Notice";
import { LiveForm } from "@/components/LiveForm";

export default async function LiveBaru({ searchParams }: {
  searchParams: Promise<{ e?: string; ok?: string; akun?: string; pf?: string; tgl?: string; t?: string }>;
}) {
  const me = await getMe();
  const sp = await searchParams;
  const isAdmin = me.role === "admin";
  const date = isYmd(sp.tgl) ? sp.tgl! : hariIni();
  const who = isAdmin ? sp.t : me.talentId ?? undefined;
  const supabase = await createClient();
  const [{ data: accounts }, { data: talents }, { data: existing }] = await Promise.all([
    supabase.from("live_accounts").select("code, name").eq("is_active", true).order("name"),
    isAdmin ? supabase.from("talents").select("id, nickname").eq("is_active", true).order("nickname") : Promise.resolve({ data: null }),
    who
      ? supabase.from("live_sessions").select("id, account_code, platform, started_at, duration_minutes, total_views")
          .eq("talent_id", who).eq("session_date", date).order("started_at")
      : Promise.resolve({ data: [] as never[] }),
  ]);
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
          defaults={{ account: sp.akun, platform: sp.pf, date, talent: sp.t }}
        />
      </section>
    </>
  );
}
