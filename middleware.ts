import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function configError(missing: string[]) {
  const html = `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Konfigurasi belum lengkap</title>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 20px;color:#17202b">
<h1 style="font-size:1.4rem">Konfigurasi aplikasi belum lengkap</h1>
<p>Environment variable berikut belum terbaca oleh deployment ini:</p>
<ul>${missing.map((m) => `<li><code>${m}</code></li>`).join("")}</ul>
<p>Isi di Vercel, Settings, Environment Variables (centang Production), lalu Redeploy.</p>
</body></html>`;
  return new NextResponse(html, { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !key && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean) as string[];
  if (missing.length) return configError(missing);

  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  if (path.startsWith("/auth/")) return response;

  let user = null;
  try {
    const supabase = createServerClient(url!, key!, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    // Supabase tidak bisa dihubungi atau kunci salah: perlakukan sebagai belum login
    console.error("middleware supabase error:", err);
  }

  const isLogin = path.startsWith("/login");
  if (!user && !isLogin) {
    const u = request.nextUrl.clone();
    u.pathname = "/login";
    u.search = "";
    return NextResponse.redirect(u);
  }
  if (user && isLogin) {
    const u = request.nextUrl.clone();
    u.pathname = "/";
    u.search = "";
    return NextResponse.redirect(u);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
