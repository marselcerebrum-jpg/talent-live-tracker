"use client";
// Lokasi di GitHub: components/LiveGuard.tsx

import { useEffect, useRef } from "react";

export type GuardData = {
  /** jadwal talent (status terjadwal) di sekitar tanggal pengisian */
  slots: { account: string; date: string; start: string; end: string }[];
  /** data live yang sudah tersimpan untuk talent ini */
  existing: { account: string; platform: string; date: string; start: string | null; minutes: number | null }[];
  accountNames: Record<string, string>;
  /** absen talent (termasuk absen di luar jadwal): live di sekitar jam absen dianggap sesuai */
  checkins?: { date: string; start: string; end: string | null }[];
};

const hm = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/**
 * Poka-yoke form data live (dicek di HP sebelum dikirim):
 * 1. Bentrok >5 menit dengan data live yang sudah tersimpan (akun, platform, tanggal sama) -> ditolak.
 * 2. Jam mulai tidak masuk jendela jadwal hari itu (1 jam sebelum mulai s.d. selesai) -> minta konfirmasi.
 */
export function LiveGuard({ data }: { data?: GuardData }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form || !data) return;
    const onSubmit = (e: SubmitEvent) => {
      const f = new FormData(form);
      const account = String(f.get("account_code") ?? "");
      const platform = f.get("platform") === "instagram" ? "instagram" : "tiktok";
      const date = String(f.get("session_date") ?? "");
      const time = String(f.get("start_time") ?? "");
      const dur = Number(f.get("duration_minutes") ?? 0);
      if (!account || !date || !/^\d{2}:\d{2}$/.test(time) || !(dur > 0)) return; // biar validasi bawaan yang menangani
      const start = new Date(`${date}T${time}:00+07:00`).getTime();
      const end = start + dur * 60000;
      const name = (c: string) => data.accountNames[c] ?? c;
      const block = (msg: string) => { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); (e as SubmitEvent & { __lhBlocked?: boolean }).__lhBlocked = true; window.alert(msg); };

      const clash = data.existing.find((x) => x.account === account && x.platform === platform && x.date === date && x.start &&
        Math.min(new Date(x.start).getTime() + (x.minutes ?? 0) * 60000, end) - Math.max(new Date(x.start).getTime(), start) > 5 * 60000);
      if (clash) {
        block(`Jam ${time} bentrok dengan data live ${name(account)} yang sudah tersimpan (mulai ${hm(clash.start!)}, ${clash.minutes ?? 0} menit).\n\nPeriksa lagi jam mulainya. Kalau live lanjutan, jam mulainya setelah live sebelumnya selesai.`);
        return;
      }
      if (platform !== "tiktok") return;
      const daySlots = data.slots.filter((s) => s.date === date);
      const fitsCheckin = (data.checkins ?? []).some((c) => c.date === date &&
        start >= new Date(c.start).getTime() - 3600_000 &&
        start < (c.end ? new Date(c.end).getTime() + 30 * 60000 : new Date(c.start).getTime() + 6 * 3600_000));
      const fits = fitsCheckin || daySlots.some((s) => start >= new Date(s.start).getTime() - 3600_000 && start < new Date(s.end).getTime());
      if (!fits) {
        const list = daySlots.length ? daySlots.map((s) => `${name(s.account)} ${hm(s.start)}–${hm(s.end)}`).join(", ") : "tidak ada jadwal";
        const absenHariIni = (data.checkins ?? []).filter((c) => c.date === date);
        const pesanAbsen = absenHariIni.length
          ? `\n\nKamu absen pukul ${absenHariIni.map((c) => hm(c.start)).join(", ")}. Live di jam yang berbeda dari jam absen akan tercatat sebagai PELANGGARAN. Kalau live di luar jadwal, seharusnya lapor lewat "Absen di luar jadwal" saat mulai live.`
          : "";
        const ok = window.confirm(`Jam mulai ${time} tidak cocok dengan jadwalmu di tanggal itu (${list}).${pesanAbsen}\n\nPastikan jam mulai sesuai jam saat live dimulai. Tetap simpan?`);
        if (!ok) { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); (e as SubmitEvent & { __lhBlocked?: boolean }).__lhBlocked = true; }
      }
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [data]);
  return <span ref={ref} hidden />;
}
