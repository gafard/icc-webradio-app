CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY,
  post_key TEXT NOT NULL,
  author TEXT NOT NULL,
  message TEXT NOT NULL,
  guest_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_post_key_idx
ON comments (post_key);
