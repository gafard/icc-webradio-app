CREATE TABLE IF NOT EXISTS playback_progress (
  sync_id TEXT NOT NULL,
  post_key TEXT NOT NULL,
  last_time FLOAT,
  duration FLOAT,
  progress FLOAT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (sync_id, post_key)
);

CREATE INDEX IF NOT EXISTS playback_progress_sync_idx
ON playback_progress (sync_id);
