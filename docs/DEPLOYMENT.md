# تشغيل Glitter Accessories

## إعداد Supabase

1. أنشئي مشروع Supabase، ثم أضيفي القيم الواردة في `.env.example` إلى بيئة التشغيل المحلية وVercel.
2. اربطي المشروع بـ Supabase CLI (`supabase link --project-ref <project-ref>`) ثم شغّلي `supabase db push`. تنشئ الهجرة الجداول والسياسات ومناطق القدس والداخل والضفة، وبيانات كتالوج أولية آمنة. يمكن أيضًا تشغيل ملف الهجرة مرة واحدة في SQL Editor.
3. فعّلي تأكيد البريد واضبطي SMTP في Supabase Auth (يمكن استخدام Resend SMTP). رسائل الاستعادة وتأكيد الطلب تستخدم `RESEND_API_KEY` و`RESEND_FROM_EMAIL` من الخادم عند ضبطهما؛ دعوات الحسابات وتأكيد التسجيل تعتمد على SMTP في Supabase Auth.
4. أنشئي حساب الأدمن الأول من Supabase Auth، ثم امنحيه الدور يدويًا من SQL Editor مرة واحدة:

```sql
insert into public.admin_users(user_id, role)
select id, 'admin' from auth.users where email = 'ADMIN_EMAIL_HERE';
```

لا تضعي عنوانًا سريًا أو كلمة مرور في ملفات المشروع. بعدها يستطيع الأدمن دعوة الموظفين وتعيين صلاحيات القراءة والكتابة من لوحة الإدارة.

## النشر

استخدمي `npm install` ثم `npm run build`، واربط المشروع بـ Vercel. أضيفي المتغيرات التالية في إعدادات المشروع لكل بيئة:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (خادمي فقط)
- `RESEND_API_KEY` و`RESEND_FROM_EMAIL` عند تفعيل رسائل Resend

إجراء إنشاء الطلب يستدعي دالة PostgreSQL `checkout_order`، التي تعيد قراءة الأسعار والمخزون والكوبون ورسوم التوصيل داخل معاملة واحدة. لا تمرري مفاتيح الخدمة إلى المتصفح.
