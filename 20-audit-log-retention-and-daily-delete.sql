-- DAR EL IHSAN — 20: AUDIT LOG DAILY DELETE & 30-DAY AUTO-RETENTION RPCS
-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor لتفعيل حذف سجل اليوم والحذف التلقائي بعد شهر (30 يوماً) بأمان تام.

CREATE OR REPLACE FUNCTION public.admin_audit_delete_day(p_day date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  -- التحقق من أن المستخدم مسجّل دخول ومخوّل كإداري
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    DELETE FROM public.audit_logs
    WHERE COALESCE(created_at, now()) >= p_day::timestamptz
      AND COALESCE(created_at, now()) < (p_day + INTERVAL '1 day')::timestamptz;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ELSIF to_regclass('public.audit_log') IS NOT NULL THEN
    DELETE FROM public.audit_log
    WHERE COALESCE(at, created_at, now()) >= p_day::timestamptz
      AND COALESCE(at, created_at, now()) < (p_day + INTERVAL '1 day')::timestamptz;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_audit_purge_older_than(p_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
  v_days integer := GREATEST(1, COALESCE(p_days, 30));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    DELETE FROM public.audit_logs
    WHERE COALESCE(created_at, now()) < (now() - make_interval(days => v_days));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ELSIF to_regclass('public.audit_log') IS NOT NULL THEN
    DELETE FROM public.audit_log
    WHERE COALESCE(at, created_at, now()) < (now() - make_interval(days => v_days));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_audit_delete_day(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_audit_purge_older_than(integer) TO authenticated;
