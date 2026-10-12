import { simpanLive } from "@/app/(app)/actions";
import { hariIni } from "@/lib/time";

type Opt = { value: string; label: string };

export function LiveForm({ accounts, talents, from }: { accounts: Opt[]; talents?: Opt[]; from: string }) {
  return (
    <form action={simpanLive} className="form">
      <input type="hidden" name="from" value={from} />
      <fieldset>
        <legend>Sesi live</legend>
        <div className="form-grid">
          {talents && (
            <div className="field">
              <label htmlFor="talent_id">Talent</label>
              <select id="talent_id" name="talent_id" required defaultValue="">
                <option value="" disabled>Pilih talent</option>
                {talents.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="account_code">Akun live</label>
            <select id="account_code" name="account_code" required defaultValue="">
              <option value="" disabled>Pilih akun</option>
              {accounts.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="platform">Platform</label>
            <select id="platform" name="platform" defaultValue="tiktok">
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="session_date">Tanggal</label>
            <input id="session_date" name="session_date" type="date" required defaultValue={hariIni()} />
          </div>
          <div className="field">
            <label htmlFor="start_time">Jam mulai (WIB)</label>
            <input id="start_time" name="start_time" type="time" required />
          </div>
          <div className="field">
            <label htmlFor="duration_minutes">Durasi (menit)</label>
            <input id="duration_minutes" name="duration_minutes" type="number" min={1} max={600} inputMode="numeric" required />
            <span className="hint">Dipakai untuk menghitung gaji.</span>
          </div>
        </div>
      </fieldset>

      <details className="more" open>
        <summary>Statistik TikTok</summary>
      <fieldset>
        <div className="form-grid">
          {[
            ["total_views", "Total tayangan"],
            ["unique_viewers", "Penonton unik"],
            ["active_viewers", "Penonton aktif"],
            ["avg_watch_seconds", "Rata-rata durasi menonton (detik)"],
            ["peak_concurrent", "Penonton bersamaan tertinggi"],
            ["avg_concurrent", "Rata-rata penonton bersamaan"],
          ].map(([n, l]) => (
            <div className="field" key={n}>
              <label htmlFor={n}>{l}</label>
              <input id={n} name={n} type="number" min={0} inputMode="numeric" />
            </div>
          ))}
        </div>
      </fieldset>

      </details>
      <details className="more">
        <summary>Statistik Instagram (kalau live di IG)</summary>
      <fieldset>
        <div className="form-grid">
          {[
            ["ig_reach", "Jangkauan"],
            ["ig_peak_concurrent", "Penonton bersamaan tertinggi"],
            ["ig_engaged", "Akun yang berinteraksi"],
          ].map(([n, l]) => (
            <div className="field" key={n}>
              <label htmlFor={n}>{l}</label>
              <input id={n} name={n} type="number" min={0} inputMode="numeric" />
            </div>
          ))}
        </div>
      </fieldset>

      </details>
      <div className="field">
        <label htmlFor="topic">Materi</label>
        <input id="topic" name="topic" placeholder="Contoh: Bahas latihan soal TWK" />
      </div>
      <div className="field">
        <label htmlFor="notes">Catatan</label>
        <textarea id="notes" name="notes" placeholder="Kendala teknis, pertanyaan penonton yang sering muncul, dll." />
      </div>
      {talents && (
        <div className="field">
          <label htmlFor="evaluation">Evaluasi (admin)</label>
          <textarea id="evaluation" name="evaluation" />
        </div>
      )}
      <div className="row"><button className="btn" type="submit">Simpan data live</button></div>
    </form>
  );
}
