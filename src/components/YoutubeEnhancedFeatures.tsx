'use client';

import { useState, useRef, useEffect } from 'react';
import { TranscriptResult } from '../lib/youtube-transcript';

interface YoutubeEnhancedFeaturesProps {
  videoId: string;
  title: string;
  onLoadTranscript?: (transcript: TranscriptResult) => void;
  onLoadSummary?: (summary: string, bullets: string[]) => void;
}

export default function YoutubeEnhancedFeatures({
  videoId,
  title,
  onLoadTranscript,
  onLoadSummary
}: YoutubeEnhancedFeaturesProps) {
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [bullets, setBullets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugSteps, setDebugSteps] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearProgressTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const beginProgress = (label: string) => {
    clearProgressTimer();
    setProgressLabel(label);
    setProgress(8);
    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) return prev;
        const bump = Math.max(1, Math.round((88 - prev) * 0.08));
        return Math.min(88, prev + bump);
      });
    }, 500);
  };

  const bumpProgress = (target: number, label?: string) => {
    if (label) setProgressLabel(label);
    setProgress((prev) => Math.max(prev, target));
  };

  const endProgress = (success: boolean) => {
    clearProgressTimer();
    if (success) {
      setProgress(100);
      setTimeout(() => {
        setProgress(0);
        setProgressLabel(null);
      }, 600);
    } else {
      setProgress(0);
      setProgressLabel(null);
    }
  };

  useEffect(() => {
    return () => {
      clearProgressTimer();
    };
  }, []);

  const loadTranscribeeTranscript = async () => {
    setLoading(true);
    setError(null);
    setDebugSteps([]);
    beginProgress('Transcription (Transcribee)…');
    
    let succeeded = false;
    try {
      // Appeler l'API pour transcrire via transcribee
      const response = await fetch('/api/youtube/transcribee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, title })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erreur lors de la transcription');
      }

      const data = await response.json();
      if (!data?.transcript?.text) {
        throw new Error('Transcribee non configuré');
      }

      bumpProgress(55, 'Transcription reçue…');
      setTranscript(data.transcript);
      
      if (onLoadTranscript) {
        onLoadTranscript(data.transcript);
      }

      // Charger le résumé
      await loadSummary(data.transcript.text);
      succeeded = true;
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la transcription');
      console.error('Transcription error:', err);
    } finally {
      setLoading(false);
      endProgress(succeeded);
    }
  };

  const loadSummary = async (transcriptText: string) => {
    try {
      bumpProgress(75, 'Génération du résumé…');
      const response = await fetch('/api/youtube/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: transcriptText,
          videoId,
          title
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erreur lors de la génération du résumé');
      }

      const data = await response.json();
      setSummary(data.summary);
      setBullets(data.bullets || []);
      bumpProgress(95, 'Résumé prêt');

      if (onLoadSummary) {
        onLoadSummary(data.summary, data.bullets || []);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la génération du résumé');
      setProgressLabel('Résumé indisponible');
      console.error('Summary error:', err);
    }
  };

  const loadYTTranscript = async () => {
    setLoading(true);
    setError(null);
    beginProgress('Récupération des sous-titres…');
    
    let succeeded = false;
    try {
      // Utiliser la méthode existante pour charger la transcription YouTube
      const response = await fetch(`/api/youtube/transcript?videoId=${encodeURIComponent(videoId)}&debug=1`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.ok === false) {
        const errorMsg = data?.error || 'Transcript indisponible';
        if (Array.isArray(data?.debug?.steps)) {
          console.warn('YT transcript debug:', data.debug.steps);
          setDebugSteps(data.debug.steps);
        }
        throw new Error(errorMsg);
      }
      
      const payload = data?.result ?? data;
      const transcriptResult: TranscriptResult = {
        language: payload.language || 'unknown',
        segments: payload.segments || [],
        text: payload.text || ''
      };
      
      bumpProgress(55, 'Transcription reçue…');
      setTranscript(transcriptResult);
      
      if (onLoadTranscript) {
        onLoadTranscript(transcriptResult);
      }

      // Charger le résumé
      if (transcriptResult.text) {
        await loadSummary(transcriptResult.text);
      }
      succeeded = true;
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement de la transcription');
      console.error('YT Transcript error:', err);
    } finally {
      setLoading(false);
      endProgress(succeeded);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 text-[color:var(--foreground)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold opacity-70">Résumé & transcription</div>
          <div className="text-lg font-extrabold">Comprendre la vidéo</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`btn-base text-xs px-3 py-2 ${activeTab === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Résumé
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transcript')}
            className={`btn-base text-xs px-3 py-2 ${activeTab === 'transcript' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Transcription
          </button>
          <button
            type="button"
            onClick={loadYTTranscript}
            className="btn-base btn-ghost text-xs px-3 py-2"
            disabled={loading}
          >
            {loading ? 'Chargement…' : 'YT Subtitles'}
          </button>
          <button
            type="button"
            onClick={loadTranscribeeTranscript}
            className="btn-base btn-ghost text-xs px-3 py-2"
            disabled={loading}
          >
            {loading ? 'Chargement…' : 'Transcribee'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-500">
          {error}
          {debugSteps.length > 0 && (
            <div className="mt-2 text-xs text-red-400 whitespace-pre-wrap">
              {debugSteps.join('\n')}
            </div>
          )}
        </div>
      )}

      {progress > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs opacity-70">
            <span>{progressLabel ?? 'Chargement…'}</span>
            <span>{Math.min(100, Math.round(progress))}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#4A7BFF] transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(6, progress))}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4">
        {activeTab === 'summary' ? (
          <>
            {loading ? (
              <div className="text-sm opacity-70">Résumé en cours…</div>
            ) : summary ? (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{summary}</p>
                {bullets.length > 0 && (
                  <ul className="list-disc pl-5 text-sm space-y-1 opacity-90">
                    {bullets.map((b, i) => (
                      <li key={`${b}-${i}`}>{b}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
                  <div className="font-semibold text-blue-400 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Fiabilité du résumé
                  </div>
                  <div className="mt-1 text-blue-300/90">
                    Ce résumé est généré automatiquement. Pour une précision maximale, 
                    consultez la transcription complète ci-dessous.
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm opacity-70">
                Cliquez sur "YT Subtitles" ou "Transcribee" pour charger le résumé.
              </div>
            )}
            {error && !loading && (
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
                <div className="font-semibold text-yellow-500 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Information de fiabilité
                </div>
                <div className="mt-1 text-yellow-400/90">
                  Le résumé est généré automatiquement et peut contenir des imprécisions. 
                  Consultez la transcription complète pour les détails.
                </div>
              </div>
            )}
          </>
        ) : loading ? (
          <div className="text-sm opacity-70">Transcription en cours…</div>
        ) : transcript ? (
          <div className="space-y-2">
            <div className="text-xs opacity-60">
              Langue détectée : {transcript.language || '—'}
            </div>
            <div className="max-h-64 overflow-y-auto text-sm leading-relaxed whitespace-pre-line">
              {transcript.text}
            </div>
          </div>
        ) : (
          <div className="text-sm opacity-70">
            Cliquez sur "YT Subtitles" ou "Transcribee" pour charger la transcription.
          </div>
        )}
      </div>
    </div>
  );
}
