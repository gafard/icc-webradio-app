import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getCache, getCacheByTranscriptId, setCache, clearCache } from "../../../../lib/aaiStore";

const dbUrl = process.env.DATABASE_URL;
const pool = dbUrl ? new Pool({ connectionString: dbUrl }) : null;

async function dbGet(postKey?: string | null, transcriptId?: string | null) {
  if (!pool || (!postKey && !transcriptId)) return null;
  const where = postKey ? "post_key = $1" : "transcript_id = $1";
  const val = postKey ?? transcriptId;
  const { rows } = await pool.query(
    `SELECT post_key, transcript_id, status, text, summary, chapters, error, updated_at
     FROM aai_cache WHERE ${where} LIMIT 1`,
    [val]
  );
  return rows?.[0] ?? null;
}

async function dbSet(postKey: string, transcriptId: string, payload: any) {
  if (!pool) return;
  await pool.query(
    `INSERT INTO aai_cache (post_key, transcript_id, status, text, summary, chapters, error, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,now())
     ON CONFLICT (post_key) DO UPDATE
     SET transcript_id=EXCLUDED.transcript_id,
         status=EXCLUDED.status,
         text=EXCLUDED.text,
         summary=EXCLUDED.summary,
         chapters=EXCLUDED.chapters,
         error=EXCLUDED.error,
         updated_at=now()`,
    [
      postKey,
      transcriptId,
      payload.status ?? null,
      payload.text ?? null,
      payload.summary ?? null,
      payload.chapters ? JSON.stringify(payload.chapters) : null,
      payload.error ?? null,
    ]
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const transcriptId = url.searchParams.get("id");
    const postKey = url.searchParams.get("postKey");

    if (!transcriptId) {
      return NextResponse.json({ error: "id manquant" }, { status: 400 });
    }

    const cached =
      (postKey ? await getCache(postKey) : null) ??
      (await getCacheByTranscriptId(transcriptId));

    const dbCached = !cached ? await dbGet(postKey, transcriptId) : null;
    if (!cached && dbCached?.status === "completed") {
      return NextResponse.json({
        ok: true,
        status: dbCached.status,
        text: dbCached.text ?? null,
        summary: dbCached.summary ?? null,
        chapters: dbCached.chapters ?? null,
        error: dbCached.error ?? null,
        percent_complete: 100,
        cached: true,
        source: "db",
      });
    }

    if (cached?.last?.status === "completed") {
      return NextResponse.json({
        ok: true,
        status: cached.last.status,
        text: cached.last.text ?? null,
        summary: cached.last.summary ?? null,
        chapters: cached.last.chapters ?? null,
        error: cached.last.error ?? null,
        percent_complete: 100,
        cached: true,
      });
    }

    if (cached && Date.now() - cached.updatedAt < 4000) {
      return NextResponse.json({
        ok: true,
        status: cached.last.status,
        text: cached.last.text ?? null,
        summary: cached.last.summary ?? null,
        chapters: cached.last.chapters ?? null,
        error: cached.last.error ?? null,
        percent_complete: (cached.last as any)?.percent_complete ?? null,
        cached: true,
      });
    }

    const key = process.env.ASSEMBLYAI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "ASSEMBLYAI_API_KEY manquant" }, { status: 500 });
    }

    const res = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { authorization: key },
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: "AssemblyAI error", details: json }, { status: 500 });
    }

    // json.status: queued | processing | completed | error
    const payload = {
      ok: true,
      status: json.status,
      text: json.text ?? null,
      summary: json.summary ?? null,
      chapters: json.chapters ?? null,
      error: json.error ?? null,
      percent_complete: json.percent_complete ?? null,
      cached: false,
    };

    if (json.status === "error" && postKey) {
      await clearCache(postKey);
    }

    if (postKey) {
      await setCache(postKey, transcriptId, {
        id: transcriptId,
        status: json.status,
        text: json.text,
        error: json.error,
        summary: json.summary,
        chapters: json.chapters,
      });
      try {
        await dbSet(postKey, transcriptId, {
          status: json.status,
          text: json.text,
          summary: json.summary,
          chapters: json.chapters,
          error: json.error,
        });
      } catch {}
    }

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur serveur" }, { status: 500 });
  }
}
