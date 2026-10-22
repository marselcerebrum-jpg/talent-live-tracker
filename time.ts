export const TZ = "Asia/Jakarta";

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("id-ID", { timeZone: TZ, ...opts });

/** "15:10" */
export function jam(iso: string | null | undefined) {
  if (!iso) return "–";
  return fmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)).replace(".", ":");
}

/** "Senin, 12 Okt" */
export function tanggalPendek(d: string | Date) {
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T12:00:00+07:00` : d) : d;
  return fmt({ weekday: "long", day: "numeric", month: "short" }).format(date);
}

/** "12 Oktober 2026" */
export function tanggalPanjang(d: string | Date) {
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T12:00:00+07:00` : d) : d;
  return fmt({ day: "numeric", month: "long", year: "numeric" }).format(date);
}

/** Tanggal hari ini di WIB, format YYYY-MM-DD */
export function hariIni(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/** Senin dari minggu yang memuat tanggal ymd */
export function senin(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00+07:00`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Senin
  return addDays(ymd, -dow);
}

/** Gabung tanggal + jam lokal WIB jadi ISO */
export function keISO(ymd: string, hhmm: string): string {
  return `${ymd}T${hhmm}:00+07:00`;
}

export function rupiah(n: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n ?? 0));
}

export function menitKeJam(menit: number | null | undefined) {
  const m = Math.max(0, Math.round(menit ?? 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} mnt`;
  return r ? `${h} j ${r} mnt` : `${h} jam`;
}

export function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
