-- Script de déploiement COMPLET et ROBUSTE pour les appels de groupe
-- Gère la création des tables, les colonnes bibliques et les politiques RLS sans erreur de syntaxe.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Table Active Presence
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

-- Assurer la présence des colonnes si la table existait déjà dans une version ancienne
ALTER TABLE public.community_group_call_presence ADD COLUMN IF NOT EXISTS shared_bible_ref text;
ALTER TABLE public.community_group_call_presence ADD COLUMN IF NOT EXISTS shared_bible_content text;

-- 2) Table Call Events
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

-- 3) RLS & Politiques (Syntaxe compatible Supabase/Postgres)
ALTER TABLE public.community_group_call_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_call_events ENABLE ROW LEVEL SECURITY;

-- Nettoyage des anciennes politiques pour éviter les doublons ou conflits
DO $$ 
BEGIN
    -- Presence
    DROP POLICY IF EXISTS community_group_call_presence_select_all ON public.community_group_call_presence;
    DROP POLICY IF EXISTS community_group_call_presence_insert_all ON public.community_group_call_presence;
    DROP POLICY IF EXISTS community_group_call_presence_update_all ON public.community_group_call_presence;
    DROP POLICY IF EXISTS community_group_call_presence_delete_all ON public.community_group_call_presence;
    DROP POLICY IF EXISTS "Tout le monde peut voir la présence" ON public.community_group_call_presence;
    
    -- Events
    DROP POLICY IF EXISTS community_group_call_events_select_all ON public.community_group_call_events;
    DROP POLICY IF EXISTS community_group_call_events_insert_all ON public.community_group_call_events;
END $$;

-- Création des politiques
CREATE POLICY community_group_call_presence_select_all ON public.community_group_call_presence FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY community_group_call_presence_insert_all ON public.community_group_call_presence FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY community_group_call_presence_update_all ON public.community_group_call_presence FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY community_group_call_presence_delete_all ON public.community_group_call_presence FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY community_group_call_events_select_all ON public.community_group_call_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY community_group_call_events_insert_all ON public.community_group_call_events FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 4) Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_group_call_presence TO anon, authenticated;
GRANT SELECT, INSERT ON public.community_group_call_events TO anon, authenticated;

COMMIT;
