import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { audioUrl, postKey } = (await req.json()) as { audioUrl?: string; postKey?: string };

    if (!audioUrl) {
      return NextResponse.json({ error: "audioUrl manquant" }, { status: 400 });
    }

    const key = process.env.ASSEMBLYAI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "ASSEMBLYAI_API_KEY manquant" }, { status: 500 });
    }

    const res = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        authorization: key,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: "fr",
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: "AssemblyAI error", details: json }, { status: 500 });
    }

    return NextResponse.json({ ok: true, transcriptId: json.id, postKey });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur serveur" }, { status: 500 });
  }
}