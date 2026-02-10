-- Community social schema fix (no-auth mode)
-- Run this in Supabase SQL Editor (safe to run multiple times).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- 1) community_posts
-- =========================
CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  author_name text NOT NULL DEFAULT 'Invite',
  guest_id text NOT NULL DEFAULT '',
  author_device_id text,
  content text NOT NULL DEFAULT '',
  media_url text,
  media_type text,
  kind text NOT NULL DEFAULT 'general',
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS guest_id text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS author_device_id text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS media_type text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS likes_count integer;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS comments_count integer;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.community_posts
SET
  guest_id = COALESCE(guest_id, author_device_id, ''),
  author_device_id = COALESCE(author_device_id, guest_id, ''),
  author_name = COALESCE(NULLIF(author_name, ''), 'Invite'),
  content = COALESCE(content, ''),
  created_at = COALESCE(created_at, now()),
  media_type = NULLIF(TRIM(COALESCE(media_type, '')), ''),
  kind = CASE
    WHEN kind IN ('general', 'prayer', 'help', 'announcement', 'content') THEN kind
    WHEN COALESCE(content, '') ~* '^\[PRIERE\]' THEN 'prayer'
    WHEN COALESCE(content, '') ~* '^\[ENTRAIDE\]' THEN 'help'
    WHEN COALESCE(content, '') ~* '^\[ANNONCE\]' THEN 'announcement'
    WHEN COALESCE(content, '') ~* '^\[CONTENU\]' THEN 'content'
    ELSE 'general'
  END,
  likes_count = GREATEST(COALESCE(likes_count, 0), 0),
  comments_count = GREATEST(COALESCE(comments_count, 0), 0);

ALTER TABLE public.community_posts ALTER COLUMN guest_id SET DEFAULT '';
ALTER TABLE public.community_posts ALTER COLUMN guest_id SET NOT NULL;
ALTER TABLE public.community_posts ALTER COLUMN author_name SET DEFAULT 'Invite';
ALTER TABLE public.community_posts ALTER COLUMN author_name SET NOT NULL;
ALTER TABLE public.community_posts ALTER COLUMN content SET DEFAULT '';
ALTER TABLE public.community_posts ALTER COLUMN content SET NOT NULL;
ALTER TABLE public.community_posts ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.community_posts ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.community_posts ALTER COLUMN kind SET DEFAULT 'general';
ALTER TABLE public.community_posts ALTER COLUMN kind SET NOT NULL;
ALTER TABLE public.community_posts ALTER COLUMN likes_count SET DEFAULT 0;
ALTER TABLE public.community_posts ALTER COLUMN likes_count SET NOT NULL;
ALTER TABLE public.community_posts ALTER COLUMN comments_count SET DEFAULT 0;
ALTER TABLE public.community_posts ALTER COLUMN comments_count SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_posts_kind_check'
  ) THEN
    ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_kind_check
      CHECK (kind IN ('general', 'prayer', 'help', 'announcement', 'content'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS community_posts_created_at_idx
  ON public.community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS community_posts_kind_created_at_idx
  ON public.community_posts (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS community_posts_author_device_id_idx
  ON public.community_posts (author_device_id);
CREATE INDEX IF NOT EXISTS community_posts_guest_id_idx
  ON public.community_posts (guest_id);

-- =========================
-- 2) community_comments
-- =========================
CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  author_name text NOT NULL DEFAULT 'Invite',
  guest_id text NOT NULL DEFAULT '',
  author_device_id text,
  content text NOT NULL DEFAULT ''
);

ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS post_id uuid;
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS guest_id text;
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS author_device_id text;
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS content text;

UPDATE public.community_comments
SET
  guest_id = COALESCE(guest_id, author_device_id, ''),
  author_device_id = COALESCE(author_device_id, guest_id, ''),
  author_name = COALESCE(NULLIF(author_name, ''), 'Invite'),
  content = COALESCE(content, ''),
  created_at = COALESCE(created_at, now());

ALTER TABLE public.community_comments ALTER COLUMN guest_id SET DEFAULT '';
ALTER TABLE public.community_comments ALTER COLUMN guest_id SET NOT NULL;
ALTER TABLE public.community_comments ALTER COLUMN author_name SET DEFAULT 'Invite';
ALTER TABLE public.community_comments ALTER COLUMN author_name SET NOT NULL;
ALTER TABLE public.community_comments ALTER COLUMN content SET DEFAULT '';
ALTER TABLE public.community_comments ALTER COLUMN content SET NOT NULL;
ALTER TABLE public.community_comments ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.community_comments ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_comments_post_id_fkey'
  ) THEN
    ALTER TABLE public.community_comments
      ADD CONSTRAINT community_comments_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS community_comments_post_id_created_at_idx
  ON public.community_comments (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS community_comments_author_device_id_idx
  ON public.community_comments (author_device_id);
CREATE INDEX IF NOT EXISTS community_comments_guest_id_idx
  ON public.community_comments (guest_id);

-- =========================
-- 3) likes table + RPC
-- =========================
CREATE TABLE IF NOT EXISTS public.community_post_likes (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, device_id)
);

CREATE INDEX IF NOT EXISTS community_post_likes_post_id_idx
  ON public.community_post_likes (post_id);

DROP FUNCTION IF EXISTS public.toggle_like(uuid, text);

CREATE FUNCTION public.toggle_like(p_post_id uuid, p_device_id text)
RETURNS TABLE(likes_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_count integer;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.community_post_likes
    WHERE post_id = p_post_id AND device_id = p_device_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.community_post_likes
    WHERE post_id = p_post_id AND device_id = p_device_id;
  ELSE
    INSERT INTO public.community_post_likes(post_id, device_id)
    VALUES (p_post_id, p_device_id)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT COUNT(*)::integer
  INTO v_count
  FROM public.community_post_likes
  WHERE post_id = p_post_id;

  UPDATE public.community_posts
  SET likes_count = COALESCE(v_count, 0)
  WHERE id = p_post_id;

  RETURN QUERY SELECT COALESCE(v_count, 0);
END;
$$;

-- Keep comments_count in sync automatically
CREATE OR REPLACE FUNCTION public.recompute_post_comments_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_post_id uuid;
BEGIN
  v_post_id := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE public.community_posts p
  SET comments_count = (
    SELECT COUNT(*)::integer
    FROM public.community_comments c
    WHERE c.post_id = v_post_id
  )
  WHERE p.id = v_post_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_community_comments_recount_ins ON public.community_comments;
DROP TRIGGER IF EXISTS trg_community_comments_recount_del ON public.community_comments;

CREATE TRIGGER trg_community_comments_recount_ins
AFTER INSERT ON public.community_comments
FOR EACH ROW
EXECUTE FUNCTION public.recompute_post_comments_count();

CREATE TRIGGER trg_community_comments_recount_del
AFTER DELETE ON public.community_comments
FOR EACH ROW
EXECUTE FUNCTION public.recompute_post_comments_count();

-- Force full recount once
UPDATE public.community_posts p
SET comments_count = COALESCE(x.cnt, 0)
FROM (
  SELECT post_id, COUNT(*)::integer AS cnt
  FROM public.community_comments
  GROUP BY post_id
) x
WHERE p.id = x.post_id;

UPDATE public.community_posts
SET comments_count = 0
WHERE id NOT IN (SELECT DISTINCT post_id FROM public.community_comments);

UPDATE public.community_posts p
SET likes_count = COALESCE(x.cnt, 0)
FROM (
  SELECT post_id, COUNT(*)::integer AS cnt
  FROM public.community_post_likes
  GROUP BY post_id
) x
WHERE p.id = x.post_id;

UPDATE public.community_posts
SET likes_count = 0
WHERE id NOT IN (SELECT DISTINCT post_id FROM public.community_post_likes);

-- =========================
-- 4) Permissions + RLS (no-auth mode)
-- =========================
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_posts_select_all ON public.community_posts;
DROP POLICY IF EXISTS community_posts_insert_all ON public.community_posts;
DROP POLICY IF EXISTS community_posts_update_all ON public.community_posts;
DROP POLICY IF EXISTS community_posts_delete_all ON public.community_posts;

CREATE POLICY community_posts_select_all
ON public.community_posts
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY community_posts_insert_all
ON public.community_posts
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY community_posts_update_all
ON public.community_posts
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY community_posts_delete_all
ON public.community_posts
FOR DELETE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS community_comments_select_all ON public.community_comments;
DROP POLICY IF EXISTS community_comments_insert_all ON public.community_comments;
DROP POLICY IF EXISTS community_comments_update_all ON public.community_comments;
DROP POLICY IF EXISTS community_comments_delete_all ON public.community_comments;

CREATE POLICY community_comments_select_all
ON public.community_comments
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY community_comments_insert_all
ON public.community_comments
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY community_comments_update_all
ON public.community_comments
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY community_comments_delete_all
ON public.community_comments
FOR DELETE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS community_post_likes_select_all ON public.community_post_likes;
DROP POLICY IF EXISTS community_post_likes_insert_all ON public.community_post_likes;
DROP POLICY IF EXISTS community_post_likes_delete_all ON public.community_post_likes;

CREATE POLICY community_post_likes_select_all
ON public.community_post_likes
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY community_post_likes_insert_all
ON public.community_post_likes
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY community_post_likes_delete_all
ON public.community_post_likes
FOR DELETE
TO anon, authenticated
USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_comments TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_post_likes TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_like(uuid, text) TO anon, authenticated;

COMMIT;
