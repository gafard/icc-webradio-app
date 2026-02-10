-- Community groups schema (no-auth mode)
-- Run in Supabase SQL Editor.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.community_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  group_type text NOT NULL DEFAULT 'general',
  created_by_name text NOT NULL DEFAULT 'Invite',
  created_by_device_id text NOT NULL DEFAULT '',
  call_provider text,
  call_link text,
  next_call_at timestamptz
);

ALTER TABLE public.community_groups ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.community_groups ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.community_groups ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.community_groups ADD COLUMN IF NOT EXISTS group_type text;
ALTER TABLE public.community_groups ADD COLUMN IF NOT EXISTS created_by_name text;
ALTER TABLE public.community_groups ADD COLUMN IF NOT EXISTS created_by_device_id text;
ALTER TABLE public.community_groups ADD COLUMN IF NOT EXISTS call_provider text;
ALTER TABLE public.community_groups ADD COLUMN IF NOT EXISTS call_link text;
ALTER TABLE public.community_groups ADD COLUMN IF NOT EXISTS next_call_at timestamptz;

UPDATE public.community_groups
SET
  created_at = COALESCE(created_at, now()),
  name = COALESCE(NULLIF(TRIM(name), ''), 'Groupe'),
  description = COALESCE(description, ''),
  group_type = CASE
    WHEN group_type IN ('general', 'prayer', 'study', 'support') THEN group_type
    ELSE 'general'
  END,
  created_by_name = COALESCE(NULLIF(TRIM(created_by_name), ''), 'Invite'),
  created_by_device_id = COALESCE(created_by_device_id, ''),
  call_provider = CASE
    WHEN call_provider IN ('google_meet', 'facetime', 'skype', 'other') THEN call_provider
    ELSE NULL
  END,
  call_link = NULLIF(TRIM(COALESCE(call_link, '')), '');

ALTER TABLE public.community_groups ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.community_groups ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.community_groups ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.community_groups ALTER COLUMN description SET DEFAULT '';
ALTER TABLE public.community_groups ALTER COLUMN description SET NOT NULL;
ALTER TABLE public.community_groups ALTER COLUMN group_type SET DEFAULT 'general';
ALTER TABLE public.community_groups ALTER COLUMN group_type SET NOT NULL;
ALTER TABLE public.community_groups ALTER COLUMN created_by_name SET DEFAULT 'Invite';
ALTER TABLE public.community_groups ALTER COLUMN created_by_name SET NOT NULL;
ALTER TABLE public.community_groups ALTER COLUMN created_by_device_id SET DEFAULT '';
ALTER TABLE public.community_groups ALTER COLUMN created_by_device_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_groups_type_check'
  ) THEN
    ALTER TABLE public.community_groups
      ADD CONSTRAINT community_groups_type_check
      CHECK (group_type IN ('general', 'prayer', 'study', 'support'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_groups_provider_check'
  ) THEN
    ALTER TABLE public.community_groups
      ADD CONSTRAINT community_groups_provider_check
      CHECK (
        call_provider IS NULL OR
        call_provider IN ('google_meet', 'facetime', 'skype', 'other')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS community_groups_created_at_idx
  ON public.community_groups (created_at DESC);
CREATE INDEX IF NOT EXISTS community_groups_type_created_at_idx
  ON public.community_groups (group_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_group_members (
  group_id uuid NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  device_id text NOT NULL DEFAULT '',
  guest_id text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT 'Invite',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, device_id)
);

ALTER TABLE public.community_group_members ADD COLUMN IF NOT EXISTS guest_id text;
ALTER TABLE public.community_group_members ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.community_group_members ADD COLUMN IF NOT EXISTS joined_at timestamptz;

UPDATE public.community_group_members
SET
  device_id = COALESCE(NULLIF(device_id, ''), guest_id, ''),
  guest_id = COALESCE(NULLIF(guest_id, ''), device_id, ''),
  display_name = COALESCE(NULLIF(TRIM(display_name), ''), 'Invite'),
  joined_at = COALESCE(joined_at, now());

ALTER TABLE public.community_group_members ALTER COLUMN guest_id SET DEFAULT '';
ALTER TABLE public.community_group_members ALTER COLUMN guest_id SET NOT NULL;
ALTER TABLE public.community_group_members ALTER COLUMN display_name SET DEFAULT 'Invite';
ALTER TABLE public.community_group_members ALTER COLUMN display_name SET NOT NULL;
ALTER TABLE public.community_group_members ALTER COLUMN joined_at SET DEFAULT now();
ALTER TABLE public.community_group_members ALTER COLUMN joined_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.community_group_members_sync_ids()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.device_id := COALESCE(NULLIF(NEW.device_id, ''), NULLIF(NEW.guest_id, ''), '');
  NEW.guest_id := COALESCE(NULLIF(NEW.guest_id, ''), NEW.device_id, '');
  NEW.display_name := COALESCE(NULLIF(TRIM(COALESCE(NEW.display_name, '')), ''), 'Invite');
  NEW.joined_at := COALESCE(NEW.joined_at, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_group_members_sync_ids ON public.community_group_members;
CREATE TRIGGER trg_community_group_members_sync_ids
BEFORE INSERT OR UPDATE ON public.community_group_members
FOR EACH ROW
EXECUTE FUNCTION public.community_group_members_sync_ids();

CREATE INDEX IF NOT EXISTS community_group_members_group_idx
  ON public.community_group_members (group_id, joined_at ASC);
CREATE INDEX IF NOT EXISTS community_group_members_device_idx
  ON public.community_group_members (device_id);
CREATE INDEX IF NOT EXISTS community_group_members_guest_idx
  ON public.community_group_members (guest_id);

ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_groups_select_all ON public.community_groups;
DROP POLICY IF EXISTS community_groups_insert_all ON public.community_groups;
DROP POLICY IF EXISTS community_groups_update_all ON public.community_groups;
DROP POLICY IF EXISTS community_groups_delete_all ON public.community_groups;

CREATE POLICY community_groups_select_all
ON public.community_groups
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY community_groups_insert_all
ON public.community_groups
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY community_groups_update_all
ON public.community_groups
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY community_groups_delete_all
ON public.community_groups
FOR DELETE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS community_group_members_select_all ON public.community_group_members;
DROP POLICY IF EXISTS community_group_members_insert_all ON public.community_group_members;
DROP POLICY IF EXISTS community_group_members_delete_all ON public.community_group_members;

CREATE POLICY community_group_members_select_all
ON public.community_group_members
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY community_group_members_insert_all
ON public.community_group_members
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY community_group_members_delete_all
ON public.community_group_members
FOR DELETE
TO anon, authenticated
USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_groups TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_group_members TO anon, authenticated;

COMMIT;
