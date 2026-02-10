-- Web Push subscriptions (no-auth mode)
-- Run in Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint text PRIMARY KEY,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_id text,
  locale text,
  subscription_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS endpoint text;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS p256dh text;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS auth text;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS device_id text;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS locale text;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS subscription_json jsonb;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.push_subscriptions
SET
  p256dh = COALESCE(p256dh, ''),
  auth = COALESCE(auth, ''),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.push_subscriptions ALTER COLUMN p256dh SET NOT NULL;
ALTER TABLE public.push_subscriptions ALTER COLUMN auth SET NOT NULL;
ALTER TABLE public.push_subscriptions ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.push_subscriptions ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.push_subscriptions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.push_subscriptions ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS push_subscriptions_device_id_idx
  ON public.push_subscriptions (device_id);

CREATE INDEX IF NOT EXISTS push_subscriptions_updated_at_idx
  ON public.push_subscriptions (updated_at DESC);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select_all ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_insert_all ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_update_all ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_delete_all ON public.push_subscriptions;

CREATE POLICY push_subscriptions_select_all
ON public.push_subscriptions
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY push_subscriptions_insert_all
ON public.push_subscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY push_subscriptions_update_all
ON public.push_subscriptions
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY push_subscriptions_delete_all
ON public.push_subscriptions
FOR DELETE
TO anon, authenticated
USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;

COMMIT;
