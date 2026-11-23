-- APPLIED ON PRODUCTION: 2026-11-23 (version 20261123140546 — approved by owner)
-- Purpose: Harden public.upsert_my_push_subscription against endpoint hijacking
--          and unauthorized child_id association, while preserving legitimate
--          same-device account switching via cryptographic key possession proof.
-- Rollback: Re-run the previous definition from 20261123103827_fix_push_notifications_outbox_and_diagnostics.sql.

CREATE OR REPLACE FUNCTION public.upsert_my_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_child_id uuid DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device_type text DEFAULT 'mobile',
  p_device_label text DEFAULT 'هاتف محمول'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_sub_id uuid;
  v_device_type text;
  v_ep text := NULLIF(btrim(p_endpoint), '');
  v_p256dh text := NULLIF(btrim(p_p256dh), '');
  v_auth text := NULLIF(btrim(p_auth), '');
  v_existing record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.parent_profiles pp
    WHERE pp.user_id = v_uid AND pp.disabled = false
  ) THEN
    RAISE EXCEPTION 'Active parent account required';
  END IF;

  IF v_ep IS NULL OR v_p256dh IS NULL OR v_auth IS NULL THEN
    RAISE EXCEPTION 'Invalid push subscription payload';
  END IF;

  IF p_child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.parent_children pc
    WHERE pc.parent_id = v_uid AND pc.child_id = p_child_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized child_id for current parent';
  END IF;

  v_device_type := CASE
    WHEN p_device_type IN ('mobile', 'desktop', 'tablet') THEN p_device_type
    ELSE 'mobile'
  END;

  SELECT id, parent_user_id, p256dh, auth
  INTO v_existing
  FROM public.push_subscriptions
  WHERE endpoint = v_ep
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.parent_user_id IS DISTINCT FROM v_uid THEN
      -- Reassigning an endpoint to another parent on the same physical browser
      -- requires proving live PushManager possession via exact p256dh + auth match.
      IF v_existing.p256dh IS DISTINCT FROM v_p256dh OR v_existing.auth IS DISTINCT FROM v_auth THEN
        RAISE EXCEPTION 'Subscription endpoint belongs to another account';
      END IF;
    END IF;

    UPDATE public.push_subscriptions SET
      parent_user_id = v_uid,
      child_id = CASE
        WHEN v_existing.parent_user_id IS DISTINCT FROM v_uid THEN p_child_id
        ELSE COALESCE(p_child_id, public.push_subscriptions.child_id)
      END,
      p256dh = v_p256dh,
      auth = v_auth,
      user_agent = left(coalesce(p_user_agent, ''), 500),
      device_type = v_device_type,
      device_label = coalesce(
        NULLIF(btrim(p_device_label), ''),
        CASE WHEN v_device_type = 'mobile' THEN 'هاتف محمول' ELSE 'حاسوب' END
      ),
      role = 'parent',
      is_active = true,
      last_used_at = now(),
      updated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_sub_id;
  ELSE
    INSERT INTO public.push_subscriptions (
      parent_user_id, child_id, endpoint, p256dh, auth,
      user_agent, device_type, device_label, role, is_active, last_used_at, updated_at
    ) VALUES (
      v_uid, p_child_id, v_ep, v_p256dh, v_auth,
      left(coalesce(p_user_agent, ''), 500), v_device_type,
      coalesce(
        NULLIF(btrim(p_device_label), ''),
        CASE WHEN v_device_type = 'mobile' THEN 'هاتف محمول' ELSE 'حاسوب' END
      ),
      'parent', true, now(), now()
    )
    RETURNING id INTO v_sub_id;
  END IF;

  RETURN v_sub_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_my_push_subscription(text, text, text, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_my_push_subscription(text, text, text, uuid, text, text, text) TO authenticated;
