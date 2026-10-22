import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type Me = {
  userId: string;
  email: string | null;
  role: "admin" | "talent";
  talentId: string | null;
  nickname: string | null;
  /** true bila admin sedang memakai mode akun bayangan (lihat sebagai talent, hanya baca) */
  impersonating?: boolean;
};

export const VIEW_AS_COOKIE = "lh_view_as";

export const getMe = cache(async function getMe(): Promise<Me> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // profil + nama talent dalam satu query (relasi profiles.talent_id -> talents)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, talent_id, talents(nickname)")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/auth/keluar");
  const t = profile.talents as unknown as { nickname: string } | { nickname: string }[] | null;
  const nickname = (Array.isArray(t) ? t[0]?.nickname : t?.nickname) ?? null;
  const me: Me = { userId: user.id, email: user.email ?? null, role: profile.role, talentId: profile.talent_id, nickname };
  if (me.role === "admin") {
    const viewAs = (await cookies()).get(VIEW_AS_COOKIE)?.value;
    if (viewAs && /^[0-9a-f-]{36}$/i.test(viewAs)) {
      const { data: tv } = await supabase.from("talents").select("id, nickname").eq("id", viewAs).maybeSingle();
      if (tv) return { ...me, role: "talent", talentId: tv.id, nickname: tv.nickname, impersonating: true };
    }
  }
  return me;
});

export async function requireAdmin(): Promise<Me> {
  const me = await getMe();
  if (me.role !== "admin") redirect("/");
  return me;
}
