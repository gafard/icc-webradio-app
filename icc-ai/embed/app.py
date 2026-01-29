from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

MODEL_NAME = "BAAI/bge-m3"

app = FastAPI(title="ICC Embed Service")

model = SentenceTransformer(MODEL_NAME)

class EmbedReq(BaseModel):
    text: str

@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME}

@app.post("/embed")
def embed(req: EmbedReq):
    text = (req.text or "").strip()
    if not text:
        return {"embedding": []}

    # bge-m3: on normalise pour cosine similarity
    vec = model.encode(text, normalize_embeddings=True)
    return {"embedding": vec.tolist()}