CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS episodes (
  id BIGSERIAL PRIMARY KEY,
  wp_id BIGINT UNIQUE,
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  serie TEXT,
  episode_number INT,
  audio_url TEXT,
  published_at TIMESTAMPTZ,
  transcript TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1 embedding par épisode (simple)
-- bge-m3 -> 1024 dims (recommandé)
CREATE TABLE IF NOT EXISTS episode_embeddings (
  episode_id BIGINT PRIMARY KEY REFERENCES episodes(id) ON DELETE CASCADE,
  embedding vector(1024),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS episode_embeddings_ivfflat
ON episode_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);