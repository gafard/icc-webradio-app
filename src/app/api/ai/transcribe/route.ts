import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { audioUrl, language } = await req.json();

    if (!audioUrl) {
      return NextResponse.json({ error: 'audioUrl manquant' }, { status: 400 });
    }

    const key = process.env.ASSEMBLYAI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'ASSEMBLYAI_API_KEY manquant' }, { status: 500 });
    }

    // 1) demander transcription
    const create = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        authorization: key,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: language === 'fr' ? 'fr' : undefined,
        punctuate: true,
        format_text: true,
      }),
    });

    if (!create.ok) {
      const t = await create.text();
      return NextResponse.json({ error: t }, { status: 500 });
    }

    const created = await create.json();
    const id = created.id as string;

    // 2) poll jusqu'à fini
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const check = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { authorization: key },
      });

      const data = await check.json();

      if (data.status === 'completed') {
        return NextResponse.json({ id, text: data.text ?? '' });
      }
      if (data.status === 'error') {
        return NextResponse.json({ error: data.error ?? 'AssemblyAI error' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Timeout transcription' }, { status: 504 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}