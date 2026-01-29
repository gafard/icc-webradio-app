import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // Ici viendra l'intégration avec un service d'IA pour le résumé
    // Pour l'instant, on retourne un exemple de réponse
    
    return NextResponse.json({
      success: true,
      message: 'Résumé en cours de génération',
      status: 'processing',
      summaryId: 'example_summary_id'
    });
  } catch (error) {
    console.error('Erreur lors de la génération du résumé:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const summaryId = searchParams.get('id');
  
  if (!summaryId) {
    return NextResponse.json({ error: 'ID de résumé requis' }, { status: 400 });
  }
  
  // Ici viendra la vérification du statut du résumé
  // Pour l'instant, on retourne un exemple
  
  return NextResponse.json({
    id: summaryId,
    status: 'completed',
    summary: 'Exemple de résumé généré par l\'IA...',
    keyPoints: [
      'Point clé 1',
      'Point clé 2',
      'Point clé 3'
    ]
  });
}