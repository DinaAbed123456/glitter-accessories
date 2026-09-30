"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendStoreEmail } from "@/lib/email";

const credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) });

function hasSupabaseAuthConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const placeholder = /your[-_ ]?(project|supabase)|placeholder|example/i;
  return Boolean(url && anonKey && !placeholder.test(url) && !placeholder.test(anonKey));
}

export async function signIn(input: unknown) {
  const parsed = credentials.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "أدخل بريدًا إلكترونيًا صحيحًا وكلمة مرور." };
  if (!hasSupabaseAuthConfiguration()) {
    return { ok: false as const, error: "إعدادات اتصال Supabase غير مكتملة أو ما زالت تحتوي على قيم تجريبية." };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (!error) return { ok: true as const };
    const message = error.message.toLowerCase();
    if (message.includes("invalid api key") || error.code === "invalid_api_key") {
      return { ok: false as const, error: "مفتاح Supabase غير صالح. راجع قيمة NEXT_PUBLIC_SUPABASE_ANON_KEY في إعدادات Vercel." };
    }
    if (message.includes("invalid login credentials")) return { ok: false as const, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
    if (message.includes("email not confirmed")) return { ok: false as const, error: "يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول." };
    if (error.status === 429) return { ok: false as const, error: "محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا." };
    return { ok: false as const, error: "تعذر تسجيل الدخول. تحقق من بيانات الحساب وحاول مجددًا." };
  } catch {
    return { ok: false as const, error: "تعذر الاتصال بخدمة تسجيل الدخول. تحقق من إعدادات Supabase واتصال الإنترنت." };
  }
}

export async function signUp(input: unknown) {
  const parsed = z.object({ ...credentials.shape, name: z.string().trim().min(2).max(120) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "تحقق من الاسم والبريد الإلكتروني وكلمة المرور." };
  if (!hasSupabaseAuthConfiguration()) {
    return { ok: false as const, error: "إعدادات اتصال Supabase غير مكتملة أو ما زالت تحتوي على قيم تجريبية." };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.name } },
    });
    if (!error) return { ok: true as const, confirmationRequired: !data.session };
    const message = error.message.toLowerCase();
    if (error.status === 429) return { ok: false as const, error: "محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا." };
    if (message.includes("invalid api key") || error.code === "invalid_api_key") {
      return { ok: false as const, error: "مفتاح Supabase غير صالح. راجع قيمة NEXT_PUBLIC_SUPABASE_ANON_KEY في إعدادات Vercel." };
    }
    if (message.includes("database error saving new user")) {
      return { ok: false as const, error: "رفضت قاعدة البيانات إنشاء المستخدم. تحقق من trigger إنشاء الملف الشخصي وتطبيق migration الأساسي في مشروع Supabase المتصل." };
    }
    if (message.includes("signup is disabled") || message.includes("signups not allowed")) {
      return { ok: false as const, error: "إنشاء الحسابات بالبريد معطّل في إعدادات Supabase Authentication." };
    }
    if (message.includes("already registered") || message.includes("already been registered")) {
      return { ok: false as const, error: "هذا البريد مسجل مسبقًا. جرّب تسجيل الدخول أو استعادة كلمة المرور." };
    }
    if (message.includes("password")) return { ok: false as const, error: "كلمة المرور لا تحقق متطلبات الأمان المحددة في Supabase." };
    return { ok: false as const, error: "رفض Supabase إنشاء الحساب. راجع إعدادات Auth ومشروع Supabase المرتبط بهذا الموقع." };
  } catch {
    return { ok: false as const, error: "تعذر الاتصال بخدمة الحسابات. تحقق من إعدادات Supabase واتصال الإنترنت." };
  }
}
export async function sendPasswordReset(input: unknown) {
  const parsed = z.string().trim().email().max(254).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "أدخلي بريدًا إلكترونيًا صحيحًا." };
  const supabase = await createSupabaseServerClient();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!baseUrl) return { ok: false as const, error: "إعداد رابط الموقع غير مكتمل." };
  const redirectTo=`${baseUrl}/auth/callback?next=/reset-password`;
  if(process.env.RESEND_API_KEY&&process.env.SUPABASE_SERVICE_ROLE_KEY){
    try{const admin=createSupabaseAdminClient();const {data,error}=await admin.auth.admin.generateLink({type:"recovery",email:parsed.data,options:{redirectTo}});if(error||!data.properties.action_link)return{ok:true as const};const safeLink=data.properties.action_link.replaceAll("&","&amp;").replaceAll("\"","&quot;");await sendStoreEmail(parsed.data,"استعادة كلمة مرور Glitter",`<div dir="rtl" style="font-family:Arial,sans-serif"><h2>استعادة كلمة المرور</h2><p>استخدمي الرابط التالي لإعادة تعيين كلمة المرور. إذا لم تطلبي ذلك، تجاهلي هذه الرسالة.</p><p><a href="${safeLink}">إعادة تعيين كلمة المرور</a></p></div>`);return{ok:true as const};}catch{return{ok:true as const};}
  }
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo });
  return error ? { ok: false as const, error: "تعذر إرسال رابط الاستعادة." } : { ok: true as const };
}

export async function updatePassword(input: unknown) {
  const parsed = z.string().min(8).max(128).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "يجب أن تتكون كلمة المرور من ٨ أحرف على الأقل." };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "انتهت صلاحية رابط الاستعادة. اطلبي رابطًا جديدًا." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  return error ? { ok: false as const, error: "تعذر تحديث كلمة المرور." } : { ok: true as const };
}

export async function updateProfile(input: unknown) {
  const parsed = z.object({ name: z.string().trim().min(2).max(120), phone: z.string().trim().max(40), address: z.string().trim().max(500) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "تحققي من بيانات الحساب." };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "سجلي الدخول أولًا." };
  const { error } = await supabase.from("profiles").upsert({ id: user.id, full_name: parsed.data.name, phone: parsed.data.phone, address: parsed.data.address });
  return error ? { ok: false as const, error: "تعذر حفظ بيانات الحساب." } : { ok: true as const };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

export async function getAdminRole() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.rpc("current_admin_role");
    return data === "admin" || data === "staff" ? data : null;
  } catch { return null; }
}
