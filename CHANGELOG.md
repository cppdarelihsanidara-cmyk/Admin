# CHANGELOG — Dar El Ihsan Platform

## v3 (2026-11-23 — التدقيق النهائي وإغلاق النواقص المحلية)
- إصلاح الروابط المكسورة في `Admin/site.html` و`Admin/qr.html` (`../Parents-main/parent.html` → `parent.html`) وإزالة وسم `404.js` المفقود من `Admin/404.html`.
- نقل الترحيل الأمني المطبّق بموافقة المالك (`20261123140546_harden_upsert_my_push_subscription.sql`) إلى `supabase/migrations/` ليعكس الحالة الفعلية لـ `schema_migrations` (6 ترحيلات مطبّقة).
- إضافة مجلد `tests/` (`test_sw_push.mjs` و`test_v3_integrity.py`) وتقارير `SECURITY-REPORT.md` و`TEST-REPORT.md` و`PRE-DEPLOY-CONDITIONS.md`.

## v2.1 / v2 / v1 (2026-11-23)
- إصلاح `Admin/pwa.js` إلى `pushfix7`، استخراج مصادر Edge Functions الفعلية، الإرسال الفوري لـ Push، إشعارات البرامج التربوية، الحذف المتسلسل، تحسين الفهارس، تأسيس تعدد المراكز، إعادة تصميم قسم السجل، إزالة `innerHTML`، ودعم الشعار الثنائي اللغة في PDF.
