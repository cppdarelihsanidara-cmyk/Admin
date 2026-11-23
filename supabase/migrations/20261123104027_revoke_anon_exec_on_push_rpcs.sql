-- APPLIED ON PRODUCTION: 2026-11-23 (version 20261123104027)
REVOKE EXECUTE ON FUNCTION public.get_push_diagnostics() FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_my_push_subscription(text, text, text, uuid, text, text, text) FROM anon;
