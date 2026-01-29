import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const transcriptId = url.searchParams.get("id");

    if (!transcriptId) {
      return NextResponse.json({ error: "id manquant" }, { status: 400 });
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
    return NextResponse.json({
      ok: true,
      status: json.status,
      text: json.text ?? null,
      error: json.error ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur serveur" }, { status: 500 });
  }
}