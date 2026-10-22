import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Dipakai bila user login tapi tidak punya profil: keluarkan, lalu tampilkan pesan di halaman login.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "?e=tanpa-profil";
  return NextResponse.redirect(url);
}
