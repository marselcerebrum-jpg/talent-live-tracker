import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Tujuan link reset dari email.
 * - token_hash (disarankan): diteruskan ke /reset-sandi. Token BARU dipakai saat form dikirim,
 *   jadi aman dibuka di browser/HP mana pun dan tidak "terpakai" oleh pemindai link email.
 * - code (PKCE, cara lama): hanya berhasil di browser yang sama dengan saat meminta reset.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const url = request.nextUrl.clone();
  url.search = "";

  const tokenHash = sp.get("token_hash");
  if (tokenHash) {
    url.pathname = "/reset-sandi";
    url.searchParams.set("token_hash", tokenHash);
    return NextResponse.redirect(url);
  }

  const code = sp.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      url.pathname = "/akun";
      url.searchParams.set("ok", "buat-sandi");
      return NextResponse.redirect(url);
    }
  }
  url.pathname = "/lupa-sandi";
  url.searchParams.set("e", "link");
  return NextResponse.redirect(url);
}
