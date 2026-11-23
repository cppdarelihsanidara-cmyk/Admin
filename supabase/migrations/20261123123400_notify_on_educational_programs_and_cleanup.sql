-- APPLIED ON PRODUCTION: 2026-11-23 (version 20261123123400)
CREATE OR REPLACE FUNCTION public.de_notify_on_educational_program()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_title text; v_body text; v_url text := './parent.html#programs'; v_tag text;
  v_is_new_publish boolean; v_is_published_update boolean;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  v_is_new_publish := (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published');
  v_is_published_update := (TG_OP = 'UPDATE' AND OLD.status = 'published' AND (
    OLD.title IS DISTINCT FROM NEW.title OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.goals IS DISTINCT FROM NEW.goals OR OLD.schedule IS DISTINCT FROM NEW.schedule
  ));
  IF NOT v_is_new_publish AND NOT v_is_published_update THEN RETURN NEW; END IF;
  v_title := CASE WHEN v_is_new_publish THEN 'برنامج تربوي جديد: ' || coalesce(nullif(btrim(NEW.title), ''), 'البرنامج الأسبوعي')
    ELSE 'تحديث البرنامج التربوي: ' || coalesce(nullif(btrim(NEW.title), ''), 'البرنامج الأسبوعي') END;
  v_body := 'تم نشر البرنامج التربوي لقسم طفلك في فضاء الأولياء.';
  v_tag := 'de-prog-' || NEW.id::text || '-' || floor(extract(epoch from clock_timestamp()))::bigint::text;
  INSERT INTO public.notifications (recipient_user_id, child_id, title, body, notification_type, related_record_id, related_url)
  SELECT DISTINCT pc.parent_id, c.id, v_title, v_body, 'program', NEW.id, v_url
  FROM public.children c
  JOIN public.parent_children pc ON pc.child_id = c.id
  JOIN public.parent_profiles pp ON pp.user_id = pc.parent_id AND pp.disabled = false
  WHERE c.section_id = NEW.section_id
  ON CONFLICT (recipient_user_id, notification_type, related_record_id) WHERE related_record_id IS NOT NULL
  DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, is_read = false, created_at = now();
  INSERT INTO public.notification_outbox (target_type, target_section_id, event_type, title, body, url, tag)
  VALUES ('section_parents', NEW.section_id, 'announcement', v_title, v_body, v_url, v_tag)
  ON CONFLICT (tag) WHERE tag IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_on_educational_program ON public.educational_programs;
CREATE TRIGGER trg_notify_on_educational_program
  AFTER INSERT OR UPDATE ON public.educational_programs
  FOR EACH ROW EXECUTE FUNCTION public.de_notify_on_educational_program();
