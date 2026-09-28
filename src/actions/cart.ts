"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCartProducts(input: unknown) {
  const ids = z.array(z.string().uuid()).max(30).safeParse(input);
  if (!ids.success || ids.data.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("products").select("id,name,price,stock,product_images(storage_path,sort_order)").in("id", [...new Set(ids.data)]).eq("is_visible", true);
  const {data:links}=data?.length?await supabase.from("offer_products").select("product_id,offers(discount_type,discount_value)").in("product_id",data.map(p=>p.id)):{data:[]};
  return Promise.all((data ?? []).map(async (product) => {
    const image = [...(product.product_images ?? [])].sort((a,b)=>a.sort_order-b.sort_order)[0];
    const { data: signed } = image ? await supabase.storage.from("product-media").createSignedUrl(image.storage_path, 3600) : { data: null };
    const basePrice=Number(product.price);let bestDiscount=0;for(const link of links??[]){if(link.product_id!==product.id)continue;const offers=Array.isArray(link.offers)?link.offers:[link.offers];for(const offer of offers){if(!offer)continue;const discount=offer.discount_type==="percentage"?basePrice*Math.min(Number(offer.discount_value),100)/100:Math.min(basePrice,Number(offer.discount_value));bestDiscount=Math.max(bestDiscount,discount);}}
    return { id: product.id, name: product.name, price: basePrice-bestDiscount, stock: product.stock, image: signed?.signedUrl ?? null };
  }));
}
