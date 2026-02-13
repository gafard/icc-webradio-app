-- Admin/Moderation V2
-- Apply this script in Supabase SQL Editor after V1.

begin;

-- ------------------------------------------------------------------
-- 1) Moderation cases (1 case = 1 target)
-- ------------------------------------------------------------------
create table if not exists public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id text not null,
  status text not null default 'open',
  risk_score integer not null default 0,
  reports_count integer not null default 0,
  last_reported_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_type, target_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'moderation_cases_target_type_check'
  ) then
    alter table public.moderation_cases
      add constraint moderation_cases_target_type_check
      check (target_type in ('post', 'comment', 'group', 'user'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'moderation_cases_status_check'
  ) then
    alter table public.moderation_cases
      add constraint moderation_cases_status_check
      check (status in ('open', 'reviewing', 'actioned', 'dismissed'));
  end if;
end $$;

create index if not exists idx_moderation_cases_status
  on public.moderation_cases (status);
create index if not exists idx_moderation_cases_risk
  on public.moderation_cases (risk_score desc, last_reported_at desc);
create index if not exists idx_moderation_cases_assigned_to
  on public.moderation_cases (assigned_to);

-- ------------------------------------------------------------------
-- 2) Add V2 links on reports/actions
-- ------------------------------------------------------------------
alter table if exists public.moderation_reports
  add column if not exists case_id uuid references public.moderation_cases(id) on delete set null,
  add column if not exists details text;

alter table if exists public.moderation_actions
  add column if not exists case_id uuid references public.moderation_cases(id) on delete set null;

-- Keep compatibility with V1 statuses while enabling V2 statuses.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'moderation_reports_status_check'
  ) then
    alter table public.moderation_reports
      drop constraint moderation_reports_status_check;
  end if;

  alter table public.moderation_reports
    add constraint moderation_reports_status_check
    check (status in ('open', 'triaged', 'closed', 'merged', 'dismissed'));
end $$;

create index if not exists idx_moderation_reports_case_id
  on public.moderation_reports (case_id);
create index if not exists idx_moderation_actions_case_id
  on public.moderation_actions (case_id);

-- ------------------------------------------------------------------
-- 3) Content moderation state (posts)
-- ------------------------------------------------------------------
alter table if exists public.community_posts
  add column if not exists visibility text not null default 'public',
  add column if not exists moderation_status text not null default 'clean',
  add column if not exists reported_count integer not null default 0,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'community_posts_moderation_status_check'
  ) then
    alter table public.community_posts
      drop constraint community_posts_moderation_status_check;
  end if;

  alter table public.community_posts
    add constraint community_posts_moderation_status_check
    check (moderation_status in ('clean', 'flagged', 'reviewing', 'under_review', 'actioned'));
end $$;

-- ------------------------------------------------------------------
-- 4) Risk score + case sync from reports
-- ------------------------------------------------------------------
create or replace function public.moderation_compute_risk(
  report_count integer,
  severe_count integer,
  last_reported_at timestamptz
)
returns integer
language plpgsql
stable
as $$
declare
  score integer := 0;
  age_hours numeric;
begin
  score := score + greatest(coalesce(report_count, 0), 0) * 10;
  score := score + greatest(coalesce(severe_count, 0), 0) * 8;

  if last_reported_at is not null then
    age_hours := extract(epoch from (now() - last_reported_at)) / 3600.0;
    if age_hours <= 1 then
      score := score + 10;
    elsif age_hours <= 24 then
      score := score + 6;
    end if;
  end if;

  return score;
end;
$$;

create or replace function public.moderation_sync_case()
returns trigger
language plpgsql
as $$
declare
  t_type text;
  t_id text;
  c_id uuid;
  open_count integer := 0;
  severe_count integer := 0;
  last_open_report timestamptz;
  next_status text := 'open';
begin
  if tg_op = 'DELETE' then
    t_type := old.target_type;
    t_id := old.target_id::text;
  else
    t_type := new.target_type;
    t_id := new.target_id::text;
  end if;

  if t_type is null or t_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select id
    into c_id
  from public.moderation_cases
  where target_type = t_type
    and target_id = t_id
  limit 1;

  select
    count(*)::integer,
    count(*) filter (
      where reason in ('illegal', 'nudity', 'violence')
    )::integer,
    max(created_at)
  into
    open_count,
    severe_count,
    last_open_report
  from public.moderation_reports
  where target_type = t_type
    and target_id::text = t_id
    and status = 'open';

  if c_id is null and open_count > 0 then
    insert into public.moderation_cases (
      target_type,
      target_id,
      status,
      reports_count,
      risk_score,
      last_reported_at,
      created_at,
      updated_at
    )
    values (
      t_type,
      t_id,
      'open',
      open_count,
      public.moderation_compute_risk(open_count, severe_count, last_open_report),
      last_open_report,
      now(),
      now()
    )
    returning id into c_id;
  end if;

  if c_id is not null then
    if open_count = 0 then
      select status
        into next_status
      from public.moderation_cases
      where id = c_id;

      if next_status in ('open', 'reviewing') then
        next_status := 'dismissed';
      end if;
    else
      select status
        into next_status
      from public.moderation_cases
      where id = c_id;

      if next_status in ('dismissed', 'actioned') then
        next_status := 'open';
      end if;
    end if;

    update public.moderation_cases
    set
      reports_count = open_count,
      risk_score = public.moderation_compute_risk(open_count, severe_count, last_open_report),
      last_reported_at = last_open_report,
      status = next_status,
      updated_at = now()
    where id = c_id;

    update public.moderation_reports
    set case_id = c_id
    where target_type = t_type
      and target_id::text = t_id
      and case_id is distinct from c_id;
  end if;

  if t_type = 'post' then
    update public.community_posts
    set
      reported_count = open_count,
      moderation_status = case
        when open_count > 0 and moderation_status = 'clean' then 'flagged'
        when open_count = 0 and moderation_status in ('flagged', 'reviewing', 'under_review') then 'clean'
        else moderation_status
      end
    where id::text = t_id;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_moderation_sync_case_insert on public.moderation_reports;
drop trigger if exists trg_moderation_sync_case_update on public.moderation_reports;
drop trigger if exists trg_moderation_sync_case_delete on public.moderation_reports;

create trigger trg_moderation_sync_case_insert
after insert on public.moderation_reports
for each row
execute function public.moderation_sync_case();

create trigger trg_moderation_sync_case_update
after update of status, reason, target_type, target_id on public.moderation_reports
for each row
execute function public.moderation_sync_case();

create trigger trg_moderation_sync_case_delete
after delete on public.moderation_reports
for each row
execute function public.moderation_sync_case();

-- ------------------------------------------------------------------
-- 5) RLS: moderation_cases
-- ------------------------------------------------------------------
alter table public.moderation_cases enable row level security;

drop policy if exists moderation_cases_select_admin on public.moderation_cases;
drop policy if exists moderation_cases_manage_admin on public.moderation_cases;

create policy moderation_cases_select_admin
on public.moderation_cases
for select
using (public.is_admin());

create policy moderation_cases_manage_admin
on public.moderation_cases
for all
using (public.is_admin())
with check (public.is_admin());

grant select on public.moderation_cases to authenticated;

-- ------------------------------------------------------------------
-- 6) Community posts: lock announcements to admins only
-- ------------------------------------------------------------------
alter table if exists public.community_posts enable row level security;

drop policy if exists community_posts_insert_all on public.community_posts;
drop policy if exists community_posts_update_all on public.community_posts;
drop policy if exists community_posts_delete_all on public.community_posts;

drop policy if exists community_posts_insert_non_announcement on public.community_posts;
drop policy if exists community_posts_insert_announcement_admin on public.community_posts;
drop policy if exists community_posts_update_non_announcement on public.community_posts;
drop policy if exists community_posts_update_announcement_admin on public.community_posts;
drop policy if exists community_posts_delete_non_announcement on public.community_posts;
drop policy if exists community_posts_delete_announcement_admin on public.community_posts;

drop policy if exists community_posts_update_admin on public.community_posts;
drop policy if exists community_posts_delete_admin on public.community_posts;

-- Everyone can create non-announcement posts.
create policy community_posts_insert_non_announcement
on public.community_posts
for insert
to anon, authenticated
with check (coalesce(kind, 'general') <> 'announcement');

-- Only admins can create announcement posts.
create policy community_posts_insert_announcement_admin
on public.community_posts
for insert
to authenticated
with check (
  coalesce(kind, 'general') = 'announcement'
  and public.is_admin()
);

-- Non-admin users can update only non-announcement rows and cannot convert to announcement.
create policy community_posts_update_non_announcement
on public.community_posts
for update
to anon, authenticated
using (coalesce(kind, 'general') <> 'announcement')
with check (coalesce(kind, 'general') <> 'announcement');

-- Admins can update any post (including announcement).
create policy community_posts_update_announcement_admin
on public.community_posts
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Non-admin users can delete only non-announcement rows.
create policy community_posts_delete_non_announcement
on public.community_posts
for delete
to anon, authenticated
using (coalesce(kind, 'general') <> 'announcement');

-- Admins can delete any post.
create policy community_posts_delete_announcement_admin
on public.community_posts
for delete
to authenticated
using (public.is_admin());

commit;
