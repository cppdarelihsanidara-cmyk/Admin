# VERSIONS — Dar El Ihsan Production Release v2

- **تاريخ الإصدار**: 2026-11-23
- **وسم الواجهة والكاش الموحّد**: `20261123_pushfix7` (`de-parents-prod-20261123-pushfix7`)
- **مستودع الإدارة (`Admin/`)**: `pushfix7` (بما في ذلك `Admin/pwa.js` المصحّح، `sw.js`، `manage.js`، `manage-theme.css`، `pdf-writer.js`، `theme-switcher.js`)
- **مستودع الأولياء (`Parents/`)**: `pushfix7` (`sw.js`، `pwa.js`، `parent.js`، `parent-modern.css`، `pdf-writer.js`، `theme-switcher.js`)

## إصدارات Supabase Edge Functions المنشورة (المشروع `qgjddtylriqdwvpihvmi`)
| الوظيفة | الإصدار | `verify_jwt` | SHA256 (من Supabase) |
| :--- | :--- | :--- | :--- |
| `send-push-notifications` | v19 | `false` (تحقق داخلي) | `56054f39fa290cd619612c9403cb382f88463f05129352ac5d6f8f70680ae68d` |
| `send-push-test` | v3 | `false` (تحقق داخلي) | `354d6f448d3e48ac40eea6c1d80573322201fe95aecf24b3d0dffa6796b0b5c9` |
| `send-whatsapp` | v24 | `true` | لم يُعدّل |
| `whatsapp-webhook` | v25 | `false` (HMAC-SHA256) | لم يُعدّل |
| `admin-users` | v30 | `true` | لم يُعدّل |
| `parent-accounts` | v29 | `true` | لم يُعدّل |

## الترحيلات المطبّقة في 2026-11-23 (محفوظة في `supabase/migrations/` للتوثيق وإعادة البناء في Staging فقط — لا تُعد تطبيقها على الإنتاج)
1. `20261123103827_fix_push_notifications_outbox_and_diagnostics.sql`
2. `20261123104027_revoke_anon_exec_on_push_rpcs.sql`
3. `20261123113832_instant_push_dispatch_and_cascade_delete_notifications.sql`
4. `20261123123400_notify_on_educational_programs_and_cleanup.sql`
5. `20261123130232_production_hardening_indexes_multicenter_and_outbox_statuses.sql`

## بصمات SHA256 لملفات المصدر المرفقة (`index.ts`)
*(ملاحظة: بصمة `ezbr_sha256` في Supabase تخص حزمة `.eszip` المترجمة، بينما أدناه بصمة ملفات `index.ts` المستخرجة حرفياً من النسخ المنشورة)*
- `supabase/functions/send-push-notifications/index.ts` (v19): `bb7381aedcf7a1bda37368945b6b056bf4782b99a428be2d10d68949217844ba`
- `supabase/functions/send-push-test/index.ts` (v3): `cae189c995d74c87ce3311cf205dfa3c8dfad4f5021393a130695220193f7a78`

## ترحيلات مقترحة بانتظار الموافقة (`supabase/pending_migrations/`)
- `20261123150000_harden_upsert_my_push_subscription.sql` (مختبر بالكامل عبر 7 سيناريوهات في معاملة تراجع؛ غير مطبّق على الإنتاج بعد)
- `MULTI-CENTER-ROLLOUT-PLAN.md` (خطة تعدد المراكز التدريجية القابلة للتراجع)
