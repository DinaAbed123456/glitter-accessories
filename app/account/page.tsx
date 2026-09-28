import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseSession } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";
import SignOutButton from "@/components/SignOutButton";
export default async function AccountPage(){const session=await getSupabaseSession();if(!session?.user)redirect("/login");const {supabase,user}=session;const {data:profile}=await supabase.from("profiles").select("full_name,phone,address").eq("id",user.id).maybeSingle();return <main dir="rtl" className="min-h-screen bg-[#fffdfc] px-5 py-10"><div className="mx-auto max-w-5xl"><Link href="/" className="font-serif text-2xl">Glitter</Link><h1 className="my-9 text-3xl font-light">حسابي</h1><p className="text-sm text-black/55">{user.email}</p><nav className="mt-6 flex flex-wrap gap-5 border-b border-black/10 pb-5 text-xs"><Link href="/orders">طلباتي</Link><Link href="/favorites">المفضلة</Link><Link href="/reset-password">تغيير كلمة المرور</Link><SignOutButton/></nav><h2 className="mt-9 text-xl font-light">معلوماتي</h2><ProfileForm profile={profile||{full_name:String(user.user_metadata.full_name||""),phone:null,address:null}}/></div></main>;}
