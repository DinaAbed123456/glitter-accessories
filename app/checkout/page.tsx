import { createSupabaseServerClient } from "@/lib/supabase/server";
import CheckoutForm from "@/components/CheckoutForm";
export default async function CheckoutPage(){let zones:{id:string;name:string;fee:number}[]=[];try{const supabase=await createSupabaseServerClient();const {data}=await supabase.from("delivery_zones").select("id,name,fee").eq("is_active",true).order("name");zones=(data??[]).map((z)=>({...z,fee:Number(z.fee)}));}catch{}return <CheckoutForm zones={zones}/>;}
