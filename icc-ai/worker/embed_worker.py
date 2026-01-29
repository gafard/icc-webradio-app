import os
import time
import requests
import psycopg
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.environ["DATABASE_URL"]
EMBED_URL = os.environ["EMBED_URL"]

def embed_text(text: str):
    r = requests.post(EMBED_URL, json={"text": text[:12000]}, timeout=120)
    r.raise_for_status()
    return r.json().get("embedding", [])

def main():
    with psycopg.connect(DB_URL) as conn:
        while True:
            row = conn.execute("""
                SELECT e.id, e.transcript
                FROM episodes e
                LEFT JOIN episode_embeddings emb ON emb.episode_id = e.id
                WHERE e.transcript IS NOT NULL
                  AND length(e.transcript) > 30
                  AND emb.episode_id IS NULL
                ORDER BY e.id ASC
                LIMIT 1;
            """).fetchone()

            if not row:
                print("✅ plus rien à indexer.")
                break

            eid, transcript = row
            v = embed_text(transcript)

            if not v:
                print(f"⚠️ embedding vide pour episode_id={eid}")
                conn.execute("UPDATE episodes SET updated_at=now() WHERE id=%s", (eid,))
                conn.commit()
                time.sleep(1)
                continue

            conn.execute("""
                INSERT INTO episode_embeddings (episode_id, embedding)
                VALUES (%s, %s)
                ON CONFLICT (episode_id) DO UPDATE
                  SET embedding=EXCLUDED.embedding,
                      updated_at=now();
            """, (eid, v))
            conn.commit()
            print(f"✅ embedded episode_id={eid} (len={len(v)})")

if __name__ == "__main__":
    main()