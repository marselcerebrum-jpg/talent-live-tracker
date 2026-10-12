"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

function isActive(path: string, href: string) {
  if (href === "/" || href === "/admin") return path === href;
  return path === href || path.startsWith(href + "/");
}

export function NavLinks({ items, className }: { items: NavItem[]; className?: string }) {
  const path = usePathname();
  return (
    <nav className={className}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={isActive(path, i.href) ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
