export type PromoDaily = { centil_source_id: string; code: string; sale_date: string; trx_success: number; buyers_unique: number; revenue_idr: number | string };
export type PromoCode = { code: string; talent_id: string; account_code: string; centil_source_id: string; valid_from: string | null; valid_to: string | null; is_active: boolean };

export type PromoAgg = { key: string; trx: number; buyers: number; revenue: number; codes: Set<string> };

/** Atribusikan baris harian ke kode milik talent (cek periode berlaku), lalu agregasi. */
export function attribute(daily: PromoDaily[], codes: PromoCode[]) {
  const byCode = new Map(codes.map((c) => [`${c.centil_source_id}|${c.code}`, c]));
  return daily
    .map((d) => {
      const c = byCode.get(`${d.centil_source_id}|${d.code}`);
      if (!c) return null;
      if (c.valid_from && d.sale_date < c.valid_from) return null;
      if (c.valid_to && d.sale_date > c.valid_to) return null;
      return { ...d, talent_id: c.talent_id, account_code: c.account_code, revenue: Number(d.revenue_idr) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export function sumBy<T extends { trx_success: number; buyers_unique: number; revenue: number; code: string }>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, PromoAgg>();
  rows.forEach((r) => {
    const k = key(r);
    const a = m.get(k) ?? { key: k, trx: 0, buyers: 0, revenue: 0, codes: new Set<string>() };
    a.trx += r.trx_success; a.buyers += r.buyers_unique; a.revenue += r.revenue; a.codes.add(r.code);
    m.set(k, a);
  });
  return [...m.values()].sort((a, b) => b.revenue - a.revenue);
}

export function dateRange(from?: string, to?: string) {
  const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const start = ok(from) ? from! : `${today.slice(0, 7)}-01`;
  const end = ok(to) ? to! : today;
  return end < start ? { start: end, end: start } : { start, end };
}
