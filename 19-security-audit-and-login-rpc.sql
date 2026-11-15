-- ==============================================================================
-- DAR EL IHSAN — 19: SECURITY AUDIT (read-only) + SAFE LOGIN RESOLUTION RPC
-- الجزء أ: استعلامات فحص للقراءة فقط — شغّلها في Supabase SQL Editor وراجع النتائج.
-- الجزء ب: دالة تحوّل رقم الهاتف إلى بريد الدخول من الخادم، بدل قراءة بيانات المربيات قبل تسجيل الدخول.
-- لا يغيّر هذا الملف أي سياسة موجودة ولا يحذف أي بيانات.
-- ==============================================================================

-- ---------- الجزء أ: فحوصات (انسخ كل استعلام وشغّله وحده) ----------

-- A1) كل جدول في public يجب أن يكون RLS مفعّلاً عليه (النتيجة المطلوبة: صفر صفوف)
-- select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
-- where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

-- A2) سياسات تسمح للزائر المجهول (anon) بالوصول: راجع كل سطر وتأكد أنه مقصود (الموقع العام فقط)
-- select tablename, policyname, cmd, roles, qual, with_check from pg_policies
-- where schemaname='public' and (roles::text ilike '%anon%' or roles::text ilike '%public%') order by 1,2;

-- A3) صلاحيات الجداول الممنوحة لـ anon (المطلوب: select على المحتوى العام فقط، وinsert على نماذج التسجيل/الاستفسار فقط)
-- select table_name, string_agg(privilege_type, ',') from information_schema.role_table_grants
-- where table_schema='public' and grantee='anon' group by 1 order by 1;

-- A4) دوال SECURITY DEFINER قابلة للتنفيذ من anon (راجعها: يجب أن تُرجع الحد الأدنى من البيانات)
-- select p.proname, pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
-- where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute');

-- A5) هل صف المسودة site_content (فيه بيانات المربيات: هواتف وبريد) مقروء للزائر؟ (المطلوب: لا)
-- select policyname, roles, qual from pg_policies where schemaname='public' and tablename='site_content';

-- A6) حسابات إدارية معطّلة أو بلا دور، وعدد المالكين (يجب أن يكون صغيراً)
-- select role, is_owner, disabled, count(*) from public.admins group by 1,2,3;

-- A7) سياسات تخزين الملفات: bucket الوثائق الخاصة يجب ألا يكون public
-- select id, name, public from storage.buckets;
-- select policyname, cmd, roles, qual from pg_policies where schemaname='storage' and tablename='objects';

-- ---------- الجزء ب: دالة تحويل معرّف الدخول إلى بريد (من الخادم) ----------
-- تُرجع بريد المربية/المربي المطابق لرقم الهاتف فقط، ولا تكشف أي حقل آخر ولا تعدّد النتائج.
-- الواجهة تستدعيها أولاً، وتعود للطريقة القديمة إذا لم تكن الدالة منشورة (لا ينكسر الدخول).
create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  d text := regexp_replace(coalesce(p_identifier,''), '\D', '', 'g');
  tail9 text;
  found_email text;
begin
  if length(d) < 9 or length(d) > 15 then return null; end if;
  tail9 := right(d, 9);
  select lower(e->>'email') into found_email
  from public.site_content sc,
       lateral jsonb_array_elements(coalesce(sc.data->'_portal_meta'->'educators','[]'::jsonb)) e
  where sc.id = 'draft'
    and right(regexp_replace(coalesce(e->>'phone',''), '\D', '', 'g'), 9) = tail9
    and coalesce(e->>'email','') <> ''
  limit 1;
  return found_email;
end;
$$;
revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- ---------- بعد التأكد أن الدخول يعمل بالدالة (خطوة يدوية لاحقة) ----------
-- إذا أظهر A5 أن صف draft مقروء للزائر، انقل _portal_meta إلى جدول مخصّص للإداريين
-- (مثلاً admin_portal_meta بسياسة select/insert/update للمسؤولين فقط) ثم احذف المفتاح من site_content.
-- لا تنفّذ ذلك قبل اختبار فضاء الأولياء لأنه يقرأ site_content أيضاً.
