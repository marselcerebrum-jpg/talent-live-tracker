import { login } from "./actions";

const PESAN: Record<string, string> = {
  kosong: "Isi email dan kata sandi.",
  gagal: "Email atau kata sandi salah. Kalau lupa, minta admin mengatur ulang kata sandi.",
  "tanpa-profil": "Akun ini belum ditautkan ke data talent. Hubungi admin.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <main className="login">
      <div className="login-card">
        <div className="brand"><span className="brand-dot" aria-hidden /> Talent Live Tracker</div>
        <h1>Masuk</h1>
        <p className="muted" style={{ marginBottom: 22 }}>Pakai akun yang dibuatkan admin.</p>
        {e && PESAN[e] && <div className="notice notice-bad" role="alert">{PESAN[e]}</div>}
        <form action={login} className="form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Kata sandi</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="btn" type="submit">Masuk</button>
        </form>
      </div>
    </main>
  );
}
