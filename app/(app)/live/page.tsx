import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, hariIni, menitKeJam } from "@/lib/time";
import { Notice } from "@/components/Notice";
import { SessionTable, type SessionRow } from "@/components/SessionTable";

export default async function LivePage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const me = await getMe();
  if (me.role === "admin") redirect("/admin/live");
  const sp = await searchParams;
  const since = addDays(hariIni(), -30);
  const supabase = await createClient();
  const [{ data }, { data: accounts }] = await Promise.all([
    supabase.from("live_sessions")
      .select("id, session_date, started_at, duration_minutes, account_code, platform, total_views, unique_viewers, peak_concurrent, avg_watch_seconds, topic, review_status, talent_id")
      .eq("talent_id", me.talentId!).gte("session_date", since)
      .order("session_date", { ascending: false }).order("started_at", { ascending: false }),
    supabase.from("live_accounts").select("code, name"),
  ]);
  const rows = (data ?? []) as SessionRow[];
  const total = rows.reduce((a, r) => a + (r.duration_minutes ?? 0), 0);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Data live</h1>
          <p>30 hari terakhir: {rows.length} sesi, total {menitKeJam(total)}.</p>
        </div>
        <Link className="btn" href="/live/baru">Isi data live</Link>
      </div>
      <Notice ok={sp.ok} e={sp.e} />
      <section className="panel">
        <SessionTable rows={rows} accName={new Map((accounts ?? []).map((a) => [a.code, a.name]))} />
      </section>
    </>
  );
}
