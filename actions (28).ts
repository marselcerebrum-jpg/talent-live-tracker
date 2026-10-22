"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VIEW_AS_COOKIE } from "@/lib/auth";

/** Keluar dari mode akun bayangan (cukup hapus cookie; aman untuk siapa pun). */
export async function selesaiLihatSebagai() {
  (await cookies()).delete(VIEW_AS_COOKIE);
  redirect("/admin");
}
