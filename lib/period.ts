import { createClient } from "@/lib/supabase/server";
import { hariIni, isYmd } from "@/lib/time";

export type Period = { start: string; end: string; label: string; prev: string; next: string; custom: boolean };

const fmt = (ymd: string, withYear = false) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" })
    .format(new Date(`${ymd}T00:00:00Z`));

function ymd(y: number, m: number, d: number) {
  // m: 1..12, tanggal di-clamp ke akhir bulan
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
function minusDay(s: string) {
  const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10);
}

export async function payrollStartDay(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "payroll_period_start_day").maybeSingle();
  const n = Number(data?.value);
  return n >= 1 && n <= 28 ? n : 25;
}

/** Periode gaji yang memuat tanggal `ref`: [tgl D bulan lalu .. D-1 bulan ini]. */
export function periodOf(ref: string, day: number): Period {
  const [y, m, d] = ref.split("-").map(Number);
  let sy = y, sm = m;
  if (d < day) { sm -= 1; if (sm === 0) { sm = 12; sy -= 1; } }
  const start = ymd(sy, sm, day);
  let ny = sy, nm = sm + 1; if (nm === 13) { nm = 1; ny += 1; }
  const nextStart = ymd(ny, nm, day);
  const end = minusDay(nextStart);
  let py = sy, pm = sm - 1; if (pm === 0) { pm = 12; py -= 1; }
  return { start, end, label: `${fmt(start)} – ${fmt(end, true)}`, prev: ymd(py, pm, day), next: nextStart, custom: false };
}

/** Baca rentang dari query (?from&to = rentang bebas, ?p = tanggal di dalam periode gaji). */
export async function resolvePeriod(sp: { from?: string; to?: string; p?: string }): Promise<Period> {
  const day = await payrollStartDay();
  if (isYmd(sp.from) && isYmd(sp.to)) {
    const [a, b] = sp.from! <= sp.to! ? [sp.from!, sp.to!] : [sp.to!, sp.from!];
    const cur = periodOf(a, day);
    return { start: a, end: b, label: `${fmt(a)} – ${fmt(b, true)}`, prev: cur.prev, next: cur.next, custom: true };
  }
  return periodOf(isYmd(sp.p) ? sp.p! : hariIni(), day);
}
