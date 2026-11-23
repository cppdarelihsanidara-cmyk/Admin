-- APPLIED ON PRODUCTION: 2026-11-23 (version 20261123113832)
CREATE OR REPLACE FUNCTION public.de_dispatch_outbox_immediately()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_cron_secret text;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  IF NEW.scheduled_at IS NOT NULL AND NEW.scheduled_at > (now() + interval '10 seconds') THEN RETURN NEW; END IF;
  SELECT decrypted_secret INTO v_cron_secret FROM vault.decrypted_secrets WHERE name = 'notification_cron_secret' LIMIT 1;
  IF v_cron_secret IS NULL OR v_cron_secret = '' THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := 'https://qgjddtylriqdwvpihvmi.supabase.co/functions/v1/send-push-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_cron_secret),
    body := jsonb_build_object('limit', 10, 'outbox_id', NEW.id),
    timeout_milliseconds := 15000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_dispatch_outbox_immediately ON public.notification_outbox;
CREATE TRIGGER trg_dispatch_outbox_immediately
  AFTER INSERT ON public.notification_outbox
  FOR EACH ROW EXECUTE FUNCTION public.de_dispatch_outbox_immediately();
