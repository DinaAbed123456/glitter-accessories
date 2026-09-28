"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendStoreEmail } from "@/lib/email";

const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(40),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  address: z.string().trim().min(5).max(500),
  zoneId: z.string().uuid(),
  coupon: z.string().trim().max(64).optional(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(20) })).min(1).max(30),
});

export async function placeOrder(input: unknown) {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "يرجى مراجعة بيانات الطلب." };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("checkout_order", {
      p_guest_name: parsed.data.name,
      p_guest_phone: parsed.data.phone,
      p_guest_email: parsed.data.email || null,
      p_delivery_address: parsed.data.address,
      p_delivery_zone_id: parsed.data.zoneId,
      p_coupon_code: parsed.data.coupon || null,
      p_items: parsed.data.items.map(({ productId, quantity }) => ({ product_id: productId, quantity })),
    });
    if (error) return { ok: false as const, error: error.message };
    if(parsed.data.email){const order=data as {order_number:number;total:number};const safeName=parsed.data.name.replace(/[&<>\"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]||c));try{await sendStoreEmail(parsed.data.email,"تأكيد طلبك من Glitter",`<div dir="rtl" style="font-family:Arial,sans-serif"><h2>شكرًا لطلبك يا ${safeName}</h2><p>رقم الطلب #${order.order_number}</p><p>الإجمالي: ${Number(order.total).toFixed(2)} ₪</p><p>سنتواصل معك لتأكيد تفاصيل التوصيل.</p></div>`);}catch{/* Order creation must not be reversed by an email provider outage. */}}
    return { ok: true as const, order: data as { id: string; order_number: number; total: number; status: string } };
  } catch {
    return { ok: false as const, error: "تعذر إرسال الطلب. تحقق من إعدادات المتجر وحاول مجددًا." };
  }
}
