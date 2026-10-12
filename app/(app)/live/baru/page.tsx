import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/Notice";
import { LiveForm } from "@/components/LiveForm";

export default async function LiveBaru({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const me = await getMe();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: accounts }, { data: talents }] = await Promise.all([
    supabase.from("live_accounts").select("code, name").eq("is_active", true).order("name"),
    me.role === "admin"
      ? supabase.from("talents").select("id, nickname").eq("is_active", true).order("nickname")
      : Promise.resolve({ data: null }),
  ]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Isi data live</h1>
          <p>Isi setelah live selesai. Satu sesi per baris, kalau live terputus lalu lanjut, isi sebagai sesi baru.</p>
        </div>
      </div>
      <Notice e={sp.e} />
      <section className="panel">
        <LiveForm
          from={me.role === "admin" ? "/admin/live" : "/live"}
          accounts={(accounts ?? []).map((a) => ({ value: a.code, label: a.name }))}
          talents={talents ? talents.map((t) => ({ value: t.id, label: t.nickname })) : undefined}
        />
      </section>
    </>
  );
}
