import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { isYmd } from "@/lib/time";
import { attribute, type PromoCode, type PromoDaily } from "@/lib/promo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SlotPay = { talent_id: string; slot_date: string; sesi: number; sesi_label: string; jam_sesi: number; live_minutes: number; slot_count: number; accounts: string[]; pelanggaran: string[]; amount: number | string };

const tgl = (ymd: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));
const jamMenit = (m: number) => `${Math.floor(m / 60)} j ${m % 60} mnt`;

/** Unduh rekap gaji (Excel) untuk rentang tanggal. Khusus admin. GET /api/export/gaji?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!isYmd(from) || !isYmd(to) || to < from) return NextResponse.json({ error: "Isi rentang tanggal yang valid (from, to)." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (prof?.role !== "admin") return NextResponse.json({ error: "Khusus admin." }, { status: 403 });

  const [{ data: talents }, { data: pay }, { data: att }, { data: sessions }, { data: accounts }, { data: codes }, { data: promo }] = await Promise.all([
    supabase.from("talents").select("id, nickname, full_name").order("nickname"),
    supabase.from("v_slot_pay").select("talent_id, slot_date, sesi, sesi_label, jam_sesi, live_minutes, slot_count, accounts, pelanggaran, amount")
      .gte("slot_date", from).lte("slot_date", to).order("slot_date").order("sesi"),
    supabase.from("v_attendance").select("talent_id, state").gte("slot_date", from).lte("slot_date", to),
    supabase.from("live_sessions").select("talent_id, account_code, duration_minutes").gte("session_date", from).lte("session_date", to),
    supabase.from("live_accounts").select("code, name"),
    supabase.from("promo_codes").select("code, talent_id, account_code, centil_source_id, valid_from, valid_to, is_active"),
    supabase.from("promo_sales_daily").select("centil_source_id, code, sale_date, trx_success, buyers_unique, revenue_idr").gte("sale_date", from).lte("sale_date", to),
  ]);
  const accName = (c: string) => (accounts ?? []).find((a) => a.code === c)?.name ?? c;
  const nick = new Map((talents ?? []).map((t) => [t.id, t]));

  type Row = { sesi: number; gaji: number; pel: number; menit: number; dataLive: number; hadir: number; izin: number; alpha: number; apps: Set<string>; kode: Set<string>; trx: number; revenue: number };
  const per = new Map<string, Row>();
  const get = (id: string) => {
    let r = per.get(id);
    if (!r) { r = { sesi: 0, gaji: 0, pel: 0, menit: 0, dataLive: 0, hadir: 0, izin: 0, alpha: 0, apps: new Set(), kode: new Set(), trx: 0, revenue: 0 }; per.set(id, r); }
    return r;
  };
  ((pay ?? []) as SlotPay[]).forEach((p) => { const r = get(p.talent_id); r.sesi++; r.gaji += Number(p.amount); if (p.pelanggaran.length) r.pel++; p.accounts.forEach((a) => r.apps.add(accName(a))); });
  (att ?? []).forEach((a) => { const r = get(a.talent_id); if (a.state === "hadir" || a.state === "telat") r.hadir++; if (a.state === "izin") r.izin++; if (a.state === "alpha") r.alpha++; });
  (sessions ?? []).forEach((s) => { if (!s.talent_id) return; const r = get(s.talent_id); r.dataLive++; r.menit += s.duration_minutes ?? 0; r.apps.add(accName(s.account_code)); });
  attribute((promo ?? []) as PromoDaily[], (codes ?? []) as PromoCode[]).forEach((x) => { const r = get(x.talent_id); r.kode.add(x.code); r.trx += x.trx_success; r.revenue += x.revenue; });

  // ---------------------------------------------------------------- workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = "Live Hub";
  wb.created = new Date();
  const rentang = `${tgl(from)} – ${tgl(to)}`;
  const head = (ws: ExcelJS.Worksheet) => {
    const h = ws.getRow(3);
    h.font = { bold: true, color: { argb: "FF121212" } };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC8F13A" } };
    h.alignment = { vertical: "middle", wrapText: true };
    h.height = 32;
    ws.views = [{ state: "frozen", ySplit: 3 }];
  };
  const rp = '"Rp"#,##0';

  // Sheet 1: ringkasan per talent
  const s1 = wb.addWorksheet("Ringkasan per talent");
  s1.getCell("A1").value = `Rekap gaji Live Hub: ${rentang}`;
  s1.getCell("A1").font = { bold: true, size: 14 };
  s1.getCell("A2").value = "Gaji dihitung per sesi yang dihadiri (Rp60.000 per sesi 4 jam, Rp30.000 sesi 22.00–00.00). Kode promo sesuai data terakhir dari Centil.";
  s1.getCell("A2").font = { italic: true, color: { argb: "FF5D5A66" } };
  s1.columns = [
    { key: "rentang", width: 30 }, { key: "nama", width: 14 }, { key: "lengkap", width: 22 }, { key: "apps", width: 30 },
    { key: "sesi", width: 12 }, { key: "dataLive", width: 12 }, { key: "jam", width: 14 },
    { key: "hadir", width: 9 }, { key: "izin", width: 8 }, { key: "alpha", width: 11 }, { key: "pel", width: 13 },
    { key: "kode", width: 26 }, { key: "trx", width: 13 }, { key: "revenue", width: 16 }, { key: "gaji", width: 16 },
  ];
  s1.getRow(3).values = ["Rentang tanggal", "Talent", "Nama lengkap", "Aplikasi live", "Sesi live dibayar", "Data live diisi", "Total jam live",
    "Hadir", "Izin", "Tidak hadir", "Sesi dengan pelanggaran", "Kode promo dipakai", "Pemakaian kode promo (transaksi)", "Penjualan kode promo", "Total gaji"];
  head(s1);
  const list = [...per.entries()].filter(([, r]) => r.sesi + r.hadir + r.izin + r.alpha + r.dataLive > 0)
    .sort((a, b) => b[1].gaji - a[1].gaji);
  list.forEach(([id, r]) => {
    const t = nick.get(id);
    s1.addRow({
      rentang, nama: t?.nickname ?? "?", lengkap: t?.full_name ?? "", apps: [...r.apps].join(", "),
      sesi: r.sesi, dataLive: r.dataLive, jam: jamMenit(r.menit), hadir: r.hadir, izin: r.izin, alpha: r.alpha, pel: r.pel,
      kode: [...r.kode].join(", ") || "-", trx: r.trx, revenue: r.revenue, gaji: r.gaji,
    });
  });
  const tot = list.reduce((a, [, r]) => ({ sesi: a.sesi + r.sesi, data: a.data + r.dataLive, h: a.h + r.hadir, i: a.i + r.izin, al: a.al + r.alpha, p: a.p + r.pel, trx: a.trx + r.trx, rev: a.rev + r.revenue, g: a.g + r.gaji }),
    { sesi: 0, data: 0, h: 0, i: 0, al: 0, p: 0, trx: 0, rev: 0, g: 0 });
  const totalRow = s1.addRow({ rentang: "TOTAL", sesi: tot.sesi, dataLive: tot.data, hadir: tot.h, izin: tot.i, alpha: tot.al, pel: tot.p, trx: tot.trx, revenue: tot.rev, gaji: tot.g });
  totalRow.font = { bold: true };
  s1.getColumn("revenue").numFmt = rp;
  s1.getColumn("gaji").numFmt = rp;
  s1.autoFilter = { from: "A3", to: "O3" };

  // Sheet 2: rincian per sesi
  const s2 = wb.addWorksheet("Rincian per sesi");
  s2.getCell("A1").value = `Rincian gaji per sesi: ${rentang}`;
  s2.getCell("A1").font = { bold: true, size: 14 };
  s2.columns = [
    { key: "tgl", width: 14 }, { key: "nama", width: 14 }, { key: "sesi", width: 7 }, { key: "jam", width: 14 },
    { key: "apps", width: 24 }, { key: "menit", width: 11 }, { key: "slot", width: 9 }, { key: "gaji", width: 14 }, { key: "pel", width: 50 },
  ];
  s2.getRow(3).values = ["Tanggal", "Talent", "Sesi", "Jam sesi", "Aplikasi live", "Menit live", "Jumlah slot", "Gaji", "Catatan pelanggaran"];
  head(s2);
  ((pay ?? []) as SlotPay[]).forEach((p) => {
    s2.addRow({
      tgl: new Date(`${p.slot_date}T00:00:00Z`), nama: nick.get(p.talent_id)?.nickname ?? "?", sesi: p.sesi, jam: p.sesi_label,
      apps: p.accounts.map(accName).join(", "), menit: p.live_minutes, slot: p.slot_count, gaji: Number(p.amount), pel: p.pelanggaran.join("; "),
    });
  });
  s2.getColumn("tgl").numFmt = "dd/mm/yyyy";
  s2.getColumn("gaji").numFmt = rp;
  s2.autoFilter = { from: "A3", to: "I3" };

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="gaji-live-hub_${from}_sd_${to}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
