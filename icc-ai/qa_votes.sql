CREATE TABLE IF NOT EXISTS qa_votes (
  question_id UUID NOT NULL,
  guest_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (question_id, guest_id)
);

CREATE INDEX IF NOT EXISTS qa_votes_question_idx
ON qa_votes (question_id);
