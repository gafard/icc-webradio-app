import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || String(text).trim().length < 20) {
      return NextResponse.json({ error: 'Texte insuffisant' }, { status: 400 });
    }

    const key = process.env.ASSEMBLYAI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'ASSEMBLYAI_API_KEY manquant' }, { status: 500 });
    }

    // AssemblyAI ne résume pas "du texte brut" en endpoint séparé;
    // on utilise une transcription "text-only" via 'transcript' -> summarization
    // Ici on envoie un transcript artificiel via 'text' n'est pas supporté.
    // ✅ Alternative simple: faire le résumé côté LLM (plus tard).
    // Pour l'instant on fait un résumé "local" très basique (fallback) :
    const clean = String(text).trim();
    const sentences = clean.split(/(?<=[.!?])\s+/).slice(0, 5).join(' ');
    return NextResponse.json({ summary: sentences });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}