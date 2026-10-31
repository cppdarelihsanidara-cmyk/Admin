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
   supabase secrets set META_WA_ACCESS_TOKEN="..." META_PHONE_NUMBER_ID="..." META_WA_VERIFY_TOKEN="dar_el_ihsan_wa_verify_2026"
   ```

## نظام الحضور وإشعارات الغياب (الإصدار الجديد)
**التدفق:** تسجيل الحضور ← حفظ في جدول `attendance` ← معاينة قائمة الغائبين مع رقم الولي المعتمد ← إرسال عبر الدالة `send-whatsapp` ← تحديث الحالة تلقائيًا (تم التسليم/القراءة) عبر `whatsapp-webhook`.

1. شغّل `sql/17-attendance-and-absence-notifications.sql` في Supabase SQL Editor (ينشئ `attendance` و`whatsapp_logs` مع RLS وفهرس يمنع تكرار إشعار الغياب لنفس الطفل في اليوم).
2. انشر الدالتين:
   ```bash
   supabase functions deploy send-whatsapp
   supabase functions deploy whatsapp-webhook --no-verify-jwt
   supabase secrets set META_WA_ACCESS_TOKEN=... META_PHONE_NUMBER_ID=... META_WA_VERIFY_TOKEN=... META_APP_SECRET=...
   ```
3. **مهم (قيد من Meta):** الرسائل النصية الحرة تُقبل فقط خلال 24 ساعة من آخر رسالة للولي. لإشعار الغياب الصباحي أنشئ قالبًا معتمدًا (Utility) بمتغيرين `{{1}}` اسم الطفل و`{{2}}` التاريخ، ثم: `supabase secrets set META_WA_ABSENCE_TEMPLATE=absence_notice META_WA_TEMPLATE_LANG=ar`.
4. رقم الولي يُؤخذ من حساب الولي المرتبط بالطفل (`parent_profiles`) ثم من هاتف ملف الطفل، مع إمكانية تصحيحه قبل الإرسال.
