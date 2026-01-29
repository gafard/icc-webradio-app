import os, re, time, math
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

def split_text(text: str, chunk_chars=900, overlap=150):
    # nettoyage léger
    t = re.sub(r"\s+", " ", (text or "")).strip()
    if not t:
        return []
    chunks = []
    i = 0
    n = len(t)
    idx = 0
    while i < n:
        end = min(i + chunk_chars, n)
        chunk = t[i:end].strip()
        if chunk:
            chunks.append((idx, chunk, i, end))
            idx += 1
        i = end - overlap
        if i < 0: i = 0
        if end == n: break
    return chunks

def main():
    with psycopg.connect(DB_URL) as conn:
        while True:
            # prend un épisode qui a transcript mais pas encore chunké
            row = conn.execute("""
                SELECT e.id, e.transcript
                FROM episodes e
                WHERE e.transcript IS NOT NULL
                  AND length(e.transcript) > 50
                  AND NOT EXISTS (
                    SELECT 1 FROM episode_chunks c WHERE c.episode_id = e.id
                  )
                ORDER BY e.id ASC
                LIMIT 1;
            """).fetchone()

            if not row:
                print("✅ plus rien à chunker.")
                break

            eid, transcript = row
            chunks = split_text(transcript)

            if not chunks:
                print(f"⚠️ transcript vide episode_id={eid}")
                conn.execute("UPDATE episodes SET updated_at=now() WHERE id=%s", (eid,))
                conn.commit()
                continue

            # insert chunks
            chunk_ids = []
            for idx, txt, s, e in chunks:
                c = conn.execute("""
                    INSERT INTO episode_chunks (episode_id, chunk_index, text, start_char, end_char)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id;
                """, (eid, idx, txt, s, e)).fetchone()
                chunk_ids.append((c[0], txt))

            conn.commit()
            print(f"✅ chunks inserted episode_id={eid} count={len(chunk_ids)}")

            # embed chunks (un par un pour VPS)
            for (chunk_id, txt) in chunk_ids:
                v = embed_text(txt)
                if not v:
                    print(f"⚠️ embedding vide chunk_id={chunk_id}")
                    continue
                conn.execute("""
                    INSERT INTO chunk_embeddings (chunk_id, embedding)
                    VALUES (%s, %s)
                    ON CONFLICT (chunk_id) DO UPDATE
                      SET embedding=EXCLUDED.embedding,
                          updated_at=now();
                """, (chunk_id, v))
                conn.commit()
                print(f"  ✅ embedded chunk_id={chunk_id}")
                time.sleep(0.1)

if __name__ == "__main__":
    main()