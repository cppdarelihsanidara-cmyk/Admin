-- APPLIED ON PRODUCTION: 2026-11-23 (version 20261123103827)
-- Keep push_subscriptions.updated_at accurate on every update/upsert
DROP TRIGGER IF EXISTS push_subscriptions_touch ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_touch
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Safe SECURITY DEFINER RPC for parents to upsert/reassign their own device subscription
CREATE OR REPLACE FUNCTION public.upsert_my_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text,
  p_child_id uuid DEFAULT NULL, p_user_agent text DEFAULT NULL,
  p_device_type text DEFAULT 'mobile', p_device_label text DEFAULT 'هاتف محمول'
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sub_id uuid;
  v_device_type text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NULLIF(btrim(p_endpoint), '') IS NULL OR NULLIF(btrim(p_p256dh), '') IS NULL OR NULLIF(btrim(p_auth), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid push subscription payload';
  END IF;
  v_device_type := CASE WHEN p_device_type IN ('mobile', 'desktop', 'tablet') THEN p_device_type ELSE 'mobile' END;
  INSERT INTO public.push_subscriptions (
    parent_user_id, child_id, endpoint, p256dh, auth,
    user_agent, device_type, device_label, role, is_active, last_used_at, updated_at
  ) VALUES (
    v_uid, p_child_id, btrim(p_endpoint), btrim(p_p256dh), btrim(p_auth),
    left(coalesce(p_user_agent, ''), 500), v_device_type,
    coalesce(NULLIF(btrim(p_device_label), ''), CASE WHEN v_device_type = 'mobile' THEN 'هاتف محمول' ELSE 'حاسوب' END),
    'parent', true, now(), now()
  )
  ON CONFLICT (endpoint) DO UPDATE SET
    parent_user_id = EXCLUDED.parent_user_id,
    child_id = COALESCE(EXCLUDED.child_id, public.push_subscriptions.child_id),
    p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent,
    device_type = EXCLUDED.device_type, device_label = EXCLUDED.device_label,
    role = 'parent', is_active = true, last_used_at = now(), updated_at = now()
  RETURNING id INTO v_sub_id;
  RETURN v_sub_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_my_push_subscription(text, text, text, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_my_push_subscription(text, text, text, uuid, text, text, text) TO authenticated;

ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS correlation_id uuid DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_notif_outbox_processing
  ON public.notification_outbox (status, processing_started_at)
  WHERE status = 'processing';

ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS error_type text;

CREATE OR REPLACE FUNCTION public.get_push_diagnostics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_active_subs int; v_active_mobile_subs int; v_expired_subs int;
  v_sent_count int; v_failed_count int; v_processing_count int; v_pending_count int;
  v_last_error text; v_last_success_at timestamptz;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  SELECT count(*) FILTER (WHERE is_active = true), count(*) FILTER (WHERE is_active = true AND device_type = 'mobile'), count(*) FILTER (WHERE is_active = false)
  INTO v_active_subs, v_active_mobile_subs, v_expired_subs FROM public.push_subscriptions WHERE role = 'parent';
  SELECT count(*) FILTER (WHERE status = 'sent'), count(*) FILTER (WHERE status = 'failed'), count(*) FILTER (WHERE status = 'processing'), count(*) FILTER (WHERE status = 'pending'), max(sent_at) FILTER (WHERE status = 'sent')
  INTO v_sent_count, v_failed_count, v_processing_count, v_pending_count, v_last_success_at FROM public.notification_outbox;
  SELECT error_message INTO v_last_error FROM public.notification_outbox WHERE error_message IS NOT NULL AND error_message <> '' ORDER BY created_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'active_subscriptions', coalesce(v_active_subs, 0), 'active_mobile_subscriptions', coalesce(v_active_mobile_subs, 0),
    'expired_subscriptions', coalesce(v_expired_subs, 0), 'sent_count', coalesce(v_sent_count, 0),
    'failed_count', coalesce(v_failed_count, 0), 'processing_count', coalesce(v_processing_count, 0),
    'pending_count', coalesce(v_pending_count, 0), 'last_error', v_last_error, 'last_success_at', v_last_success_at
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.get_push_diagnostics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_push_diagnostics() TO authenticated;
