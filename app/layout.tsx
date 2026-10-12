import type { Metadata, Viewport } from "next";
import "@fontsource/bricolage-grotesque/800.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Talent Live Tracker",
  description: "Jadwal, absensi, izin, dan data live talent Cerebrum.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#efeaff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
