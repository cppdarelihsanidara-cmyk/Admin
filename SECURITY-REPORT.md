# التقرير الأمني — منصة دار الإحسان (الإصدار v3)

- **المشروع**: `qgjddtylriqdwvpihvmi` (DarElIhsan) — تاريخ التحقق: 2026-11-23.
- **عزل البيانات (RLS)**: مفعّل على جميع الجداول الـ 26 في `public`؛ الولي يرى بيانات أبنائه فقط، والمخزن `private-docs` محمي بـ `can_read_private_object(name)` وبمسار UUID صارم وحد 5MB.
- **تحصين `upsert_my_push_subscription` (مطبّق — `20261123140546`)**: يتحقق من أن المستخدم وليّ نشط، ويرفض أي `child_id` غير مرتبط في `parent_children`، ويمنع الاستيلاء على `endpoint` مستخدم آخر إلا بإثبات حيازة مفاتيح `p256dh` و`auth` الفعلية على الجهاز نفسه. اجتاز 7/7 سيناريوهات اختبار في PostgreSQL.
- **دوال `SECURITY DEFINER`**: تم سحب `EXECUTE` عن جميع دوال Trigger الثلاث (`exposed_trigger_fns = 0`) وعن `anon` لدالتي `get_push_diagnostics` و`upsert_my_push_subscription`.
- **XSS والأسرار**: `0` تعيينات `.innerHTML =` في جميع ملفات JS، و`0` أسرار أو مفاتيح خاصة داخل الحزمة.
- **تنبيه أمني متبقٍ**: `Leaked Password Protection` معطّل لأن المنظمة على خطة Supabase **Free** (يتطلب الترقية إلى **Pro**).
