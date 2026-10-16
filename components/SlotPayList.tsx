import { menitKeJam, rupiah, tanggalPendek } from "@/lib/time";

export type SlotPay = {
  talent_id: string; slot_date: string; sesi: number; sesi_label: string; jam_sesi: number;
  live_minutes: number; slot_count: number; accounts: string[]; pelanggaran: string[]; amount: number | string; menunggu_data_live?: boolean;
};

/** Rincian gaji per sesi (satu baris = satu sesi yang dihadiri). */
export function SlotPayList({ rows, accName }: { rows: SlotPay[]; accName: Map<string, string> }) {
  if (!rows.length) return <div className="empty"><strong>Belum ada sesi yang dihadiri</strong>Tidak ada sesi di rentang ini.</div>;
  return (
    <div className="list">
      {rows.map((r) => (
        <div key={`${r.talent_id}-${r.slot_date}-${r.sesi}`} className="li">
          <span className={`av c${r.sesi % 5}`} aria-hidden>S{r.sesi}</span>
          <div>
            <div className="t">{tanggalPendek(r.slot_date)} <span className="s">sesi {r.sesi}, {r.sesi_label}</span></div>
            <div className="s">{r.accounts.map((a) => accName.get(a) ?? a).join(", ")}, live {menitKeJam(r.live_minutes)}{r.slot_count > 1 ? ` (gabungan ${r.slot_count} slot)` : ""}</div>
            {r.menunggu_data_live && <div className="chg"><span className="badge badge-pending">menunggu data live (maks. 3 jam setelah sesi)</span></div>}
            {r.pelanggaran.length > 0 && (
              <div className="chg">{r.pelanggaran.map((p) => <span key={p} className="badge badge-alpha">{p}</span>)}</div>
            )}
          </div>
          <div className="r"><strong style={{ fontFamily: "var(--disp)" }}>{rupiah(r.amount)}</strong><span className="s">{r.jam_sesi} jam</span></div>
        </div>
      ))}
    </div>
  );
}
