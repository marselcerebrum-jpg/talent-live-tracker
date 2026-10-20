import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, hariIni, jam, menitKeJam, tanggalPendek } from "@/lib/time";

/**
 * Pengingat batas waktu isi data live (khusus talent).
 * Muncul untuk slot yang sudah selesai, statusnya hadir, tapi belum ada data live.
 * Kuning sebelum batas (selesai + N jam), merah setelah batas (sudah tercatat pelanggaran).
 */
export async function DataLiveReminder({ talentId }: { talentId: string }) {
  const supabase = await createClient();
  const today = hariIni();
  const [{ data: slots }, { data: cfg }, { data: accounts }] = await Promise.all([
    supabase.from("v_attendance").select("slot_id, account_code, slot_date, start_at, end_at, state, session_count")
      .eq("talent_id", talentId).gte("slot_date", addDays(today, -7)).lte("slot_date", today)
      .eq("state", "hadir").eq("session_count", 0).order("end_at"),
    supabase.from("app_settings").select("value").eq("key", "data_live_deadline_hours").maybeSingle(),
    supabase.from("live_accounts").select("code, name"),
  ]);
  const hours = Number(cfg?.value) > 0 ? Number(cfg?.value) : 24;
  const now = Date.now();
  const items = (slots ?? [])
    .filter((s) => new Date(s.end_at).getTime() <= now)
    .map((s) => ({ ...s, deadline: new Date(new Date(s.end_at).getTime() + hours * 3600_000) }));
  if (!items.length) return null;
  const accName = (c: string) => (accounts ?? []).find((a) => a.code === c)?.name ?? c;

  return (
    <div className="stack" style={{ gap: 10, marginBottom: 18 }}>
      {items.map((s) => {
        const left = Math.round((s.deadline.getTime() - now) / 60000);
        const late = left <= 0;
        return (
          <div key={s.slot_id} className={`notice ${late ? "notice-bad" : "notice-warn"}`} role="status" style={{ marginBottom: 0 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <strong>Data live {accName(s.account_code)} {s.slot_date === today ? "" : `${tanggalPendek(s.slot_date)} `}{jam(s.start_at)}–{jam(s.end_at)} belum diisi.</strong>{" "}
                {late
                  ? "Lewat batas, tercatat pelanggaran. Masih bisa diisi sekarang supaya data performa lengkap."
                  : `Batas ${s.deadline.toISOString().slice(0, 10) === today ? "hari ini" : tanggalPendek(s.deadline.toISOString().slice(0, 10))} pukul ${jam(s.deadline.toISOString())} (sisa ${menitKeJam(left)}).`}
              </div>
              <Link className="btn btn-sm" href={`/live/baru?akun=${s.account_code}&tgl=${s.slot_date}`}>Isi sekarang</Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
