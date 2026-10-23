// Lokasi di GitHub: lib/range.ts
import { isYmd } from "@/lib/time";
import { monthRange } from "@/components/AttendanceTable";

export type Range = { start: string; end: string; label: string; prev: string; next: string; month: string; custom: boolean };

const fmt = (ymd: string, withYear = false) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" })
    .format(new Date(`${ymd}T00:00:00Z`));

/** Rentang dari query: ?from&to = rentang bebas, selain itu ?m=YYYY-MM (default bulan ini). */
export function resolveRange(sp: { m?: string; from?: string; to?: string }): Range {
  if (isYmd(sp.from) && isYmd(sp.to)) {
    const [a, b] = sp.from! <= sp.to! ? [sp.from!, sp.to!] : [sp.to!, sp.from!];
    const mr = monthRange(a.slice(0, 7));
    return { start: a, end: b, label: `${fmt(a)} – ${fmt(b, true)}`, prev: mr.prev, next: mr.next, month: mr.month, custom: true };
  }
  const mr = monthRange(sp.m);
  return { start: mr.start, end: mr.end, label: mr.label, prev: mr.prev, next: mr.next, month: mr.month, custom: false };
}

/** Label sumbu grafik harian: "05" dalam satu bulan, "05/10" bila rentang lintas bulan. */
export function dayLabel(ymd: string, r: Range) {
  return r.start.slice(0, 7) === r.end.slice(0, 7) ? ymd.slice(8) : `${ymd.slice(8)}/${ymd.slice(5, 7)}`;
}
