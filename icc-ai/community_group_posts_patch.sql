-- Optional patch: attach community posts to groups
-- Run after community_social_fix.sql and community_groups.sql.

BEGIN;

ALTER TABLE IF EXISTS public.community_posts
  ADD COLUMN IF NOT EXISTS group_id uuid;

CREATE INDEX IF NOT EXISTS community_posts_group_id_created_at_idx
  ON public.community_posts (group_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'community_posts'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'community_groups'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'community_posts_group_id_fkey'
    ) THEN
      ALTER TABLE public.community_posts
        ADD CONSTRAINT community_posts_group_id_fkey
        FOREIGN KEY (group_id) REFERENCES public.community_groups(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

COMMIT;
