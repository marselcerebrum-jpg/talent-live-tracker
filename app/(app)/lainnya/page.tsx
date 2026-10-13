import Link from "next/link";
import { getMe } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { featureOn } from "@/lib/features";
import { displayLogin } from "@/lib/username";

type Tile = { href: string; title: string; desc: string };

export default async function Lainnya() {
  const me = await getMe();
  const promoOn = await featureOn("feature_promo");
  const tiles: Tile[] = me.role === "admin"
    ? [
        { href: "/admin/cek-ulang", title: "Cek tayangan ulang", desc: "Cocokkan dengan rekaman" },
        { href: "/admin/gaji", title: "Estimasi gaji", desc: "Periode 25–24 / rentang" },
        { href: "/admin/absensi", title: "Absensi tim", desc: "Rekap & laporan" },
        { href: "/admin/live", title: "Data live tim", desc: "Sesi & jam live" },
        { href: "/admin/performa", title: "Performa", desc: "Tayangan & peringkat" },
        ...(promoOn ? [{ href: "/admin/promo", title: "Kode promo", desc: "Sales per talent" }] : []),
        { href: "/admin/talent", title: "Talent & akun", desc: "Login & data talent" },
        { href: "/admin/admin", title: "Kelola admin", desc: "Tambah & reset sandi" },
        { href: "/admin/perlu-dicek", title: "Perlu dicek", desc: "Data meragukan" },
        { href: "/jadwal", title: "Kalender tim", desc: "Jadwal mingguan" },
        { href: "/akun", title: "Ganti sandi", desc: "Keamanan akun" },
      ]
    : [
        { href: "/performa", title: "Performa", desc: "Dibanding rata-rata tim" },
        { href: "/gaji", title: "Estimasi gaji", desc: "Periode 25–24" },
        { href: "/absensi", title: "Absensi", desc: "Rekap kehadiran" },
        { href: "/izin", title: "Izin", desc: "Ajukan & cek status" },
        { href: "/akun", title: "Ganti sandi", desc: "Keamanan akun" },
      ];
  return (
    <>
      <div className="page-head"><div><h1>Lainnya</h1><p>Masuk sebagai {me.nickname ?? displayLogin(me.email)}</p></div></div>
      <div className="menu-grid">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="menu-tile"><strong>{t.title}</strong><span>{t.desc}</span></Link>
        ))}
      </div>
      <form action={logout} style={{ marginTop: 24 }}><button className="btn btn-ghost" type="submit">Keluar</button></form>
    </>
  );
}
