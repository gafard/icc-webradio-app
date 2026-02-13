-- Admin/Moderation V1
-- Apply this script in Supabase SQL Editor.

begin;

-- ------------------------------------------------------------------
-- 1) Community posts: soft-moderation columns
-- ------------------------------------------------------------------
alter table if exists public.community_posts
  add column if not exists visibility text not null default 'public',
  add column if not exists moderation_status text not null default 'clean',
  add column if not exists reported_count integer not null default 0,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

create index if not exists idx_community_posts_visibility
  on public.community_posts (visibility);
create index if not exists idx_community_posts_moderation_status
  on public.community_posts (moderation_status);
create index if not exists idx_community_posts_reported_count
  on public.community_posts (reported_count desc, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'community_posts_visibility_check'
  ) then
    alter table public.community_posts
      add constraint community_posts_visibility_check
      check (visibility in ('public', 'hidden', 'removed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'community_posts_moderation_status_check'
  ) then
    alter table public.community_posts
      add constraint community_posts_moderation_status_check
      check (moderation_status in ('clean', 'flagged', 'under_review', 'actioned'));
  end if;
end $$;

-- ------------------------------------------------------------------
-- 2) Moderation core tables
-- ------------------------------------------------------------------
create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_roles_role_check'
  ) then
    alter table public.admin_roles
      add constraint admin_roles_role_check
      check (role in ('admin', 'moderator', 'viewer'));
  end if;
end $$;

create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  message text,
  reporter_user_id uuid references auth.users(id),
  reporter_device_id text,
  created_at timestamptz not null default now(),
  status text not null default 'open'
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'moderation_reports_target_type_check'
  ) then
    alter table public.moderation_reports
      add constraint moderation_reports_target_type_check
      check (target_type in ('post', 'comment', 'group'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'moderation_reports_status_check'
  ) then
    alter table public.moderation_reports
      add constraint moderation_reports_status_check
      check (status in ('open', 'triaged', 'closed'));
  end if;
end $$;

create index if not exists idx_moderation_reports_status
  on public.moderation_reports (status);
create index if not exists idx_moderation_reports_target
  on public.moderation_reports (target_type, target_id);
create index if not exists idx_moderation_reports_created_at
  on public.moderation_reports (created_at desc);

create or replace function public.moderation_reports_sync_post_counts()
returns trigger
language plpgsql
as $$
declare
  affected_target uuid;
  affected_type text;
  open_count integer;
begin
  if tg_op = 'DELETE' then
    affected_target := old.target_id;
    affected_type := old.target_type;
  elsif tg_op = 'UPDATE' then
    affected_target := coalesce(new.target_id, old.target_id);
    affected_type := coalesce(new.target_type, old.target_type);
  else
    affected_target := new.target_id;
    affected_type := new.target_type;
  end if;

  if affected_target is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if affected_type <> 'post' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select count(*)::integer
  into open_count
  from public.moderation_reports
  where target_type = 'post'
    and target_id = affected_target
    and status in ('open', 'triaged');

  update public.community_posts
  set
    reported_count = coalesce(open_count, 0),
    moderation_status = case
      when coalesce(open_count, 0) = 0 and moderation_status in ('flagged', 'under_review')
        then 'clean'
      when coalesce(open_count, 0) > 0 and moderation_status = 'clean'
        then 'flagged'
      else moderation_status
    end
  where id = affected_target;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_moderation_reports_sync_post_counts_ins on public.moderation_reports;
drop trigger if exists trg_moderation_reports_sync_post_counts_upd on public.moderation_reports;
drop trigger if exists trg_moderation_reports_sync_post_counts_del on public.moderation_reports;

create trigger trg_moderation_reports_sync_post_counts_ins
after insert on public.moderation_reports
for each row
execute function public.moderation_reports_sync_post_counts();

create trigger trg_moderation_reports_sync_post_counts_upd
after update of status on public.moderation_reports
for each row
execute function public.moderation_reports_sync_post_counts();

create trigger trg_moderation_reports_sync_post_counts_del
after delete on public.moderation_reports
for each row
execute function public.moderation_reports_sync_post_counts();

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id text not null,
  action text not null,
  reason text,
  note text,
  admin_user_id uuid references auth.users(id),
  admin_actor text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_moderation_actions_target
  on public.moderation_actions (target_type, target_id);
create index if not exists idx_moderation_actions_admin
  on public.moderation_actions (admin_user_id);
create index if not exists idx_moderation_actions_created_at
  on public.moderation_actions (created_at desc);

create table if not exists public.blocked_devices (
  device_id text primary key,
  status text not null default 'banned',
  until_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'blocked_devices_status_check'
  ) then
    alter table public.blocked_devices
      add constraint blocked_devices_status_check
      check (status in ('banned', 'suspended'));
  end if;
end $$;

-- ------------------------------------------------------------------
-- 3) RLS helper + policies
-- ------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_roles r
    where r.user_id = auth.uid()
  );
$$;

alter table public.admin_roles enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.blocked_devices enable row level security;
alter table if exists public.community_posts enable row level security;

drop policy if exists admin_roles_select_admin on public.admin_roles;
drop policy if exists admin_roles_manage_admin on public.admin_roles;

create policy admin_roles_select_admin
on public.admin_roles
for select
using (public.is_admin());

create policy admin_roles_manage_admin
on public.admin_roles
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists moderation_reports_insert_any on public.moderation_reports;
drop policy if exists moderation_reports_select_admin on public.moderation_reports;
drop policy if exists moderation_reports_update_admin on public.moderation_reports;
drop policy if exists moderation_reports_delete_admin on public.moderation_reports;

create policy moderation_reports_insert_any
on public.moderation_reports
for insert
to anon, authenticated
with check (true);

create policy moderation_reports_select_admin
on public.moderation_reports
for select
using (public.is_admin());

create policy moderation_reports_update_admin
on public.moderation_reports
for update
using (public.is_admin())
with check (public.is_admin());

create policy moderation_reports_delete_admin
on public.moderation_reports
for delete
using (public.is_admin());

drop policy if exists moderation_actions_all_admin on public.moderation_actions;
create policy moderation_actions_all_admin
on public.moderation_actions
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists blocked_devices_all_admin on public.blocked_devices;
create policy blocked_devices_all_admin
on public.blocked_devices
for all
using (public.is_admin())
with check (public.is_admin());

-- Replace broad read policy with visibility-filtered read.
drop policy if exists community_posts_select_all on public.community_posts;
drop policy if exists community_posts_select_visible on public.community_posts;
drop policy if exists community_posts_select_admin on public.community_posts;
drop policy if exists community_posts_update_admin on public.community_posts;
drop policy if exists community_posts_delete_admin on public.community_posts;

create policy community_posts_select_visible
on public.community_posts
for select
to anon, authenticated
using (coalesce(visibility, 'public') = 'public');

create policy community_posts_select_admin
on public.community_posts
for select
using (public.is_admin());

create policy community_posts_update_admin
on public.community_posts
for update
using (public.is_admin())
with check (public.is_admin());

create policy community_posts_delete_admin
on public.community_posts
for delete
using (public.is_admin());

grant select on public.admin_roles to authenticated;
grant select, insert on public.moderation_reports to anon, authenticated;
grant select on public.moderation_reports to authenticated;
grant select on public.moderation_actions to authenticated;
grant select on public.blocked_devices to authenticated;

commit;
