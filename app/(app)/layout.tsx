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
  { href: "/absensi", label: "Absensi" },
  { href: "/izin", label: "Izin" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/jadwal", label: "Kelola jadwal" },
  { href: "/admin/izin", label: "Persetujuan izin" },
  { href: "/admin/absensi", label: "Absensi tim" },
  { href: "/admin/live", label: "Data live tim" },
  { href: "/admin/performa", label: "Performa live" },
  { href: "/admin/promo", label: "Kode promo" },
  { href: "/admin/talent", label: "Talent & akun" },
  { href: "/admin/perlu-dicek", label: "Perlu dicek" },
];

const ADMIN_TABS: NavItem[] = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/jadwal", label: "Jadwal" },
  { href: "/admin/izin", label: "Izin" },
  { href: "/admin/absensi", label: "Absensi" },
  { href: "/admin/talent", label: "Talent" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const isAdmin = me.role === "admin";
  const promoOn = await featureOn("feature_promo");
  const adminNav = ADMIN_NAV.filter((i) => promoOn || i.href !== "/admin/promo");
  const who = me.nickname ?? displayLogin(me.email);

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="brand-dot" aria-hidden /> Talent Live</div>
        {isAdmin ? (
          <>
            <NavLinks items={adminNav} className="nav" />
            <div className="nav-group">Tampilan jadwal</div>
            <NavLinks items={[{ href: "/jadwal", label: "Kalender tim" }]} className="nav" />
          </>
        ) : (
          <NavLinks items={TALENT_NAV} className="nav" />
        )}
        <div className="side-foot">
          <div>{who}</div>
          <div>{isAdmin ? "Admin" : "Talent"}. <a href="/akun">Ganti sandi</a></div>
          <form action={logout}><button type="submit">Keluar</button></form>
        </div>
      </aside>

      <main className="main">
        <div className="mobile-top">
          <div className="brand"><span className="brand-dot" aria-hidden /> Talent Live</div>
          <form action={logout}><button type="submit">Keluar</button></form>
        </div>
        {children}
      </main>

      <NavLinks items={isAdmin ? ADMIN_TABS : TALENT_NAV} className="tabbar" />
    </div>
  );
}
