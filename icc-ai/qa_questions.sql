CREATE TABLE IF NOT EXISTS qa_questions (
  id UUID PRIMARY KEY,
  post_key TEXT NOT NULL,
  author TEXT NOT NULL,
  question TEXT NOT NULL,
  guest_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qa_questions_post_key_idx
ON qa_questions (post_key);
