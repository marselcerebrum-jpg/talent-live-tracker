export type PerfRow = {
  id: string; talent_id: string | null; account_code: string; platform: string; session_date: string;
  started_at: string | null; duration_minutes: number | null; total_views: number | null; unique_viewers: number | null;
  peak_concurrent: number | null; avg_watch_seconds: number | null; active_viewers: number | null; topic: string | null;
};

export type Agg = {
  key: string; sesi: number; menit: number; views: number; avgViews: number | null; avgUnique: number | null;
  avgPeak: number | null; medianWatch: number | null; viewsPerHour: number | null; maxPeak: number | null;
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const nums = (rows: PerfRow[], k: keyof PerfRow) => rows.map((r) => r[k]).filter((v): v is number => typeof v === "number");

export function aggregate(key: string, rows: PerfRow[]): Agg {
  const tiktok = rows.filter((r) => r.platform === "tiktok");
  const withViews = tiktok.filter((r) => r.total_views !== null && (r.duration_minutes ?? 0) > 0);
  const vMin = withViews.reduce((a, r) => a + (r.duration_minutes ?? 0), 0);
  const peaks = nums(tiktok, "peak_concurrent");
  return {
    key,
    sesi: rows.length,
    menit: rows.reduce((a, r) => a + (r.duration_minutes ?? 0), 0),
    views: nums(tiktok, "total_views").reduce((a, b) => a + b, 0),
    avgViews: avg(nums(tiktok, "total_views")),
    avgUnique: avg(nums(tiktok, "unique_viewers")),
    avgPeak: avg(peaks),
    medianWatch: median(nums(tiktok, "avg_watch_seconds")),
    viewsPerHour: vMin ? (withViews.reduce((a, r) => a + (r.total_views ?? 0), 0) / vMin) * 60 : null,
    maxPeak: peaks.length ? Math.max(...peaks) : null,
  };
}

export function groupBy(rows: PerfRow[], fn: (r: PerfRow) => string | null): Agg[] {
  const m = new Map<string, PerfRow[]>();
  rows.forEach((r) => {
    const k = fn(r);
    if (!k) return;
    m.set(k, [...(m.get(k) ?? []), r]);
  });
  return [...m.entries()].map(([k, rs]) => aggregate(k, rs));
}

/** Deret harian lengkap (hari tanpa live = 0) */
export function daily(rows: PerfRow[], start: string, end: string) {
  const out: { date: string; views: number; peak: number; menit: number }[] = [];
  const by = new Map<string, PerfRow[]>();
  rows.forEach((r) => by.set(r.session_date, [...(by.get(r.session_date) ?? []), r]));
  for (let d = new Date(`${start}T12:00:00Z`); d.toISOString().slice(0, 10) <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    const rs = by.get(k) ?? [];
    out.push({
      date: k,
      views: rs.reduce((a, r) => a + (r.total_views ?? 0), 0),
      peak: Math.max(0, ...rs.map((r) => r.peak_concurrent ?? 0)),
      menit: rs.reduce((a, r) => a + (r.duration_minutes ?? 0), 0),
    });
  }
  return out;
}

export const fmtNum = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined || Number.isNaN(n) ? "–" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(n);

export function delta(mine: number | null, team: number | null) {
  if (mine === null || team === null || !team) return null;
  return ((mine - team) / team) * 100;
}
