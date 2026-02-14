-- Admin Analytics V1
-- Apply after icc-ai/admin_moderation_v1.sql (requires public.is_admin()).

begin;

create table if not exists public.app_page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  referrer text,
  locale text,
  device_id text,
  session_id text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_page_views_created_at
  on public.app_page_views (created_at desc);
create index if not exists idx_app_page_views_path_created_at
  on public.app_page_views (path, created_at desc);
create index if not exists idx_app_page_views_device_created_at
  on public.app_page_views (device_id, created_at desc);
create index if not exists idx_app_page_views_session_created_at
  on public.app_page_views (session_id, created_at desc);

alter table public.app_page_views enable row level security;

drop policy if exists app_page_views_insert_all on public.app_page_views;
drop policy if exists app_page_views_select_admin on public.app_page_views;
drop policy if exists app_page_views_delete_admin on public.app_page_views;

-- Public tracking insert.
create policy app_page_views_insert_all
on public.app_page_views
for insert
to anon, authenticated
with check (
  char_length(coalesce(path, '')) > 0
  and char_length(coalesce(path, '')) <= 240
);

-- Admin reads analytics through is_admin().
create policy app_page_views_select_admin
on public.app_page_views
for select
to authenticated
using (public.is_admin());

create policy app_page_views_delete_admin
on public.app_page_views
for delete
to authenticated
using (public.is_admin());

grant insert on public.app_page_views to anon, authenticated;
grant select, delete on public.app_page_views to authenticated;

commit;
