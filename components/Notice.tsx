const OK: Record<string, string> = {
  absen: "Absen tercatat.",
  "luar-jadwal": "Absen di luar jadwal tercatat dan dilaporkan ke admin.",
  selesai: "Absen selesai tercatat.",
  live: "Data live tersimpan.",
  izin: "Pengajuan izin terkirim. Admin akan meninjau.",
  batal: "Pengajuan izin dibatalkan.",
  slot: "Slot jadwal tersimpan.",
  hapus: "Slot jadwal dibatalkan.",
  setuju: "Izin disetujui.",
  tolak: "Izin ditolak.",
  koreksi: "Status absensi dikoreksi.",
  perubahan: "Perubahan jadwal dicatat.",
  "replay-sesuai": "Ditandai sesuai dengan tayangan ulang.",
  "replay-hapus": "Sesi dobel dihapus. Gaji dan absensi otomatis menyesuaikan.",
  "replay-perbaiki": "Sesi diperbaiki dan dicocokkan ulang ke jadwal.",
  "replay-alpha": "Slot diubah menjadi tidak hadir.",
  "hapus-perubahan": "Catatan dihapus, slot kembali ke jadwal semula.",
  akun: "Akun talent dibuat.",
  talent: "Data talent tersimpan.",
  beres: "Ditandai sudah dicek.",
  sandi: "Kata sandi diperbarui.",
  "admin-baru": "Admin baru ditambahkan. Kirim email dan kata sandinya ke orang tersebut.",
  "buat-sandi": "Link reset berhasil. Sekarang buat kata sandi baru di bawah ini.",
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
