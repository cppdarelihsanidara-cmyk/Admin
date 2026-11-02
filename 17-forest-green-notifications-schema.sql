-- ==============================================================================
-- DAR EL IHSAN — FOREST GREEN PREMIUM & REALTIME NOTIFICATIONS MIGRATION (v22.0)
-- نظام الإشعارات المركزي التفاعلي، إدارة الصلاحيات RLS، والتكامل السحابي
-- ==============================================================================

-- 1. جدول الإشعارات المركزي (notifications)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references auth.users(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  audience text default 'admin' check (audience in ('admin', 'parent', 'all')),
  category text default 'general' check (category in ('general', 'attendance', 'messages', 'reports', 'docs', 'programs', 'system')),
  title text not null,
  body text not null,
  notification_type text default 'general',
  related_record_id uuid,
  related_url text default '',
  is_read boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_notif_audience on public.notifications(audience, is_read);
create index if not exists idx_notif_category on public.notifications(category);
create index if not exists idx_notif_created on public.notifications(created_at desc);
create index if not exists idx_notif_child on public.notifications(child_id);

-- 2. جدول سجل تسليم الإشعارات (notification_delivery_logs)
create table if not exists public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete cascade,
  subscription_id uuid,
  delivery_status text default 'sent' check (delivery_status in ('pending', 'sent', 'failed')),
  error_message text default '',
  attempts int default 1,
  sent_at timestamptz default now()
);

-- 3. تفعيل Realtime على جدول الإشعارات
alter publication supabase_realtime add table public.notifications;

-- 4. سياسات الحماية RLS للإشعارات
alter table public.notifications enable row level security;
alter table public.notification_delivery_logs enable row level security;

-- الإدارة ترى كافة الإشعارات الإدارية والعامة
create policy "Staff can view admin notifications"
  on public.notifications for select
  using (
    auth.role() = 'authenticated' and
    (audience in ('admin', 'all') or recipient_user_id = auth.uid())
  );

create policy "Staff can insert notifications"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');

create policy "Staff can update notifications"
  on public.notifications for update
  using (auth.role() = 'authenticated');

create policy "Staff can delete notifications"
  on public.notifications for delete
  using (auth.role() = 'authenticated');

-- الأولياء يرون الإشعارات الخاصة بأطفالهم فقط
create policy "Parents view own child notifications"
  on public.notifications for select
  using (
    auth.role() = 'authenticated' and
    audience in ('parent', 'all') and
    (recipient_user_id = auth.uid() or child_id in (
      select c.id from public.children c
      join public.parent_children pc on pc.child_id = c.id
      where pc.parent_id = auth.uid()
    ))
  );
