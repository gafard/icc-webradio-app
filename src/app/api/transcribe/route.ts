import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // Ici viendra l'intégration avec AssemblyAI
    // Pour l'instant, on retourne un exemple de réponse
    
    return NextResponse.json({
      success: true,
      message: 'Transcription lancée avec succès',
      status: 'processing',
      transcriptId: 'example_transcript_id'
    });
  } catch (error) {
    console.error('Erreur lors de la transcription:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const transcriptId = searchParams.get('id');
  
  if (!transcriptId) {
    return NextResponse.json({ error: 'ID de transcription requis' }, { status: 400 });
  }
  
  // Ici viendra la vérification du statut de la transcription
  // Pour l'instant, on retourne un exemple
  
  return NextResponse.json({
    id: transcriptId,
    status: 'completed',
    text: 'Exemple de transcription générée par l\'IA...',
    confidence: 0.95
  });
}