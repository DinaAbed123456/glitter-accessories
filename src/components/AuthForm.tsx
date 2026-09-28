"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getAdminRole, sendPasswordReset, signIn, signOut, signUp } from "@/actions/auth";

export default function AuthForm({ mode, admin = false }: { mode: "login" | "register" | "forgot"; admin?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);

    try {
      if (mode === "login") {
        const result = await signIn({ email: data.get("email"), password: data.get("password") });
        if (!result.ok) {
          setError(result.error);
          return;
        }

        const role = await getAdminRole();
        if (admin && !role) {
          await signOut();
          setError("??? ?????? ?? ???? ?????? ???? ???? ???????.");
          return;
        }
        router.replace(role ? "/admin" : "/account");
        router.refresh();
        return;
      }

      if (mode === "forgot") {
        const result = await sendPasswordReset(data.get("email"));
        if (result.ok) setDone(true);
        else setError(result.error);
        return;
      }

      const result = await signUp({ name: data.get("name"), email: data.get("email"), password: data.get("password") });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.confirmationRequired) {
        setDone(true);
        return;
      }

      const role = await getAdminRole();
      if (role) router.replace("/admin");
      else router.replace("/account");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بخدمة الحسابات. تحقق من إعدادات Supabase واتصال الإنترنت ثم حاول مجددًا.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "login" ? "تسجيل الدخول" : mode === "register" ? "إنشاء حساب" : "استعادة كلمة المرور";

  return (
    <main dir="rtl" className="min-h-screen bg-[#fffdfc] px-5 py-12 text-[#201d1c]">
      <div className="mx-auto max-w-md">
        <Link href="/" className="font-serif text-2xl">Glitter</Link>
        <section className="mt-12 border border-black/10 bg-white p-7 md:p-10">
          <p className="text-xs tracking-[.18em] text-[#b98b8f]">GLITTER ACCESSORIES</p>
          <h1 className="mt-3 text-2xl font-light">{title}</h1>
          {done ? (
            <p className="mt-8 bg-[#f5efed] p-4 text-sm">
              {mode === "forgot" ? "إذا كان البريد مسجلًا، ستصلك رسالة لاستعادة كلمة المرور." : mode === "register" ? "أُنشئ الحساب. تحققي من بريدك الإلكتروني لتأكيده." : "تمت العملية بنجاح."}
            </p>
          ) : (
            <form method="post" onSubmit={submit} className="mt-8 space-y-5">
              {mode === "register" && <label className="block text-xs">الاسم الكامل<input required name="name" minLength={2} maxLength={120} className="mt-2 w-full border border-black/15 p-3" /></label>}
              <label className="block text-xs">البريد الإلكتروني<input required name="email" type="email" autoComplete="email" className="mt-2 w-full border border-black/15 p-3" /></label>
              {mode !== "forgot" && <label className="block text-xs">كلمة المرور<input required name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className="mt-2 w-full border border-black/15 p-3" /></label>}
              {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
              <button disabled={busy} className="w-full bg-[#211e1c] py-4 text-xs text-white disabled:opacity-50">{busy ? "جارٍ التنفيذ..." : title}</button>
              {mode === "login" && <Link className="block text-left text-xs underline" href="/forgot">نسيت كلمة المرور؟</Link>}
            </form>
          )}
          <div className="mt-6 flex justify-between text-xs">
            {mode !== "login" && <Link href="/login" className="underline">العودة لتسجيل الدخول</Link>}
            {mode === "login" && <Link href="/register" className="underline">إنشاء حساب جديد</Link>}
          </div>
        </section>
      </div>
    </main>
  );
}
