"use client";
// Lokasi di GitHub: components/NavProgress.tsx

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Penanda loading global:
 * - garis progres di atas layar saat pindah halaman atau mengirim form
 * - spinner + nonaktif di tombol yang ditekan (mencegah klik dobel)
 * Selesai otomatis saat alamat halaman berubah (navigasi / redirect setelah simpan).
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    setActive(false);
    document.querySelectorAll(".is-loading").forEach((el) => {
      el.classList.remove("is-loading");
      (el as HTMLButtonElement).disabled = false;
      el.removeAttribute("aria-busy");
    });
    if (timer.current) clearTimeout(timer.current);
  };
  const start = () => {
    setActive(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(stop, 20000); // pengaman bila tidak ada perubahan alamat
  };

  // alamat berubah = navigasi sudah jalan; selesai setelah kerangka (loading.tsx) hilang dan data tampil
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const done = () => !document.querySelector('[aria-label="Memuat halaman"]');
    if (done()) stop();
    else id = setInterval(() => { if (done()) { stop(); if (id) clearInterval(id); } }, 100);
    return () => { if (id) clearInterval(id); };
  }, [pathname, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    const onSubmit = (e: SubmitEvent) => {
      // tunggu penjaga form (mis. LiveGuard) memutuskan dulu; jangan tampilkan loading bila dibatalkan
      setTimeout(() => handleSubmit(e), 0);
    };
    const handleSubmit = (e: SubmitEvent) => {
      if ((e as SubmitEvent & { __lhBlocked?: boolean }).__lhBlocked) return;
      const form = e.target as HTMLFormElement;
      const btn = (e.submitter as HTMLButtonElement | null) ?? form.querySelector<HTMLButtonElement>("button[type=submit], button:not([type])");
      // form GET di halaman yang sama (filter) tetap dianggap navigasi
      start();
      if (btn) {
        btn.classList.add("is-loading");
        btn.setAttribute("aria-busy", "true");
        // nonaktifkan setelah form terkirim, supaya tidak terkirim dua kali
        btn.disabled = true;
      }
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return <div className={`nav-progress${active ? " on" : ""}`} role="progressbar" aria-hidden={!active} aria-label="Memuat" />;
}
