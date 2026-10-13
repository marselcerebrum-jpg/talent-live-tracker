import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Tujuan link reset dari email: tukar kode jadi sesi, lalu arahkan ke halaman buat sandi baru.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const url = request.nextUrl.clone();
  url.search = "";
  if (!code) {
    url.pathname = "/lupa-sandi";
    url.searchParams.set("e", "link");
    return NextResponse.redirect(url);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    url.pathname = "/lupa-sandi";
    url.searchParams.set("e", "link");
    return NextResponse.redirect(url);
  }
  url.pathname = "/akun";
  url.searchParams.set("ok", "buat-sandi");
  return NextResponse.redirect(url);
}
