import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Saklar fitur di tabel app_settings. Default mati kalau belum ada. */
export const featureOn = cache(async function featureOn(key: "feature_promo"): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value === true;
});
