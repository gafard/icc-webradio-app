CREATE TABLE IF NOT EXISTS aai_cache (
  post_key TEXT PRIMARY KEY,
  transcript_id TEXT NOT NULL,
  status TEXT,
  text TEXT,
  summary TEXT,
  chapters JSONB,
  error TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aai_cache_transcript_id_idx
ON aai_cache (transcript_id);
