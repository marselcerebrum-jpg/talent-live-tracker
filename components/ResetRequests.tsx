import { jam, tanggalPendek } from "@/lib/time";
import { Avatar } from "@/components/Avatar";
import { abaikanReset, selesaikanReset } from "@/app/(app)/admin/actions";

export type ResetReq = { id: number; display_name: string; role: string; login: string; requested_at: string };

/** Permintaan reset kata sandi yang menunggu admin. */
export function ResetRequests({ rows, ret }: { rows: ResetReq[]; ret: string }) {
  if (!rows.length) return null;
  return (
    <section className="panel flush" style={{ marginBottom: 20 }}>
      <div className="band pink"><h2>Permintaan ubah kata sandi ({rows.length})</h2><span className="small">kabari lewat WhatsApp setelah diubah</span></div>
      <div className="list">
        {rows.map((r) => (
          <div key={r.id} className="li">
            <Avatar name={r.display_name} />
            <div>
              <div className="t">{r.display_name} <span className="s">{r.role === "admin" ? "admin" : `talent, username ${r.login}`}</span></div>
              <div className="s">Diminta {tanggalPendek(r.requested_at)} {jam(r.requested_at)}</div>
              <form action={selesaikanReset} className="row" style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={r.id} /><input type="hidden" name="ret" value={ret} />
                <input name="password" type="text" minLength={8} required placeholder="Kata sandi baru, min. 8 karakter" aria-label="Kata sandi baru" style={{ flex: 1, minWidth: 200 }} />
                <button className="btn btn-sm" type="submit">Simpan sandi baru</button>
              </form>
            </div>
            <form action={abaikanReset}>
              <input type="hidden" name="id" value={r.id} /><input type="hidden" name="ret" value={ret} />
              <button className="btn btn-ghost btn-sm" type="submit">Abaikan</button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}
