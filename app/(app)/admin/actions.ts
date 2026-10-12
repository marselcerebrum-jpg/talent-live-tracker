"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { addDays, isYmd, keISO } from "@/lib/time";
import { toLoginEmail, validUsername } from "@/lib/username";

function back(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params)}`);
}
const s = (v: FormDataEntryValue | null) => String(v ?? "").trim();

// ---------------------------------------------------------------- jadwal
export async function tambahSlot(formData: FormData) {
  const me = await requireAdmin();
  const account = s(formData.get("account_code"));
  const talent = s(formData.get("talent_id"));
  const from = s(formData.get("date_from"));
  const until = s(formData.get("date_until")) || from;
  const t1 = s(formData.get("start_time"));
  const t2 = s(formData.get("end_time"));
  const days = formData.getAll("dow").map(Number); // 0=Senin..6=Minggu
  const isEvent = formData.get("is_event") === "on";
  const w = s(formData.get("w"));

  if (!account || !talent || !isYmd(from) || !isYmd(until) || !/^\d{2}:\d{2}$/.test(t1) || !/^\d{2}:\d{2}$/.test(t2)) {
    back("/admin/jadwal", { w, e: "Lengkapi akun, talent, tanggal, jam mulai, dan jam selesai." });
  }
  if (until < from) back("/admin/jadwal", { w, e: "Tanggal akhir tidak boleh sebelum tanggal mulai." });

  const rows: Record<string, unknown>[] = [];
  for (let d = from, i = 0; d <= until && i < 120; d = addDays(d, 1), i++) {
    const dow = (new Date(`${d}T12:00:00+07:00`).getUTCDay() + 6) % 7;
    if (from !== until && days.length && !days.includes(dow)) continue;
    const start = keISO(d, t1);
    const endDay = t2 <= t1 ? addDays(d, 1) : d; // lewat tengah malam, mis. 22:00–00:00
    rows.push({
      account_code: account, talent_id: talent, start_at: start, end_at: keISO(endDay, t2),
      is_event: isEvent, note: s(formData.get("note")) || null, source: "app", created_by: me.userId,
    });
  }
  if (!rows.length) back("/admin/jadwal", { w, e: "Tidak ada tanggal yang cocok dengan hari yang dipilih." });

  const supabase = await createClient();
  const { error } = await supabase.from("schedule_slots").upsert(rows, { onConflict: "account_code,start_at,talent_id", ignoreDuplicates: true });
  if (error) back("/admin/jadwal", { w, e: `Gagal menyimpan: ${error.message}` });
  revalidatePath("/admin/jadwal");
  back("/admin/jadwal", { w: w || from, ok: "slot" });
}

export async function batalkanSlot(formData: FormData) {
  await requireAdmin();
  const id = s(formData.get("id"));
  const w = s(formData.get("w"));
  const supabase = await createClient();
  const { error } = await supabase.from("schedule_slots").update({ status: "cancelled" }).eq("id", id);
  if (error) back("/admin/jadwal", { w, e: error.message });
  revalidatePath("/admin/jadwal");
  back("/admin/jadwal", { w, ok: "hapus" });
}

// ---------------------------------------------------------------- izin
export async function putuskanIzin(formData: FormData) {
  const me = await requireAdmin();
  const id = s(formData.get("id"));
  const decision = formData.get("decision") === "approved" ? "approved" : "rejected";
  const supabase = await createClient();
  const { error } = await supabase.from("leave_requests").update({
    status: decision, reviewed_by: me.userId, reviewed_at: new Date().toISOString(),
    review_note: s(formData.get("review_note")) || null,
  }).eq("id", id).eq("status", "pending");
  if (error) back("/admin/izin", { e: error.message });
  revalidatePath("/admin/izin");
  back("/admin/izin", { ok: decision === "approved" ? "setuju" : "tolak" });
}

// ---------------------------------------------------------------- absensi
export async function koreksiAbsensi(formData: FormData) {
  const me = await requireAdmin();
  const slot = s(formData.get("slot_id"));
  const state = s(formData.get("state"));
  const note = s(formData.get("note"));
  const ret = s(formData.get("ret")) || "/admin/absensi";
  const supabase = await createClient();
  if (state === "otomatis") {
    await supabase.from("attendance_overrides").delete().eq("slot_id", slot);
  } else {
    if (!["hadir", "izin", "alpha"].includes(state) || !note) redirect(`${ret}${ret.includes("?") ? "&" : "?"}e=${encodeURIComponent("Pilih status dan tulis alasan koreksi.")}`);
    const { error } = await supabase.from("attendance_overrides").upsert({ slot_id: slot, state, note, created_by: me.userId });
    if (error) redirect(`${ret}${ret.includes("?") ? "&" : "?"}e=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/admin/absensi");
  redirect(`${ret}${ret.includes("?") ? "&" : "?"}ok=koreksi`);
}

// ---------------------------------------------------------------- talent & akun
export async function simpanTalent(formData: FormData) {
  await requireAdmin();
  const id = s(formData.get("id"));
  const full = s(formData.get("full_name"));
  const nick = s(formData.get("nickname"));
  if (!full || !nick) back("/admin/talent", { e: "Isi nama lengkap dan nama panggilan." });
  const row = { full_name: full, nickname: nick, whatsapp: s(formData.get("whatsapp")) || null, is_active: formData.get("is_active") !== "off" };
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("talents").update(row).eq("id", id);
    if (error) back("/admin/talent", { e: error.message });
  } else {
    const { data, error } = await supabase.from("talents").insert(row).select("id").single();
    if (error || !data) back("/admin/talent", { e: error?.message ?? "Gagal menambah talent." });
    await supabase.from("talent_aliases").upsert({ alias: nick.toLowerCase(), talent_id: data.id }, { onConflict: "alias", ignoreDuplicates: true });
  }
  revalidatePath("/admin/talent");
  back("/admin/talent", { ok: "talent" });
}

export async function aturAktif(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("talents").update({ is_active: formData.get("active") === "1" }).eq("id", s(formData.get("id")));
  revalidatePath("/admin/talent");
  back("/admin/talent", { ok: "talent" });
}

export async function buatAkun(formData: FormData) {
  await requireAdmin();
  const talentId = s(formData.get("talent_id"));
  const username = s(formData.get("username")).toLowerCase();
  const password = s(formData.get("password"));
  if (!talentId || !validUsername(username) || password.length < 8) {
    back("/admin/talent", { e: "Pilih talent, isi username 3–30 karakter (huruf kecil, angka, titik, strip), dan kata sandi minimal 8 karakter." });
  }
  const email = toLoginEmail(username);

  const admin = createServiceClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) back("/admin/talent", { e: /already|registered|exists/i.test(error?.message ?? "") ? `Username "${username}" sudah dipakai. Pilih yang lain.` : `Gagal membuat akun: ${error?.message ?? "tidak diketahui"}` });
  const { error: pErr } = await admin.from("profiles").insert({ id: data.user.id, role: "talent", talent_id: talentId });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    back("/admin/talent", { e: pErr.code === "23505" ? "Talent ini sudah punya akun." : pErr.message });
  }
  await admin.from("talents").update({ email }).eq("id", talentId);
  revalidatePath("/admin/talent");
  back("/admin/talent", { ok: "akun" });
}

export async function resetSandi(formData: FormData) {
  await requireAdmin();
  const userId = s(formData.get("user_id"));
  const password = s(formData.get("password"));
  if (password.length < 8) back("/admin/talent", { e: "Kata sandi minimal 8 karakter." });
  const admin = createServiceClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) back("/admin/talent", { e: error.message });
  back("/admin/talent", { ok: "sandi" });
}

// ---------------------------------------------------------------- perlu dicek
export async function tandaiIssue(formData: FormData) {
  const me = await requireAdmin();
  const supabase = await createClient();
  await supabase.from("import_issues").update({
    resolved: true, resolved_by: me.userId, resolved_at: new Date().toISOString(),
    resolution_note: s(formData.get("note")) || "Ditandai sudah dicek",
  }).eq("id", Number(formData.get("id")));
  revalidatePath("/admin/perlu-dicek");
  back("/admin/perlu-dicek", { ok: "beres" });
}

export async function perbaikiSesi(formData: FormData) {
  const me = await requireAdmin();
  const id = s(formData.get("id"));
  const date = s(formData.get("session_date"));
  const time = s(formData.get("start_time"));
  const dur = Number(s(formData.get("duration_minutes")));
  if (!isYmd(date) || !(dur > 0 && dur <= 600)) back("/admin/perlu-dicek", { e: "Isi tanggal dan durasi 1–600 menit." });
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    session_date: date, duration_minutes: dur, review_status: "ok", review_reasons: [],
    started_at: /^\d{2}:\d{2}$/.test(time) ? keISO(date, time) : null,
    schedule_slot_id: null, // dicocokkan ulang oleh trigger
  };
  const unique = s(formData.get("unique_viewers"));
  if (unique) patch.unique_viewers = Number(unique);
  const { error } = await supabase.from("live_sessions").update(patch).eq("id", id);
  if (error) back("/admin/perlu-dicek", { e: error.message });
  const { data: sess } = await supabase.from("live_sessions").select("source_ref").eq("id", id).maybeSingle();
  if (sess?.source_ref) {
    await supabase.from("import_issues").update({
      resolved: true, resolved_by: me.userId, resolved_at: new Date().toISOString(), resolution_note: "Data sesi diperbaiki admin",
    }).eq("ref", sess.source_ref).eq("sheet", "Data Live");
  }
  revalidatePath("/admin/perlu-dicek");
  back("/admin/perlu-dicek", { ok: "beres" });
}

// ---------------------------------------------------------------- kode promo
export async function simpanKode(formData: FormData) {
  await requireAdmin();
  const code = s(formData.get("code")).toUpperCase().replace(/\s+/g, "");
  const talent = s(formData.get("talent_id"));
  const account = s(formData.get("account_code"));
  const from = s(formData.get("valid_from")) || null;
  const to = s(formData.get("valid_to")) || null;
  if (!code || !talent || !account) back("/admin/promo", { e: "Isi kode, talent, dan akun." });
  const supabase = await createClient();
  const { data: acc } = await supabase.from("live_accounts").select("centil_source_id").eq("code", account).maybeSingle();
  if (!acc) back("/admin/promo", { e: "Akun tidak dikenal." });
  const { error } = await supabase.from("promo_codes").upsert({
    code, talent_id: talent, account_code: account, centil_source_id: acc.centil_source_id,
    valid_from: from, valid_to: to, is_active: true,
  }, { onConflict: "code" });
  if (error) back("/admin/promo", { e: error.message });
  revalidatePath("/admin/promo");
  back("/admin/promo", { ok: "kode" });
}

export async function aturKode(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("promo_codes").update({ is_active: formData.get("active") === "1" }).eq("code", s(formData.get("code")));
  revalidatePath("/admin/promo");
  back("/admin/promo", { ok: "kode" });
}

export async function aturFitur(formData: FormData) {
  await requireAdmin();
  const key = s(formData.get("key"));
  if (key !== "feature_promo") back("/admin", { e: "Fitur tidak dikenal." });
  const on = formData.get("on") === "1";
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").update({ value: on }).eq("key", key);
  if (error) back("/admin/promo", { e: error.message });
  revalidatePath("/", "layout");
  back("/admin/promo", { ok: on ? "fitur-on" : "fitur-off" });
}

// ---------------------------------------------------------------- sinkronisasi kode promo (antrean untuk Claude)
export async function mintaSinkron(formData: FormData) {
  await requireAdmin();
  const keep = { from: s(formData.get("from")), to: s(formData.get("to")) };
  const start = s(formData.get("sync_from"));
  const end = s(formData.get("sync_to"));
  if (!isYmd(start) || !isYmd(end) || end < start) back("/admin/promo", { ...keep, e: "Rentang tanggal sinkronisasi tidak valid." });
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
  if (days > 62) back("/admin/promo", { ...keep, e: "Maksimal 62 hari per permintaan." });
  const supabase = await createClient();
  const { error } = await supabase.from("sync_requests").insert({ kind: "centil_promo", range_start: start, range_end: end });
  if (error) {
    back("/admin/promo", { ...keep, e: error.code === "23505" ? "Masih ada permintaan yang belum diproses. Tunggu sampai selesai." : error.message });
  }
  revalidatePath("/admin/promo");
  back("/admin/promo", { ...keep, ok: "minta-sync" });
}

export async function batalSinkron(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("sync_requests").update({ status: "failed", finished_at: new Date().toISOString(), note: "Dibatalkan admin" })
    .eq("id", Number(formData.get("id"))).eq("status", "pending");
  revalidatePath("/admin/promo");
  back("/admin/promo", { ok: "batal-sync" });
}
