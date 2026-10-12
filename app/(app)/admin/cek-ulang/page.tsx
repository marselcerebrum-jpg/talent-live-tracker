import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { jam, menitKeJam, tanggalPendek } from "@/lib/time";
import { Notice } from "@/components/Notice";
import { replayHapusSesi, replayPerbaiki, replaySesuai, replayTidakHadir } from "../actions";

type Sess = { id: string; talent: string | null; talent_id: string | null; start: string | null; dur: number | null; views: number | null; account: string; source_ref: string | null };
type Item = {
  item_key: string; kind: string; priority: number; item_date: string; account_code: string; slot_id: string | null;
  start_at: string | null; sessions: Sess[]; info: Record<string, string | number | null>;
};

const KIND: Record<string, { label: string; why: string; cls: string }> = {
  sesi_bertabrakan: { label: "Sesi bertabrakan", why: "Dua sesi di akun yang sama pada jam yang sama. Cek tayangan ulang: mana yang benar? Sesi dobel membuat gaji terhitung dua kali.", cls: "badge-alpha" },
  absen_tanpa_live: { label: "Absen tanpa data live", why: "Talent menekan Absen tapi tidak ada data live. Cek apakah benar ada live di jam itu.", cls: "badge-alpha" },
  diisi_talent_lain: { label: "Diisi talent lain", why: "Ada talent lain yang live di slot ini tanpa laporan tukar shift.", cls: "chg-tukar_shift" },
  live_di_jam_lain: { label: "Live di jam lain", why: "Talent tidak live di slotnya, tapi live di jam lain hari itu tanpa laporan.", cls: "chg-tidak_sesuai" },
  sesi_di_luar_jadwal: { label: "Sesi di luar jadwal", why: "Sesi ini tidak cocok dengan slot mana pun. Cek siapa yang live dan jam mulainya.", cls: "chg-pindah_jadwal" },
  live_pendek: { label: "Live kurang dari 1 jam", why: "Total live dalam slot ini di bawah 1 jam. Live terputus atau memang pendek?", cls: "badge-pending" },
  tanpa_jam_mulai: { label: "Tanpa jam mulai", why: "Jam mulai tidak diisi, jadi sesi tidak bisa dicocokkan ke jadwal. Isi dari tayangan ulang.", cls: "badge-pending" },
};
const PRIO: Record<number, string> = { 1: "Berdampak ke gaji & absensi", 2: "Kesesuaian jadwal", 3: "Kelengkapan data" };

function hhmm(iso: string | null) {
  return iso ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";
}

function SessionRow({ it, x, talents, allowDelete }: { it: Item; x: Sess; talents: { id: string; nickname: string }[]; allowDelete: boolean }) {
  return (
    <div className="li">
      <span className="av c2" aria-hidden>{(x.talent ?? "?")[0]}</span>
      <div>
        <div className="t">{x.talent ?? "Tanpa talent"} <span className="s">mulai {x.start ? jam(x.start) : "?"}, {x.dur ? menitKeJam(x.dur) : "durasi ?"}{x.views !== null ? `, ${new Intl.NumberFormat("id-ID").format(x.views)} tayangan` : ""}{x.source_ref ? `, sel ${x.source_ref}` : ""}</span></div>
        <details>
          <summary className="small">Perbaiki sesi ini</summary>
          <form action={replayPerbaiki} className="row" style={{ marginTop: 8 }}>
            <input type="hidden" name="session_id" value={x.id} /><input type="hidden" name="item_key" value={it.item_key} /><input type="hidden" name="kind" value={it.kind} />
            <input type="date" name="session_date" defaultValue={it.item_date} aria-label="Tanggal" style={{ width: "auto" }} />
            <input type="time" name="start_time" defaultValue={hhmm(x.start)} required aria-label="Jam mulai" style={{ width: "auto" }} />
            <input type="number" name="duration_minutes" defaultValue={x.dur ?? ""} min={1} max={600} required aria-label="Durasi menit" placeholder="menit" style={{ width: 90 }} />
            <select name="talent_id" defaultValue={x.talent_id ?? ""} aria-label="Talent" style={{ width: "auto" }}>
              {talents.map((t) => <option key={t.id} value={t.id}>{t.nickname}</option>)}
            </select>
            <button className="btn btn-sm" type="submit">Simpan</button>
          </form>
        </details>
      </div>
      {allowDelete && (
        <form action={replayHapusSesi}>
          <input type="hidden" name="session_id" value={x.id} /><input type="hidden" name="item_key" value={it.item_key} /><input type="hidden" name="kind" value={it.kind} />
          <button className="btn btn-bad btn-sm" type="submit">Hapus sesi ini</button>
        </form>
      )}
    </div>
  );
}

export default async function CekUlang({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string; p?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: accounts }, { data: talents }, { count: done }] = await Promise.all([
    supabase.from("v_replay_queue").select("*").order("priority").order("item_date", { ascending: false }),
    supabase.from("live_accounts").select("code, name"),
    supabase.from("talents").select("id, nickname").order("nickname"),
    supabase.from("replay_reviews").select("item_key", { count: "exact", head: true }),
  ]);
  const all = (data ?? []) as Item[];
  const items = sp.p ? all.filter((i) => String(i.priority) === sp.p) : all;
  const acc = (c: string) => (accounts ?? []).find((a) => a.code === c)?.name ?? c;
  const byPrio = [1, 2, 3].map((p) => ({ p, list: items.filter((i) => i.priority === p) })).filter((g) => g.list.length);

  return (
    <>
      <div className="page-head">
        <div><h1>Cek tayangan ulang</h1><p>Cocokkan dengan rekaman live di TikTok, lalu pilih tindakannya. Kasus yang sudah dicek hilang dari daftar.</p></div>
        <span className="sticker">{all.length} belum dicek</span>
      </div>
      <Notice ok={sp.ok} e={sp.e} />

      <div className="stats" style={{ marginBottom: 20 }}>
        {[1, 2, 3].map((p) => (
          <a key={p} className="stat" href={sp.p === String(p) ? "/admin/cek-ulang" : `/admin/cek-ulang?p=${p}`} style={{ textDecoration: "none", outline: sp.p === String(p) ? "3px solid var(--ink)" : undefined }}>
            <strong>{all.filter((i) => i.priority === p).length}</strong><span>{PRIO[p]}</span>
          </a>
        ))}
        <div className="stat"><strong>{done ?? 0}</strong><span>Sudah dicek</span></div>
      </div>

      {items.length === 0 && <div className="panel empty"><strong>Semua sudah dicek</strong>Tidak ada kasus yang perlu dicocokkan dengan tayangan ulang.</div>}

      {byPrio.map(({ p, list }) => (
        <section key={p} style={{ marginBottom: 24 }}>
          <div className="sect"><span>{PRIO[p]}</span><span className="small muted">{list.length} kasus</span></div>
          <div className="stack">
            {list.map((it) => {
              const k = KIND[it.kind] ?? { label: it.kind, why: "", cls: "" };
              const slotInfo = it.info?.slot_start ? `Slot ${it.info.talent} ${jam(String(it.info.slot_start))}–${jam(String(it.info.slot_end))}` : null;
              return (
                <article key={it.item_key} className="panel flush">
                  <div className="band" style={{ background: p === 1 ? "#ffd2cd" : p === 2 ? "var(--yellow)" : "#faf8ff" }}>
                    <div>
                      <h2 style={{ fontSize: "1.05rem" }}>{acc(it.account_code)}, {tanggalPendek(it.item_date)}{it.start_at ? `, ${jam(it.start_at)}` : ""}</h2>
                      <span className="small">{slotInfo}{it.info?.overlap_min ? `Tumpang tindih ${it.info.overlap_min} menit` : ""}{it.info?.live_minutes !== undefined && it.info?.live_minutes !== null ? `, live ${menitKeJam(Number(it.info.live_minutes))}` : ""}</span>
                    </div>
                    <span className={`badge ${k.cls}`}>{k.label}</span>
                  </div>
                  <p className="small" style={{ padding: "12px 20px 0" }}>{k.why}</p>
                  {it.sessions.length > 0 && (
                    <div className="list" style={{ marginTop: 6 }}>
                      {it.sessions.map((x) => <SessionRow key={x.id} it={it} x={x} talents={talents ?? []} allowDelete={it.kind === "sesi_bertabrakan"} />)}
                    </div>
                  )}
                  <div className="row" style={{ padding: "12px 20px 16px", borderTop: "2px dashed var(--line)" }}>
                    <form action={replaySesuai} className="row" style={{ flex: 1 }}>
                      <input type="hidden" name="item_key" value={it.item_key} /><input type="hidden" name="kind" value={it.kind} />
                      <input name="note" placeholder="Catatan hasil cek (opsional)" aria-label="Catatan" style={{ flex: 1, minWidth: 180 }} />
                      <button className="btn btn-ok btn-sm" type="submit">Sesuai, tidak ada masalah</button>
                    </form>
                    {it.slot_id && (it.kind === "absen_tanpa_live" || it.kind === "live_di_jam_lain") && (
                      <form action={replayTidakHadir}>
                        <input type="hidden" name="slot_id" value={it.slot_id} /><input type="hidden" name="item_key" value={it.item_key} /><input type="hidden" name="kind" value={it.kind} />
                        <button className="btn btn-bad btn-sm" type="submit">Tidak live, jadikan tidak hadir</button>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
