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

// ---------------------------------------------------------------- kesesuaian jadwal
function withMsg(ret: string, key: "ok" | "e", v: string): never {
  redirect(`${ret}${ret.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(v)}`);
}

/** Kosongkan tautan sesi live pada tanggal tsb supaya trigger mencocokkan ulang ke slot yang benar. */
async function relink(supabase: Awaited<ReturnType<typeof createClient>>, talentIds: string[], dates: string[]) {
  await supabase.from("live_sessions").update({ schedule_slot_id: null })
    .in("talent_id", talentIds).in("session_date", dates);
}

export async function catatPerubahan(formData: FormData) {
  const me = await requireAdmin();
  const ret = s(formData.get("ret")) || "/admin/absensi";
  const slotId = s(formData.get("slot_id"));
  const kind = s(formData.get("kind"));
  const note = s(formData.get("note")) || null;
  const unauthorized = formData.get("unauthorized") === "on";
  const supabase = await createClient();

  const { data: slot } = await supabase.from("schedule_slots")
    .select("id, talent_id, account_code, start_at, end_at, slot_date").eq("id", slotId).maybeSingle();
  if (!slot) withMsg(ret, "e", "Slot tidak ditemukan.");
  const { data: existing } = await supabase.from("schedule_changes").select("id").eq("slot_id", slotId).maybeSingle();
  if (existing) withMsg(ret, "e", "Slot ini sudah punya catatan perubahan. Hapus catatan lama dulu.");

  const base = {
    slot_id: slotId, kind, original_talent_id: slot.talent_id, original_start_at: slot.start_at,
    original_end_at: slot.end_at, note, created_by: me.userId,
  };

  if (kind === "tidak_sesuai") {
    const t1 = s(formData.get("actual_start"));
    const t2 = s(formData.get("actual_end"));
    const status = s(formData.get("status"));
    const { error } = await supabase.from("schedule_changes").insert({
      ...base, unauthorized: true,
      actual_start_at: /^\d{2}:\d{2}$/.test(t1) ? keISO(slot.slot_date, t1) : null,
      actual_end_at: /^\d{2}:\d{2}$/.test(t2) ? keISO(slot.slot_date, t2) : null,
    });
    if (error) withMsg(ret, "e", error.message);
    if (status === "hadir" || status === "alpha") {
      await supabase.from("attendance_overrides").upsert({
        slot_id: slotId, state: status, created_by: me.userId,
        note: `Tidak sesuai jadwal${t1 ? `, masuk ${t1}${t2 ? `–${t2}` : ""}` : ""}${note ? `: ${note}` : ""}`,
      });
    }
  } else if (kind === "tukar_shift") {
    const newTalent = s(formData.get("new_talent_id"));
    if (!newTalent || newTalent === slot.talent_id) withMsg(ret, "e", "Pilih talent pengganti yang berbeda.");
    const { error: e1 } = await supabase.from("schedule_slots").update({ talent_id: newTalent }).eq("id", slotId);
    if (e1) withMsg(ret, "e", e1.code === "23505" ? "Talent pengganti sudah punya slot yang sama persis." : e1.message);
    const { error } = await supabase.from("schedule_changes").insert({ ...base, unauthorized, new_talent_id: newTalent });
    if (error) {
      await supabase.from("schedule_slots").update({ talent_id: slot.talent_id }).eq("id", slotId);
      withMsg(ret, "e", error.message);
    }
    await supabase.from("attendance_overrides").delete().eq("slot_id", slotId);
    await relink(supabase, [slot.talent_id, newTalent], [slot.slot_date]);
  } else if (kind === "pindah_jadwal") {
    const d = s(formData.get("new_date")) || slot.slot_date;
    const t1 = s(formData.get("new_start"));
    const t2 = s(formData.get("new_end"));
    if (!isYmd(d) || !/^\d{2}:\d{2}$/.test(t1) || !/^\d{2}:\d{2}$/.test(t2)) withMsg(ret, "e", "Isi tanggal, jam mulai, dan jam selesai yang baru.");
    const start = keISO(d, t1);
    const end = keISO(t2 <= t1 ? addDays(d, 1) : d, t2);
    const { error: e1 } = await supabase.from("schedule_slots").update({ start_at: start, end_at: end }).eq("id", slotId);
    if (e1) withMsg(ret, "e", e1.code === "23505" ? "Sudah ada slot yang sama di waktu baru tersebut." : e1.message);
    const { error } = await supabase.from("schedule_changes").insert({ ...base, unauthorized, new_start_at: start, new_end_at: end });
    if (error) {
      await supabase.from("schedule_slots").update({ start_at: slot.start_at, end_at: slot.end_at }).eq("id", slotId);
      withMsg(ret, "e", error.message);
    }
    await supabase.from("attendance_overrides").delete().eq("slot_id", slotId);
    await relink(supabase, [slot.talent_id], [...new Set([slot.slot_date, d])]);
  } else {
    withMsg(ret, "e", "Jenis perubahan tidak dikenal.");
  }
  revalidatePath("/admin/absensi");
  withMsg(ret, "ok", "perubahan");
}

/** Hapus catatan & kembalikan slot ke jadwal semula. */
export async function hapusPerubahan(formData: FormData) {
  await requireAdmin();
  const ret = s(formData.get("ret")) || "/admin/absensi";
  const slotId = s(formData.get("slot_id"));
  const supabase = await createClient();
  const { data: c } = await supabase.from("schedule_changes").select("*").eq("slot_id", slotId).maybeSingle();
  if (!c) withMsg(ret, "e", "Catatan tidak ditemukan.");
  const { data: slot } = await supabase.from("schedule_slots").select("slot_date, talent_id").eq("id", slotId).maybeSingle();
  if (c.kind === "tukar_shift" || c.kind === "pindah_jadwal") {
    const { error } = await supabase.from("schedule_slots").update({
      talent_id: c.original_talent_id, start_at: c.original_start_at, end_at: c.original_end_at,
    }).eq("id", slotId);
    if (error) withMsg(ret, "e", error.message);
  }
  if (c.kind === "tidak_sesuai") await supabase.from("attendance_overrides").delete().eq("slot_id", slotId);
  await supabase.from("schedule_changes").delete().eq("slot_id", slotId);
  const origDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(c.original_start_at));
  await relink(supabase, [c.original_talent_id, c.new_talent_id, slot?.talent_id].filter(Boolean) as string[],
    [...new Set([origDate, slot?.slot_date].filter(Boolean) as string[])]);
  revalidatePath("/admin/absensi");
  withMsg(ret, "ok", "hapus-perubahan");
}

// ---------------------------------------------------------------- cek tayangan ulang
const RQ = "/admin/cek-ulang";
async function markReviewed(supabase: Awaited<ReturnType<typeof createClient>>, key: string, kind: string, result: string, note: string | null) {
  await supabase.from("replay_reviews").upsert({ item_key: key, kind, result, note });
}

export async function replaySesuai(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await markReviewed(supabase, s(formData.get("item_key")), s(formData.get("kind")), "sesuai", s(formData.get("note")) || null);
  revalidatePath(RQ);
  back(RQ, { ok: "replay-sesuai" });
}

export async function replayHapusSesi(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = s(formData.get("session_id"));
  const { error } = await supabase.from("live_sessions").delete().eq("id", id);
  if (error) back(RQ, { e: error.message });
  await markReviewed(supabase, s(formData.get("item_key")), s(formData.get("kind")), "dihapus", s(formData.get("note")) || "Sesi dobel dihapus setelah cek tayangan ulang");
  revalidatePath(RQ);
  back(RQ, { ok: "replay-hapus" });
}

export async function replayPerbaiki(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = s(formData.get("session_id"));
  const date = s(formData.get("session_date"));
  const time = s(formData.get("start_time"));
  const dur = Number(s(formData.get("duration_minutes")));
  if (!isYmd(date) || !/^\d{2}:\d{2}$/.test(time) || !(dur > 0 && dur <= 600)) back(RQ, { e: "Isi tanggal, jam mulai, dan durasi 1–600 menit." });
  const patch: Record<string, unknown> = {
    session_date: date, started_at: keISO(date, time), duration_minutes: dur,
    review_status: "ok", review_reasons: [], schedule_slot_id: null, // dicocokkan ulang oleh trigger
  };
  const talent = s(formData.get("talent_id"));
  if (talent) { patch.talent_id = talent; patch.talent_source = "admin"; }
  const { error } = await supabase.from("live_sessions").update(patch).eq("id", id);
  if (error) back(RQ, { e: error.message });
  await markReviewed(supabase, s(formData.get("item_key")), s(formData.get("kind")), "diperbaiki", s(formData.get("note")) || null);
  revalidatePath(RQ);
  back(RQ, { ok: "replay-perbaiki" });
}

export async function replayTidakHadir(formData: FormData) {
  const me = await requireAdmin();
  const supabase = await createClient();
  const slot = s(formData.get("slot_id"));
  await supabase.from("attendance_overrides").upsert({
    slot_id: slot, state: "alpha", created_by: me.userId,
    note: s(formData.get("note")) || "Tidak ditemukan di tayangan ulang",
  });
  await markReviewed(supabase, s(formData.get("item_key")), s(formData.get("kind")), "tidak_hadir", s(formData.get("note")) || null);
  revalidatePath(RQ);
  back(RQ, { ok: "replay-alpha" });
}

// ---------------------------------------------------------------- kelola admin
export async function tambahAdmin(formData: FormData) {
  await requireAdmin();
  const email = s(formData.get("email")).toLowerCase();
  const password = s(formData.get("password"));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back("/admin/admin", { e: "Email tidak valid." });
  if (email.endsWith("@live.cerebrum.id")) back("/admin/admin", { e: "Pakai email asli untuk admin, bukan format username talent." });
  if (password.length < 8) back("/admin/admin", { e: "Kata sandi minimal 8 karakter." });
  const admin = createServiceClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) {
    back("/admin/admin", { e: /already|registered|exists/i.test(error?.message ?? "") ? "Email ini sudah terdaftar." : `Gagal: ${error?.message ?? "tidak diketahui"}` });
  }
  const { error: pErr } = await admin.from("profiles").insert({ id: data.user.id, role: "admin" });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    back("/admin/admin", { e: pErr.message });
  }
  revalidatePath("/admin/admin");
  back("/admin/admin", { ok: "admin-baru" });
}

export async function resetSandiAdmin(formData: FormData) {
  const me = await requireAdmin();
  const userId = s(formData.get("user_id"));
  const password = s(formData.get("password"));
  if (userId === me.userId) back("/admin/admin", { e: "Untuk akun sendiri, pakai menu Ganti sandi." });
  if (password.length < 8) back("/admin/admin", { e: "Kata sandi minimal 8 karakter." });
  const admin = createServiceClient();
  const { data: prof } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (prof?.role !== "admin") back("/admin/admin", { e: "Akun ini bukan admin." });
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) back("/admin/admin", { e: error.message });
  back("/admin/admin", { ok: "sandi" });
}

// ---------------------------------------------------------------- permintaan reset sandi
export async function selesaikanReset(formData: FormData) {
  const me = await requireAdmin();
  const id = Number(formData.get("id"));
  const password = s(formData.get("password"));
  const ret = s(formData.get("ret")) || "/admin";
  if (password.length < 8) back(ret, { e: "Kata sandi minimal 8 karakter." });
  const admin = createServiceClient();
  const { data: req } = await admin.from("password_reset_requests").select("user_id, status").eq("id", id).maybeSingle();
  if (!req || req.status !== "pending") back(ret, { e: "Permintaan tidak ditemukan atau sudah diproses." });
  if (req.user_id === me.userId) back(ret, { e: "Untuk akun sendiri, pakai menu Ganti sandi." });
  const { error } = await admin.auth.admin.updateUserById(req.user_id, { password });
  if (error) back(ret, { e: error.message });
  await admin.from("password_reset_requests").update({ status: "done", handled_by: me.userId, handled_at: new Date().toISOString() }).eq("id", id);
  revalidatePath(ret);
  back(ret, { ok: "reset-selesai" });
}

export async function abaikanReset(formData: FormData) {
  const me = await requireAdmin();
  const supabase = await createClient();
  const ret = s(formData.get("ret")) || "/admin";
  await supabase.from("password_reset_requests").update({ status: "dismissed", handled_by: me.userId, handled_at: new Date().toISOString() })
    .eq("id", Number(formData.get("id")));
  revalidatePath(ret);
  back(ret, { ok: "reset-abaikan" });
}

// ---------------------------------------------------------------- ruangan live
export async function tambahRuangan(formData: FormData) {
  await requireAdmin();
  const name = s(formData.get("name"));
  if (!name) back("/admin/ruangan", { e: "Isi nama ruangan." });
  const supabase = await createClient();
  const { error } = await supabase.from("rooms").insert({ name, notes: s(formData.get("notes")) || null });
  if (error) back("/admin/ruangan", { e: error.code === "23505" ? "Nama ruangan sudah ada." : error.message });
  revalidatePath("/admin/ruangan");
  back("/admin/ruangan", { ok: "ruangan" });
}

export async function aturRuanganAkun(formData: FormData) {
  await requireAdmin();
  const code = s(formData.get("account_code"));
  const room = s(formData.get("room_id")) || null;
  const supabase = await createClient();
  const { error } = await supabase.from("live_accounts")
    .update({ room_id: room, device_note: s(formData.get("device_note")) || null }).eq("code", code);
  if (error) back("/admin/ruangan", { e: error.message });
  revalidatePath("/admin/ruangan");
  back("/admin/ruangan", { ok: "ruangan" });
}

export async function aturAktifRuangan(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("rooms").update({ is_active: formData.get("active") === "1" }).eq("id", s(formData.get("id")));
  revalidatePath("/admin/ruangan");
  back("/admin/ruangan", { ok: "ruangan" });
}
