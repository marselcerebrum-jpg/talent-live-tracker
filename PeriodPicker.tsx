import Link from "next/link";
import type { Period } from "@/lib/period";

/** Navigasi periode gaji (25–24) + rentang bebas. */
export function PeriodPicker({ base, period, startDay = 25 }: { base: string; period: Period; startDay?: number }) {
  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div className="row">
        <Link className="btn btn-ghost btn-sm" href={`${base}?p=${period.prev}`}>Periode sebelumnya</Link>
        <Link className="btn btn-ghost btn-sm" href={base}>Periode berjalan</Link>
        <Link className="btn btn-ghost btn-sm" href={`${base}?p=${period.next}`}>Periode berikutnya</Link>
        <span className="spacer" />
        <form className="row" action={base}>
          <label className="row small" style={{ gap: 6 }}>Dari <input type="date" name="from" defaultValue={period.start} required style={{ width: "auto" }} /></label>
          <label className="row small" style={{ gap: 6 }}>Sampai <input type="date" name="to" defaultValue={period.end} required style={{ width: "auto" }} /></label>
          <button className="btn btn-sm" type="submit">Pakai rentang ini</button>
        </form>
      </div>
      <p className="metric-note">{period.custom ? "Rentang bebas." : `Periode gaji: tanggal ${startDay} bulan lalu sampai ${startDay - 1} bulan ini.`}</p>
    </div>
  );
}
