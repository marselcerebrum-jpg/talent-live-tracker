import { getMe } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import { featureOn } from "@/lib/features";
import { displayLogin } from "@/lib/username";

const TALENT_NAV: NavItem[] = [
  { href: "/", label: "Hari ini" },
  { href: "/jadwal", label: "Jadwal" },
  { href: "/live", label: "Data live" },
  { href: "/performa", label: "Performa" },
  { href: "/gaji", label: "Estimasi gaji" },
  { href: "/absensi", label: "Absensi" },
  { href: "/izin", label: "Izin" },
];
const TALENT_TABS: NavItem[] = [
  { href: "/", label: "Hari ini" },
  { href: "/jadwal", label: "Jadwal" },
  { href: "/live", label: "Live" },
  { href: "/lainnya", label: "Lainnya" },
];

const ADMIN_HARIAN: NavItem[] = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/jadwal", label: "Kelola jadwal" },
  { href: "/admin/izin", label: "Persetujuan izin" },
  { href: "/admin/absensi", label: "Absensi tim" },
  { href: "/admin/cek-ulang", label: "Cek tayangan ulang" },
];
const ADMIN_ANALISIS: NavItem[] = [
  { href: "/admin/gaji", label: "Estimasi gaji" },
  { href: "/admin/live", label: "Data live tim" },
  { href: "/admin/performa", label: "Performa live" },
  { href: "/admin/promo", label: "Kode promo" },
];
const ADMIN_ATUR: NavItem[] = [
  { href: "/admin/talent", label: "Talent & akun" },
  { href: "/admin/admin", label: "Kelola admin" },
  { href: "/admin/perlu-dicek", label: "Perlu dicek" },
  { href: "/jadwal", label: "Kalender tim" },
];
const ADMIN_TABS: NavItem[] = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/jadwal", label: "Jadwal" },
  { href: "/admin/izin", label: "Izin" },
  { href: "/lainnya", label: "Lainnya" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const isAdmin = me.role === "admin";
  const promoOn = await featureOn("feature_promo");
  const analisis = ADMIN_ANALISIS.filter((i) => promoOn || i.href !== "/admin/promo");
  const who = me.nickname ?? displayLogin(me.email);

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="brand-name"><span className="brand-dot" aria-hidden />Live Hub</span></div>
        {isAdmin ? (
          <>
            <div className="nav-group">Harian</div>
            <NavLinks items={ADMIN_HARIAN} className="nav" />
            <div className="nav-group">Analisis</div>
            <NavLinks items={analisis} className="nav" />
            <div className="nav-group">Pengaturan</div>
            <NavLinks items={ADMIN_ATUR} className="nav" />
          </>
        ) : (
          <NavLinks items={TALENT_NAV} className="nav" />
        )}
        <div className="side-foot" style={{ marginTop: "auto" }}>
          <strong>{who}</strong>
          <span className="muted">{isAdmin ? "Admin" : "Talent"}</span>
          <div className="row">
            <a className="btn btn-ghost btn-sm" href="/akun">Ganti sandi</a>
            <form action={logout}><button className="btn btn-ghost btn-sm" type="submit">Keluar</button></form>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="mobile-top">
          <div className="brand"><span className="brand-name"><span className="brand-dot" aria-hidden />Live Hub</span></div>
        </div>
        {children}
      </main>

      <NavLinks items={isAdmin ? ADMIN_TABS : TALENT_TABS} className="tabbar" />
    </div>
  );
}
