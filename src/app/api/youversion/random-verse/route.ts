import { NextResponse } from 'next/server';
import { getRandomLocalVerse } from '@/lib/localBible';

export async function GET() {
  try {
    const verse = await getRandomLocalVerse('LSG'); // Utiliser la traduction LSG par défaut

    if (!verse) {
      return NextResponse.json({ error: 'Impossible de récupérer un verset' }, { status: 500 });
    }

    return NextResponse.json(verse);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erreur de récupération du verset' }, { status: 500 });
  }
}