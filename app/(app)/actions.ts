"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/auth";
import { isYmd, keISO } from "@/lib/time";

function back(path: string, params: Record<string, string>): never {
  const q = new URLSearchParams(params).toString();
  redirect(`${path}${q ? `?${q}` : ""}`);
}

// ---------------------------------------------------------------- absen
export async function absen(formData: FormData) {
  const me = await getMe();
  const slotId = String(formData.get("slot_id") ?? "");
  if (!me.talentId) back("/", { e: "Akun ini tidak tertaut ke talent." });
  const supabase = await createClient();
  const { error } = await supabase.from("attendance_checkins").insert({ slot_id: slotId, talent_id: me.talentId });
  if (error) {
    const msg = error.code === "23505"
      ? "Kamu sudah absen untuk slot ini."
      : "Absen hanya bisa dilakukan mulai 60 menit sebelum slot dibuka sampai slot ditutup.";
    back("/", { e: msg });
  }
  revalidatePath("/");
  back("/", { ok: "absen" });
}

export async function selesaiLive(formData: FormData) {
  await getMe();
  const slotId = String(formData.get("slot_id") ?? "");
  const supabase = await createClient();
  // nilai checked_out_at dikunci ke jam server oleh trigger
  const { error } = await supabase.from("attendance_checkins")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("slot_id", slotId);
  if (error) back("/", { e: "Gagal mencatat selesai live. Coba lagi." });
  revalidatePath("/");
  back("/", { ok: "selesai" });
}

// ---------------------------------------------------------------- data live
function int(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(/[.\s]/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}
function text(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export async function simpanLive(formData: FormData) {
  const me = await getMe();
  const from = String(formData.get("from") ?? "/live");
  const isAdmin = me.role === "admin";
  const talentId = isAdmin ? text(formData.get("talent_id")) : me.talentId;
  const account = text(formData.get("account_code"));
  const platform = formData.get("platform") === "instagram" ? "instagram" : "tiktok";
  const date = String(formData.get("session_date") ?? "");
  const time = String(formData.get("start_time") ?? "");
  const duration = int(formData.get("duration_minutes"));

  const errs: string[] = [];
  if (!talentId) errs.push("pilih talent");
  if (!account) errs.push("pilih akun live");
  if (!isYmd(date)) errs.push("isi tanggal");
  if (!/^\d{2}:\d{2}$/.test(time)) errs.push("isi jam mulai");
  if (duration === null || duration < 1 || duration > 600) errs.push("isi durasi 1–600 menit");
  if (errs.length) back(`${from}/baru`, { e: `Data belum lengkap: ${errs.join(", ")}.` });

  const views = int(formData.get("total_views"));
  const unique = int(formData.get("unique_viewers"));
  const reasons: string[] = [];
  if (views !== null && unique !== null && views < unique) reasons.push(`total tayangan (${views}) < penonton unik (${unique})`);

  const supabase = await createClient();
  const { error } = await supabase.from("live_sessions").insert({
    account_code: account,
    platform,
    talent_id: talentId,
    talent_source: isAdmin ? "admin" : "input",
    session_date: date,
    started_at: keISO(date, time),
    duration_minutes: duration,
    total_views: views,
    unique_viewers: unique,
    active_viewers: int(formData.get("active_viewers")),
    avg_watch_seconds: int(formData.get("avg_watch_seconds")),
    peak_concurrent: int(formData.get("peak_concurrent")),
    avg_concurrent: int(formData.get("avg_concurrent")),
    ig_reach: int(formData.get("ig_reach")),
    ig_peak_concurrent: int(formData.get("ig_peak_concurrent")),
    ig_engaged: int(formData.get("ig_engaged")),
    topic: text(formData.get("topic")),
    notes: text(formData.get("notes")),
    evaluation: isAdmin ? text(formData.get("evaluation")) : null,
    review_status: reasons.length ? "needs_review" : "ok",
    review_reasons: reasons,
    source: "app",
    created_by: me.userId,
  });
  if (error) back(`${from}/baru`, { e: `Gagal menyimpan: ${error.message}` });
  revalidatePath(from);
  back(from, { ok: "live" });
}

// ---------------------------------------------------------------- izin
const LEAVE_TYPES = ["sakit", "izin", "cuti", "lainnya"] as const;

export async function ajukanIzin(formData: FormData) {
  const me = await getMe();
  if (!me.talentId) back("/izin", { e: "Akun ini tidak tertaut ke talent." });
  const type = String(formData.get("type") ?? "");
  const start = String(formData.get("start_date") ?? "");
  const end = String(formData.get("end_date") ?? "") || start;
  const reason = text(formData.get("reason"));
  if (!LEAVE_TYPES.includes(type as (typeof LEAVE_TYPES)[number]) || !isYmd(start) || !isYmd(end) || !reason) {
    back("/izin", { e: "Pilih jenis izin, isi tanggal, dan tulis alasannya." });
  }
  if (end < start) back("/izin", { e: "Tanggal selesai tidak boleh sebelum tanggal mulai." });
  const supabase = await createClient();
  const { error } = await supabase.from("leave_requests").insert({
    talent_id: me.talentId, type, start_date: start, end_date: end, reason,
    attachment_url: text(formData.get("attachment_url")),
  });
  if (error) back("/izin", { e: `Gagal mengirim: ${error.message}` });
  revalidatePath("/izin");
  back("/izin", { ok: "izin" });
}

export async function batalkanIzin(formData: FormData) {
  await getMe();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("leave_requests").update({ status: "cancelled" }).eq("id", id).eq("status", "pending");
  if (error) back("/izin", { e: "Pengajuan ini tidak bisa dibatalkan lagi." });
  revalidatePath("/izin");
  back("/izin", { ok: "batal" });
}

// ---------------------------------------------------------------- akun
export async function gantiSandi(formData: FormData) {
  await getMe();
  const a = String(formData.get("password") ?? "");
  const b = String(formData.get("password2") ?? "");
  if (a.length < 8) back("/akun", { e: "Kata sandi minimal 8 karakter." });
  if (a !== b) back("/akun", { e: "Kedua kata sandi tidak sama." });
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: a });
  if (error) back("/akun", { e: `Gagal: ${error.message}` });
  back("/akun", { ok: "sandi" });
}

// ---------------------------------------------------------------- absen di luar jadwal (dilaporkan talent)
export async function absenLuarJadwal(formData: FormData) {
  await getMe();
  const kind = String(formData.get("kind") ?? "");
  const slot = String(formData.get("slot_id") ?? "") || null;
  const account = String(formData.get("account_code") ?? "") || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const permitted = String(formData.get("permitted_by") ?? "").trim() || null;
  if (kind !== "tidak_sesuai" && !slot) back("/", { e: "Pilih slotnya dulu." });
  if (kind !== "tidak_sesuai" && !permitted) back("/", { e: "Pilih sudah izin ke siapa." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("absen_luar_jadwal", { p_kind: kind, p_slot_id: slot, p_account: account, p_note: note, p_permitted_by: permitted });
  if (error) back("/", { e: error.message });
  revalidatePath("/");
  back("/", { ok: "luar-jadwal" });
}
