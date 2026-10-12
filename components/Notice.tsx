const OK: Record<string, string> = {
  absen: "Absen tercatat.",
  selesai: "Absen selesai tercatat.",
  live: "Data live tersimpan.",
  izin: "Pengajuan izin terkirim. Admin akan meninjau.",
  batal: "Pengajuan izin dibatalkan.",
  slot: "Slot jadwal tersimpan.",
  hapus: "Slot jadwal dibatalkan.",
  setuju: "Izin disetujui.",
  tolak: "Izin ditolak.",
  koreksi: "Status absensi dikoreksi.",
  akun: "Akun talent dibuat.",
  talent: "Data talent tersimpan.",
  beres: "Ditandai sudah dicek.",
  sandi: "Kata sandi diperbarui.",
  kode: "Kode promo tersimpan.",
  "fitur-on": "Fitur kode promo diaktifkan.",
  "minta-sync": "Permintaan sinkronisasi tercatat. Sekarang ketik di chat Claude: proses sync kode promo Talent Live.",
  "batal-sync": "Permintaan sinkronisasi dibatalkan.",
  "fitur-off": "Fitur kode promo dikunci.",
};

export function Notice({ ok, e }: { ok?: string; e?: string }) {
  if (e) return <div className="notice notice-bad" role="alert">{e}</div>;
  if (ok && OK[ok]) return <div className="notice notice-ok" role="status">{OK[ok]}</div>;
  return null;
}
