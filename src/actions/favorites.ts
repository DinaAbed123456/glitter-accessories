"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function toggleFavorite(input: unknown) {
  const parsed = z.string().uuid().safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "المنتج غير صالح." };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "سجلي الدخول لحفظ المفضلة." };
  const { data: existing } = await supabase.from("favorites").select("product_id").eq("user_id", user.id).eq("product_id", parsed.data).maybeSingle();
  const result = existing
    ? await supabase.from("favorites").delete().eq("user_id", user.id).eq("product_id", parsed.data)
    : await supabase.from("favorites").insert({ user_id: user.id, product_id: parsed.data });
  return result.error ? { ok: false as const, message: "تعذر تحديث المفضلة." } : { ok: true as const, saved: !existing, message: existing ? "أزيل من المفضلة." : "أضيف إلى المفضلة." };
}
