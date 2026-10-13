import Link from "next/link";
import { mintaResetSandi } from "./actions";

export default async function LupaSandi({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="login">
      <div className="login-card">
        <div className="brand"><span className="brand-name"><span className="brand-dot" aria-hidden />Talent Live</span></div>
        <h1>Lupa kata sandi</h1>
        {sp.ok ? (
          <>
            <div className="notice notice-ok" role="status" style={{ marginTop: 14 }}>
              Permintaan terkirim ke admin. Admin akan membuat kata sandi baru dan mengabarimu lewat WhatsApp.
            </div>
            <p className="small"><Link href="/login">Kembali ke halaman masuk</Link></p>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 20 }}>Isi username atau email akunmu. Admin akan menerima pemberitahuan dan mengatur kata sandi baru.</p>
            {sp.e === "kosong" && <div className="notice notice-bad" role="alert">Isi username atau email dulu.</div>}
            <form action={mintaResetSandi} className="form">
              <div className="field">
                <label htmlFor="login">Username atau email</label>
                <input id="login" name="login" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" required />
              </div>
              <button className="btn" type="submit">Minta reset ke admin</button>
            </form>
            <p className="small" style={{ marginTop: 18 }}><Link href="/login">Kembali ke halaman masuk</Link></p>
          </>
        )}
      </div>
    </main>
  );
}
