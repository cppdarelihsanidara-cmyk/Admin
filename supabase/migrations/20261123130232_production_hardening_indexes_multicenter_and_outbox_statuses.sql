-- APPLIED ON PRODUCTION: 2026-11-23 (version 20261123130232)
REVOKE ALL ON FUNCTION public.de_cleanup_notifications_on_source_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.de_dispatch_outbox_immediately() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.de_notify_on_educational_program() FROM PUBLIC, anon, authenticated;

DROP INDEX IF EXISTS public.idx_wa_logs_child_date;

CREATE INDEX IF NOT EXISTS idx_educational_programs_section_id ON public.educational_programs (section_id);
CREATE INDEX IF NOT EXISTS idx_appointments_child_id ON public.appointments (child_id);
CREATE INDEX IF NOT EXISTS idx_messages_child_id ON public.messages (child_id);
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON public.messages (parent_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_parent_id ON public.message_reads (parent_id);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_target_section_id ON public.notification_outbox (target_section_id);
CREATE INDEX IF NOT EXISTS idx_attendance_branch_id ON public.attendance (branch_id);
CREATE INDEX IF NOT EXISTS idx_registration_codes_child_id ON public.registration_codes (child_id);

ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_status_check;
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'partially_failed'::text, 'failed'::text, 'expired'::text, 'cancelled'::text]));

ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_admins_branch_id ON public.admins (branch_id);

CREATE OR REPLACE FUNCTION public.current_admin_branch_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog', 'public'
AS $$ SELECT a.branch_id FROM public.admins a WHERE a.user_id = (SELECT auth.uid()) AND a.disabled = false LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.can_access_branch(p_branch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog', 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = (SELECT auth.uid()) AND a.disabled = false AND (a.branch_id IS NULL OR a.branch_id = p_branch_id)); $$;

REVOKE ALL ON FUNCTION public.current_admin_branch_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_admin_branch_id() TO authenticated;
REVOKE ALL ON FUNCTION public.can_access_branch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_branch(uuid) TO authenticated;
