import Link from "next/link";
import { simpanSandiBaru } from "./actions";

const PESAN: Record<string, string> = {
  pendek: "Kata sandi minimal 8 karakter.",
  beda: "Kedua kata sandi tidak sama.",
  gagal: "Gagal menyimpan. Coba lagi atau minta link baru.",
};

export default async function ResetSandi({ searchParams }: { searchParams: Promise<{ token_hash?: string; e?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="login">
      <div className="login-card">
        <div className="brand"><span className="brand-name"><span className="brand-dot" aria-hidden />Talent Live</span></div>
        <h1>Buat kata sandi baru</h1>
        {!sp.token_hash ? (
          <p className="muted" style={{ marginTop: 10 }}>Link tidak lengkap. <Link href="/lupa-sandi">Minta link reset baru</Link>.</p>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 20 }}>Setelah disimpan, kamu langsung masuk dengan kata sandi baru.</p>
            {sp.e && PESAN[sp.e] && <div className="notice notice-bad" role="alert">{PESAN[sp.e]}</div>}
            <form action={simpanSandiBaru} className="form">
              <input type="hidden" name="token_hash" value={sp.token_hash} />
              <div className="field"><label htmlFor="password">Kata sandi baru</label><input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div>
              <div className="field"><label htmlFor="password2">Ulangi kata sandi baru</label><input id="password2" name="password2" type="password" minLength={8} autoComplete="new-password" required /></div>
              <button className="btn" type="submit">Simpan kata sandi</button>
            </form>
          </>
        )}
        <p className="small" style={{ marginTop: 18 }}><Link href="/login">Kembali ke halaman masuk</Link></p>
      </div>
    </main>
  );
}
