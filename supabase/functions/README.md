# Supabase Edge Functions — Dar El Ihsan

هذا المجلد يحتوي على المصدر الفعلي المستخرج مباشرة من مشروع Supabase (`qgjddtylriqdwvpihvmi`) بتاريخ 23 نوفمبر 2026، دون أي أسرار مضمّنة (جميع المفاتيح تُقرأ عبر `Deno.env.get(...)`).

## الوظائف المضمّنة
- `send-push-notifications/index.ts` — الإصدار المنشور **v19** (`verify_jwt: false`، يتحقق داخلياً من `x-cron-secret` أو JWT مدير نشط).
- `send-push-test/index.ts` — الإصدار المنشور **v3** (`verify_jwt: false`، يتحقق داخلياً من JWT مدير نشط).

## الوظائف الأخرى النشطة على Supabase (دون تعديل)
- `send-whatsapp` (v24, `verify_jwt: true`)
- `whatsapp-webhook` (v25, `verify_jwt: false`, يتحقق بتوقيع Meta HMAC-SHA256)
- `admin-users` (v30, `verify_jwt: true`)
- `parent-accounts` (v29, `verify_jwt: true`)

## الأسرار المطلوبة في Supabase Secrets (لا تُرفع إلى GitHub أبداً)
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NOTIFICATION_CRON_SECRET`.

## أوامر النشر المستقبلية عبر Supabase CLI
```bash
supabase functions deploy send-push-notifications --project-ref qgjddtylriqdwvpihvmi --no-verify-jwt
supabase functions deploy send-push-test --project-ref qgjddtylriqdwvpihvmi --no-verify-jwt
```
