import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Penerima data penjualan kode promo harian (hasil template Centil `promo-code-sales-daily-range`).
 *
 * POST /api/promo/ingest
 * Header: Authorization: Bearer <PROMO_INGEST_SECRET>
 * Body: {
 *   "range": { "start": "2026-09-01", "end": "2026-09-30" },      // opsional, untuk log
 *   "rows": [{ "centil_source_id": "jadiasn", "sale_date": "2026-09-01", "promo_code": "KEBUTCPNS",
 *              "trx_success": 3, "buyers_unique": 3, "revenue_idr": 412000 }]
 * }
 * Upsert per (centil_source_id, code, sale_date): mengirim ulang data yang sama aman.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PROMO_INGEST_SECRET;
  if (!secret) return NextResponse.json({ error: "PROMO_INGEST_SECRET belum diatur" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { range?: { start?: string; end?: string }; rows?: Record<string, unknown>[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "body bukan JSON" }, { status: 400 }); }
  const raw = Array.isArray(body.rows) ? body.rows : [];
  if (raw.length > 20000) return NextResponse.json({ error: "maksimal 20.000 baris per kiriman" }, { status: 413 });

  type Row = { centil_source_id: string; code: string; sale_date: string; trx_success: number; buyers_unique: number; revenue_idr: number; synced_at: string };
  const rows: Row[] = [];
  const rejected: number[] = [];
  raw.forEach((r, i) => {
    const src = String(r.centil_source_id ?? r._source_id ?? "").trim().toLowerCase();
    const code = String(r.promo_code ?? r.code ?? "").trim().toUpperCase();
    const date = String(r.sale_date ?? "").slice(0, 10);
    const trx = Number(r.trx_success), buyers = Number(r.buyers_unique ?? 0), rev = Number(r.revenue_idr);
    if (!src || !code || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(trx) || !Number.isFinite(rev)) { rejected.push(i); return; }
    rows.push({ centil_source_id: src, code, sale_date: date, trx_success: Math.round(trx), buyers_unique: Math.round(buyers || 0), revenue_idr: rev, synced_at: new Date().toISOString() });
  });

  const db = createServiceClient();
  const { data: run } = await db.from("sync_runs").insert({ kind: "centil_promo", params: { range: body.range ?? null, received: raw.length } }).select("id").single();
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await db.from("promo_sales_daily").upsert(rows.slice(i, i + 1000), { onConflict: "centil_source_id,code,sale_date" });
    if (error) {
      if (run) await db.from("sync_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: error.message }).eq("id", run.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  if (run) await db.from("sync_runs").update({ status: "success", finished_at: new Date().toISOString(), rows: rows.length }).eq("id", run.id);
  return NextResponse.json({ ok: true, upserted: rows.length, rejected: rejected.length });
}
