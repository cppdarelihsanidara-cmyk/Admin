# لوحة إدارة دار الإحسان (Dar El Ihsan Admin Portal)

لوحة الإدارة الشاملة لتسيير المراكز الثلاثة، الأطفال والطلبة، المربيات، الأقسام، الحسابات، التقارير البيداغوجية، استمارات التقييم الرسمية، الأرشيف والنسخ الاحتياطية، ونظام رسائل واتساب (Meta Cloud API).

## أبرز التحديثات المنفذة
- **نظام رسائل واتساب:** تكامل كامل مع Meta Cloud API مع البحث والتصفية حسب التاريخ والفرع والقسم والطفل وحالة الرسالة، ودوال Edge Functions مؤمنة، ورقم الاختبار المعتمد (`0564779067`).
- **إخفاء الأزرار داخل التفاصيل:** دمج أزرار العمليات في جميع الجداول وخاصة قسم الحسابات داخل زر موحد `[ التفاصيل ▾ ]` لمنع ازدحام الشاشة.
- **ضبط صلاحيات الأخصائية:** سحب صلاحيات حسابات المربيات والنسخ الاحتياطي وتعديل ملفات الأطفال مع إخفاء كل ما لا تملكه في القائمة الجانبية.
- **طباعة استمارة التقييم PDF:** نظام ديناميكي متعدد الصفحات عالي الدقة يطبع كشف الحساب التجميعي وكافة المهارات (195 مهارة) دون اختصار أو خلط نصوص.

## إعداد قاعدة البيانات والـ Edge Functions
1. تطبيق ملفات SQL المتسلسلة من مجلد `sql/` من 00 إلى 15 داخل Supabase SQL Editor.
2. نشر دوال Edge Functions من مجلد `supabase/functions/`.
3. تسجيل الأسرار في Supabase Secrets:
   ```bash
   TOKEN="$(openssl rand -hex 32)"
supabase secrets set META_WA_ACCESS_TOKEN="<META_ACCESS_TOKEN>" META_PHONE_NUMBER_ID="<META_PHONE_NUMBER_ID>" META_WA_VERIFY_TOKEN="$TOKEN"
# Configure the exact same TOKEN in the Meta webhook verification settings; do not commit it.
   ```

## التدقيق والإصلاح الأمني الشامل (Security Hardening v18.0)
- **إزالة البيانات المضمنة:** حذف كافة مصفوفات بيانات الأطفال والموظفين (`EMBEDDED_STUDENTS` و `EMBEDDED_STAFF`) وأرقام الهواتف وتواريخ الميلاد من ملفات الواجهة.
- **إلغاء آليات التجاوز والدخول المحلي:** إلغاء دوال `verifyStaffPortalAuth` و `persistStaffSession` وحصر المصادقة على Supabase Auth الخادمي فقط.
- **نظام الصلاحيات الخادمي (RBAC):** تطبيق صلاحيات المراكز والأقسام والأدوار (المدير الرئيسي، مدير المركز، المربية، الأخصائي) عبر قاعدة البيانات.
- **تطبيق مايغريشن RLS رقم 18:** تنفيذ `18-security-privacy-hardening-rbac-rls.sql` داخل Supabase SQL Editor لتفعيل سياسات أمن الصفوف الشاملة وحماية التخزين (Storage).


## Security remediation package (2026-11)

- Run `npm run build` to validate JavaScript syntax and local HTML assets; this is a static-site check, not a full browser/integration test.
- The repository contains `18-security-privacy-hardening-rbac-rls.sql`. Review it against the live schema, then run it once in Supabase SQL Editor as database owner. Do not run it against production until the `children.qr_token` and `children.active` column assumptions have been confirmed.
- Set `META_WA_VERIFY_TOKEN` (or the exact environment variable used by the deployed Edge Function) in Supabase Secrets to a newly generated random value. Do not put the value in SQL, Git, HTML, or `cms-config.js`. Update the Meta webhook configuration to match.
- The public QR endpoint now uses `public_child_card_safe`, returning only membership number, name, center, and academic year. Legacy QR links using `?id=` are intentionally rejected; reissue cards using the `?c=` token.
- `cms-config.js` may contain only the public Supabase URL and publishable/anon key. Never commit `service_role`, passwords, personal child records, or real test-message logs.
- If deploying these folders as separate GitHub Pages repositories, replace cross-folder links such as `../01_Parents_Portal/parent.html` with the final HTTPS URL of the parents portal before deployment. They work as relative links only when the three folders are hosted together under one root.
- This package cannot apply migrations to your live Supabase project or deploy to GitHub without connected account access. After migration, run the role-isolation tests documented in `SECURITY-TEST-PLAN.md`.
