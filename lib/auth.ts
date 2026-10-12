import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Me = {
  userId: string;
  email: string | null;
  role: "admin" | "talent";
  talentId: string | null;
  nickname: string | null;
};

export async function getMe(): Promise<Me> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, talent_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/auth/keluar");
  let nickname: string | null = null;
  if (profile.talent_id) {
    const { data: t } = await supabase.from("talents").select("nickname").eq("id", profile.talent_id).maybeSingle();
    nickname = t?.nickname ?? null;
  }
  return { userId: user.id, email: user.email ?? null, role: profile.role, talentId: profile.talent_id, nickname };
}

export async function requireAdmin(): Promise<Me> {
  const me = await getMe();
  if (me.role !== "admin") redirect("/");
  return me;
}
