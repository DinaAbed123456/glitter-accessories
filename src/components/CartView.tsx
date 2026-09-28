"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getCartProducts } from "@/actions/cart";

type Product = { id:string; name:string; price:number; stock:number; image:string|null };
export default function CartView() {
  const [cart,setCart]=useState<Record<string,number>>({}); const [products,setProducts]=useState<Product[]>([]); const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{ const raw=localStorage.getItem("glitter-cart-v1"); let value:Record<string,number>={}; try{value=raw?JSON.parse(raw):{}}catch{localStorage.removeItem("glitter-cart-v1")} setCart(value); const rows=await getCartProducts(Object.keys(value));setProducts(rows);setLoading(false); },[]);
  useEffect(()=>{ void refresh(); window.addEventListener("glitter-cart-change",refresh); return()=>window.removeEventListener("glitter-cart-change",refresh); },[refresh]);
  function update(id:string,quantity:number){ const next={...cart};if(quantity<1)delete next[id];else next[id]=Math.min(quantity,20);setCart(next);localStorage.setItem("glitter-cart-v1",JSON.stringify(next));void refresh(); }
  const total=products.reduce((sum,p)=>sum+p.price*(cart[p.id]||0),0);
  return <main dir="rtl" className="min-h-screen bg-[#fffdfc] px-5 py-10 text-[#201d1c]"><div className="mx-auto max-w-5xl"><Link href="/" className="font-serif text-2xl">Glitter</Link><h1 className="my-9 text-3xl font-light">سلة التسوق</h1>{loading?<p>جارٍ تحميل السلة...</p>:products.length===0?<div className="py-20 text-center text-sm text-black/50">سلتك فارغة.<p><Link className="mt-5 inline-block underline" href="/shop">تابعي التسوق</Link></p></div>:<><div className="divide-y divide-black/10">{products.map(p=><div key={p.id} className="grid grid-cols-[88px_1fr_auto] gap-4 py-5"><div className="aspect-square bg-[#f7f3f1]">{p.image&&<img src={p.image} alt={p.name} className="h-full w-full object-cover"/>}</div><div><Link href={`/product/${p.id}`} className="text-sm">{p.name}</Link><p className="mt-2 text-xs">{p.price} ₪ · المتوفر {p.stock}</p><div className="mt-4 flex items-center gap-4 text-sm"><button onClick={()=>update(p.id,(cart[p.id]||1)-1)} aria-label="تقليل الكمية">−</button><span>{cart[p.id]}</span><button onClick={()=>update(p.id,(cart[p.id]||0)+1)} disabled={cart[p.id]>=p.stock} aria-label="زيادة الكمية">+</button><button onClick={()=>update(p.id,0)} className="mr-3 text-xs text-black/50 underline">حذف</button></div></div><strong className="text-sm">{(p.price*cart[p.id]).toFixed(2)} ₪</strong></div>)}</div><aside className="mr-auto mt-8 max-w-sm bg-[#f5efed] p-6"><div className="flex justify-between text-sm"><span>المجموع الفرعي</span><strong>{total.toFixed(2)} ₪</strong></div><p className="mt-3 text-[11px] text-black/50">يُحسب التوصيل بعد اختيار المنطقة.</p><Link href="/checkout" className="mt-6 block bg-[#211e1c] py-4 text-center text-xs text-white">متابعة لإتمام الطلب</Link></aside></>}</div></main>;
}
