import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StoreProduct = {
  id: string; name: string; description: string; price: number; old_price: number | null;
  stock: number; is_featured: boolean; category_id: string | null; image_url: string | null; image_urls?:string[];
};

export async function getProducts(options: { query?: string; category?: string; sort?: string; offers?: boolean; available?: boolean; minPrice?: number; maxPrice?: number } = {}) {
  try {
    const supabase = await createSupabaseServerClient();
    let request = supabase.from("products").select("id,name,description,price,old_price,stock,is_featured,category_id,product_images(storage_path,sort_order)").eq("is_visible", true);
    if (options.query) request = request.ilike("name", `%${options.query.replace(/[,%_]/g, " ")}%`);
    if (options.category) request = request.eq("category_id", options.category);
    let offerProductIds:string[]=[];
    if(options.offers){const now=new Date().toISOString();const {data:active}=await supabase.from("offers").select("id").eq("is_active",true).lte("starts_at",now).gte("ends_at",now);const offerIds=(active??[]).map(o=>o.id);if(!offerIds.length)return[];const {data:linked}=await supabase.from("offer_products").select("product_id").in("offer_id",offerIds);offerProductIds=[...new Set((linked??[]).map(x=>x.product_id))];if(!offerProductIds.length)return[];request=request.in("id",offerProductIds);}
    if (options.available) request = request.gt("stock", 0);
    if (options.minPrice !== undefined) request = request.gte("price", options.minPrice);
    if (options.maxPrice !== undefined) request = request.lte("price", options.maxPrice);
    if (options.sort === "price-asc") request = request.order("price", { ascending: true });
    else if (options.sort === "price-desc") request = request.order("price", { ascending: false });
    else if (options.sort === "new") request = request.order("created_at", { ascending: false });
    else request = request.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
    const { data, error } = await request;
    if (error || !data) return [] as StoreProduct[];
    const {data:offerLinks}=data.length?await supabase.from("offer_products").select("product_id,offers(discount_type,discount_value)").in("product_id",data.map(p=>p.id)): {data:[]};
    const savings=new Map<string,number>();for(const link of offerLinks??[]){const offers=Array.isArray(link.offers)?link.offers:[link.offers];for(const offer of offers){if(!offer)continue;const price=Number(data.find(p=>p.id===link.product_id)?.price||0);const amount=offer.discount_type==="percentage"?price*Math.min(Number(offer.discount_value),100)/100:Math.min(price,Number(offer.discount_value));savings.set(link.product_id,Math.max(savings.get(link.product_id)||0,amount));}}
    const products = await Promise.all(data.map(async (product) => {
      const image = [...(product.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
      const { data: imageUrl } = image ? await supabase.storage.from("product-media").createSignedUrl(image.storage_path, 3600) : { data: { signedUrl: "" } };
      const basePrice=Number(product.price);const saving=savings.get(product.id)||0;
      return { ...product, price: Math.max(0,basePrice-saving), old_price: saving>0?basePrice:product.old_price===null?null:Number(product.old_price), image_url: imageUrl?.signedUrl || null };
    }));
    return products as StoreProduct[];
  } catch {
    return [] as StoreProduct[];
  }
}

export async function getCategories() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("categories").select("id,name,image_url,sort_order").eq("is_visible", true).order("sort_order");
    return data ?? [];
  } catch { return []; }
}

export async function getProduct(id: string) {
  const products = await getProducts();
  const product=products.find((item)=>item.id===id);if(!product)return null;
  try{const supabase=await createSupabaseServerClient();const {data:images}=await supabase.from("product_images").select("storage_path,sort_order").eq("product_id",id).order("sort_order");const urls=await Promise.all((images??[]).map(async(image)=>{const {data}=await supabase.storage.from("product-media").createSignedUrl(image.storage_path,3600);return data?.signedUrl||null;}));return{...product,image_urls:urls.filter((url):url is string=>Boolean(url))};}catch{return product;}
}

export async function getActiveBanners() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("banners").select("id,title,description,media_path,media_type,destination_type,destination_id,destination_url").eq("is_active", true).order("sort_order");
    return Promise.all((data ?? []).map(async (banner) => {
      const { data: media } = banner.media_path ? await supabase.storage.from("product-media").createSignedUrl(banner.media_path, 3600) : { data: null };
      return { ...banner, image: media?.signedUrl || null };
    }));
  } catch { return []; }
}

export async function getActiveOffers() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("offers").select("id,name,description,discount_type,discount_value,starts_at,ends_at").eq("is_active", true).lte("starts_at", new Date().toISOString()).gte("ends_at", new Date().toISOString()).order("ends_at");
    return data ?? [];
  } catch { return []; }
}
