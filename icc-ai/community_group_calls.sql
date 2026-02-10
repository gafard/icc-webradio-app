-- Community group call persistence (no-auth mode)
-- Run this in Supabase SQL Editor after community_groups.sql.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- 1) Active call presence
-- =========================
CREATE TABLE IF NOT EXISTS public.community_group_call_presence (
  group_id uuid NOT NULL,
  device_id text NOT NULL DEFAULT '',
  guest_id text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT 'Invite',
  audio_enabled boolean NOT NULL DEFAULT true,
  video_enabled boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  shared_bible_ref text,
  shared_bible_content text,
  PRIMARY KEY (group_id, device_id)
);

ALTER TABLE public.community_group_call_presence ADD COLUMN IF NOT EXISTS guest_id text;
ALTER TABLE public.community_group_call_presence ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.community_group_call_presence ADD COLUMN IF NOT EXISTS audio_enabled boolean;
ALTER TABLE public.community_group_call_presence ADD COLUMN IF NOT EXISTS video_enabled boolean;
ALTER TABLE public.community_group_call_presence ADD COLUMN IF NOT EXISTS joined_at timestamptz;
ALTER TABLE public.community_group_call_presence ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE public.community_group_call_presence ADD COLUMN IF NOT EXISTS shared_bible_ref text;
ALTER TABLE public.community_group_call_presence ADD COLUMN IF NOT EXISTS shared_bible_content text;

UPDATE public.community_group_call_presence
SET
  device_id = COALESCE(NULLIF(device_id, ''), guest_id, ''),
  guest_id = COALESCE(NULLIF(guest_id, ''), device_id, ''),
  display_name = COALESCE(NULLIF(TRIM(COALESCE(display_name, '')), ''), 'Invite'),
  audio_enabled = COALESCE(audio_enabled, true),
  video_enabled = COALESCE(video_enabled, true),
  joined_at = COALESCE(joined_at, now()),
  last_seen_at = COALESCE(last_seen_at, now());

ALTER TABLE public.community_group_call_presence ALTER COLUMN guest_id SET DEFAULT '';
ALTER TABLE public.community_group_call_presence ALTER COLUMN guest_id SET NOT NULL;
ALTER TABLE public.community_group_call_presence ALTER COLUMN display_name SET DEFAULT 'Invite';
ALTER TABLE public.community_group_call_presence ALTER COLUMN display_name SET NOT NULL;
ALTER TABLE public.community_group_call_presence ALTER COLUMN audio_enabled SET DEFAULT true;
ALTER TABLE public.community_group_call_presence ALTER COLUMN audio_enabled SET NOT NULL;
ALTER TABLE public.community_group_call_presence ALTER COLUMN video_enabled SET DEFAULT true;
ALTER TABLE public.community_group_call_presence ALTER COLUMN video_enabled SET NOT NULL;
ALTER TABLE public.community_group_call_presence ALTER COLUMN joined_at SET DEFAULT now();
ALTER TABLE public.community_group_call_presence ALTER COLUMN joined_at SET NOT NULL;
ALTER TABLE public.community_group_call_presence ALTER COLUMN last_seen_at SET DEFAULT now();
ALTER TABLE public.community_group_call_presence ALTER COLUMN last_seen_at SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'community_groups'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_group_call_presence_group_id_fkey'
  ) THEN
    ALTER TABLE public.community_group_call_presence
      ADD CONSTRAINT community_group_call_presence_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES public.community_groups(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.community_group_call_presence_sync_ids()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.device_id := COALESCE(NULLIF(NEW.device_id, ''), NULLIF(NEW.guest_id, ''), '');
  NEW.guest_id := COALESCE(NULLIF(NEW.guest_id, ''), NEW.device_id, '');
  NEW.display_name := COALESCE(NULLIF(TRIM(COALESCE(NEW.display_name, '')), ''), 'Invite');
  NEW.audio_enabled := COALESCE(NEW.audio_enabled, true);
  NEW.video_enabled := COALESCE(NEW.video_enabled, true);
  NEW.joined_at := COALESCE(NEW.joined_at, now());
  NEW.last_seen_at := COALESCE(NEW.last_seen_at, now());
  NEW.shared_bible_ref := NEW.shared_bible_ref;
  NEW.shared_bible_content := NEW.shared_bible_content;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_group_call_presence_sync_ids ON public.community_group_call_presence;
CREATE TRIGGER trg_community_group_call_presence_sync_ids
BEFORE INSERT OR UPDATE ON public.community_group_call_presence
FOR EACH ROW
EXECUTE FUNCTION public.community_group_call_presence_sync_ids();

CREATE INDEX IF NOT EXISTS community_group_call_presence_group_last_seen_idx
  ON public.community_group_call_presence (group_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS community_group_call_presence_device_idx
  ON public.community_group_call_presence (device_id);
CREATE INDEX IF NOT EXISTS community_group_call_presence_guest_idx
  ON public.community_group_call_presence (guest_id);

-- =========================
-- 2) Call events log
-- =========================
CREATE TABLE IF NOT EXISTS public.community_group_call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  device_id text NOT NULL DEFAULT '',
  guest_id text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT 'Invite',
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_group_call_events ADD COLUMN IF NOT EXISTS guest_id text;
ALTER TABLE public.community_group_call_events ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.community_group_call_events ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE public.community_group_call_events ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.community_group_call_events
SET
  device_id = COALESCE(NULLIF(device_id, ''), guest_id, ''),
  guest_id = COALESCE(NULLIF(guest_id, ''), device_id, ''),
  display_name = COALESCE(NULLIF(TRIM(COALESCE(display_name, '')), ''), 'Invite'),
  event_type = CASE
    WHEN event_type IN ('join', 'leave', 'mute', 'unmute', 'video_on', 'video_off', 'mode_audio', 'mode_video', 'error') THEN event_type
    ELSE 'error'
  END,
  payload = COALESCE(payload, '{}'::jsonb),
  created_at = COALESCE(created_at, now());

ALTER TABLE public.community_group_call_events ALTER COLUMN guest_id SET DEFAULT '';
ALTER TABLE public.community_group_call_events ALTER COLUMN guest_id SET NOT NULL;
ALTER TABLE public.community_group_call_events ALTER COLUMN display_name SET DEFAULT 'Invite';
ALTER TABLE public.community_group_call_events ALTER COLUMN display_name SET NOT NULL;
ALTER TABLE public.community_group_call_events ALTER COLUMN payload SET DEFAULT '{}'::jsonb;
ALTER TABLE public.community_group_call_events ALTER COLUMN payload SET NOT NULL;
ALTER TABLE public.community_group_call_events ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.community_group_call_events ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_group_call_events_type_check'
  ) THEN
    ALTER TABLE public.community_group_call_events
      ADD CONSTRAINT community_group_call_events_type_check
      CHECK (event_type IN ('join', 'leave', 'mute', 'unmute', 'video_on', 'video_off', 'mode_audio', 'mode_video', 'error'));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'community_groups'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_group_call_events_group_id_fkey'
  ) THEN
    ALTER TABLE public.community_group_call_events
      ADD CONSTRAINT community_group_call_events_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES public.community_groups(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS community_group_call_events_group_created_at_idx
  ON public.community_group_call_events (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_group_call_events_event_type_idx
  ON public.community_group_call_events (event_type, created_at DESC);

-- =========================
-- 3) RLS + grants
-- =========================
ALTER TABLE public.community_group_call_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_call_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_group_call_presence_select_all ON public.community_group_call_presence;
DROP POLICY IF EXISTS community_group_call_presence_insert_all ON public.community_group_call_presence;
DROP POLICY IF EXISTS community_group_call_presence_update_all ON public.community_group_call_presence;
DROP POLICY IF EXISTS community_group_call_presence_delete_all ON public.community_group_call_presence;

CREATE POLICY community_group_call_presence_select_all
ON public.community_group_call_presence
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY community_group_call_presence_insert_all
ON public.community_group_call_presence
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY community_group_call_presence_update_all
ON public.community_group_call_presence
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY community_group_call_presence_delete_all
ON public.community_group_call_presence
FOR DELETE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS community_group_call_events_select_all ON public.community_group_call_events;
DROP POLICY IF EXISTS community_group_call_events_insert_all ON public.community_group_call_events;

CREATE POLICY community_group_call_events_select_all
ON public.community_group_call_events
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY community_group_call_events_insert_all
ON public.community_group_call_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_group_call_presence TO anon, authenticated;
GRANT SELECT, INSERT ON public.community_group_call_events TO anon, authenticated;

COMMIT;
