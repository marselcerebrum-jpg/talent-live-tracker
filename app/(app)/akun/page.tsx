import { getMe } from "@/lib/auth";
import { Notice } from "@/components/Notice";
import { gantiSandi } from "../actions";

export default async function AkunPage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const me = await getMe();
  const sp = await searchParams;
  return (
    <>
      <div className="page-head"><div><h1>Akun</h1><p>{me.email}</p></div></div>
      <Notice ok={sp.ok} e={sp.e} />
      <section className="panel" style={{ maxWidth: 460 }}>
        <h2 style={{ marginBottom: 14 }}>Ganti kata sandi</h2>
        <form action={gantiSandi} className="form">
          <div className="field"><label htmlFor="password">Kata sandi baru</label><input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div>
          <div className="field"><label htmlFor="password2">Ulangi kata sandi baru</label><input id="password2" name="password2" type="password" minLength={8} autoComplete="new-password" required /></div>
          <div className="row"><button className="btn" type="submit">Simpan kata sandi</button></div>
        </form>
      </section>
    </>
  );
}
