-- Migration: add structured category for community posts.
-- Safe to run multiple times.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'community_posts'
  ) THEN
    ALTER TABLE public.community_posts
      ADD COLUMN IF NOT EXISTS kind TEXT;
  END IF;
END $$;

-- Backfill kind from legacy content prefixes.
UPDATE public.community_posts
SET kind = CASE
  WHEN content ~* '^\[PRIERE\]' THEN 'prayer'
  WHEN content ~* '^\[ENTRAIDE\]' THEN 'help'
  WHEN content ~* '^\[ANNONCE\]' THEN 'announcement'
  WHEN content ~* '^\[CONTENU\]' THEN 'content'
  ELSE COALESCE(NULLIF(kind, ''), 'general')
END
WHERE kind IS NULL
   OR kind = ''
   OR kind = 'general';

-- Remove legacy prefixes from content after kind backfill.
UPDATE public.community_posts
SET content = LTRIM(
  REGEXP_REPLACE(
    content,
    '^\[(PRIERE|ENTRAIDE|ANNONCE|CONTENU)\]\s*',
    '',
    'i'
  )
)
WHERE content ~* '^\[(PRIERE|ENTRAIDE|ANNONCE|CONTENU)\]';

ALTER TABLE public.community_posts
  ALTER COLUMN kind SET DEFAULT 'general';

UPDATE public.community_posts
SET kind = 'general'
WHERE kind IS NULL OR kind = '';

ALTER TABLE public.community_posts
  ALTER COLUMN kind SET NOT NULL;

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

CREATE INDEX IF NOT EXISTS community_posts_kind_created_at_idx
  ON public.community_posts(kind, created_at DESC);
