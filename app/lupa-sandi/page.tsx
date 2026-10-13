import Link from "next/link";
import { kirimLinkReset } from "./actions";

const PESAN: Record<string, string> = {
  talent: "Akun talent (username) tidak bisa reset lewat email. Minta admin mengatur ulang kata sandimu.",
  limit: "Terlalu banyak permintaan. Coba lagi beberapa menit lagi, atau minta admin lain mengatur ulang kata sandimu.",
  link: "Link reset tidak valid, sudah dipakai, atau kedaluwarsa (berlaku 1 jam, sekali pakai). Minta link baru di bawah.",
};

export default async function LupaSandi({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="login">
      <div className="login-card">
        <div className="brand"><span className="brand-name"><span className="brand-dot" aria-hidden />Talent Live</span></div>
        <h1>Lupa kata sandi</h1>
        <p className="muted" style={{ marginBottom: 20 }}>Khusus admin yang memakai email. Talent: minta admin mengatur ulang kata sandimu.</p>
        {sp.e && PESAN[sp.e] && <div className="notice notice-bad" role="alert">{PESAN[sp.e]}</div>}
        {sp.ok ? (
          <div className="notice notice-ok" role="status">
            Kalau email itu terdaftar sebagai admin, link reset sudah dikirim. Buka email (boleh dari HP), klik link-nya, lalu buat kata sandi baru. Link hanya bisa dipakai sekali. Cek juga folder Spam.
          </div>
        ) : (
          <form action={kirimLinkReset} className="form">
            <div className="field">
              <label htmlFor="email">Email admin</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <button className="btn" type="submit">Kirim link reset</button>
          </form>
        )}
        <p className="small" style={{ marginTop: 18 }}><Link href="/login">Kembali ke halaman masuk</Link></p>
      </div>
    </main>
  );
}
