-- 1) Passages (chunks) d’un épisode
CREATE TABLE IF NOT EXISTS episode_chunks (
  id BIGSERIAL PRIMARY KEY,
  episode_id BIGINT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  text TEXT NOT NULL,
  start_char INT,
  end_char INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2) Embeddings des chunks
CREATE TABLE IF NOT EXISTS chunk_embeddings (
  chunk_id BIGINT PRIMARY KEY REFERENCES episode_chunks(id) ON DELETE CASCADE,
  embedding vector(1024),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chunk_embeddings_ivfflat
ON chunk_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 200);

-- Index utile
CREATE INDEX IF NOT EXISTS episode_chunks_episode_idx
ON episode_chunks (episode_id, chunk_index);