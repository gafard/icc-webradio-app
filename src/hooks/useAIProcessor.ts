'use client';

import { useState, useEffect } from 'react';

type TranscriptStatus = 'idle' | 'processing' | 'completed' | 'error';
type SummaryStatus = 'idle' | 'processing' | 'completed' | 'error';

export default function useAIProcessor(audioUrl: string | null) {
  const [transcriptStatus, setTranscriptStatus] = useState<TranscriptStatus>('idle');
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>('idle');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startTranscription = async () => {
    if (!audioUrl) {
      setError('Aucun fichier audio disponible');
      return;
    }

    try {
      setTranscriptStatus('processing');
      setError(null);
      
      // Appel à l'API de transcription
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la transcription');
      }

      // Pour l'instant, on simule la complétion
      // Dans la vraie implémentation, on devrait poller le statut
      setTranscriptStatus('completed');
      setTranscript('Exemple de transcription générée par l\'IA...');
    } catch (err) {
      console.error('Erreur de transcription:', err);
      setTranscriptStatus('error');
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  const startSummarization = async () => {
    if (!transcript) {
      setError('La transcription est requise pour générer un résumé');
      return;
    }

    try {
      setSummaryStatus('processing');
      setError(null);
      
      // Appel à l'API de résumé
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la génération du résumé');
      }

      // Pour l'instant, on simule la complétion
      // Dans la vraie implémentation, on devrait poller le statut
      setSummaryStatus('completed');
      setSummary('Exemple de résumé généré par l\'IA...');
    } catch (err) {
      console.error('Erreur de résumé:', err);
      setSummaryStatus('error');
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  return {
    transcriptStatus,
    summaryStatus,
    transcript,
    summary,
    error,
    startTranscription,
    startSummarization
  };
}