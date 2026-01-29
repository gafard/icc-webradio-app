'use client';

import { useState, useEffect } from 'react';

export default function AaiPanel({ postKey, audioUrl }: { postKey: string; audioUrl: string | null }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'none'|'queued'|'processing'|'completed'|'error'>('none');
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [text, setText] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [chapters, setChapters] = useState<any[]>([]);
  const [tab, setTab] = useState<'summary'|'chapters'|'text'>('summary');
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    setErr(null);

    if (!transcriptId) {
      setStatus('none');
      return;
    }

    try {
      const r = await fetch(`/api/aai/status?id=${encodeURIComponent(transcriptId)}`, { cache: 'no-store' });
      const j = await r.json();

      if (!r.ok) {
        setStatus('error');
        setErr(j?.error ?? 'Erreur status');
        return;
      }

      // j.status = queued | processing | completed | error
      if (j.status === 'error') {
        setStatus('error');
        setErr(j.error ?? 'Erreur AssemblyAI');
        return;
      }

      setStatus(j.status);
      if (j.text) setText(j.text);

      // si tu n'as pas encore résumé/chapitres côté API, laisse vide
      if (j.summary) setSummary(j.summary);
      if (Array.isArray(j.chapters)) setChapters(j.chapters);

    } catch (e: any) {
      setStatus('error');
      setErr(e?.message ?? 'Erreur réseau');
    }
  };

  const start = async () => {
    setErr(null);

    if (!audioUrl) {
      setErr("Pas d'audio détecté (mp3).");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch('/api/aai/transcribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postKey, audioUrl }),
      });

      const j = await r.json();

      if (!r.ok) {
        setStatus('error');
        setErr(j?.error ?? 'Erreur transcription');
        return;
      }

      setTranscriptId(j.transcriptId);
      setStatus('queued');
      setText('');
      setSummary('');
      setChapters([]);
    } catch (e: any) {
      setStatus('error');
      setErr(e?.message ?? 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // reset quand on change de post
    setStatus('none');
    setTranscriptId(null);
    setText('');
    setSummary('');
    setChapters([]);
    setErr(null);
  }, [postKey]);

  useEffect(() => {
    if (status !== 'queued' && status !== 'processing') return;
    const t = setInterval(() => refresh(), 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, transcriptId]);

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-white/90 font-extrabold">IA (AssemblyAI)</div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">
            {status === 'none' ? 'Non lancé' : status}
          </span>

          <button
            type="button"
            disabled={!audioUrl || loading || status === 'queued' || status === 'processing'}
            onClick={start}
            className="h-9 px-3 rounded-xl bg-[#4A7BFF] text-white font-extrabold text-sm disabled:opacity-50"
          >
            {loading ? '...' : 'Transcrire'}
          </button>

          <button
            type="button"
            onClick={refresh}
            disabled={!transcriptId}
            className="h-9 px-3 rounded-xl bg-white/10 border border-white/10 text-white/85 font-semibold disabled:opacity-50"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-2 text-sm text-red-300">
          {err}
        </div>
      ) : null}

      {!audioUrl && (
        <div className="mt-2 text-xs text-white/50">
          Pas d'audio détecté → transcription désactivée.
        </div>
      )}

      {transcriptId ? (
        <div className="mt-2 text-xs text-white/40">
          ID: {transcriptId}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="mt-4 flex gap-2">
        <button onClick={() => setTab('summary')} className={`h-9 px-3 rounded-xl text-sm font-extrabold border ${tab==='summary'?'bg-white/15 border-white/15 text-white':'bg-white/5 border-white/10 text-white/70'}`}>Résumé</button>
        <button onClick={() => setTab('chapters')} className={`h-9 px-3 rounded-xl text-sm font-extrabold border ${tab==='chapters'?'bg-white/15 border-white/15 text-white':'bg-white/5 border-white/10 text-white/70'}`}>Chapitres</button>
        <button onClick={() => setTab('text')} className={`h-9 px-3 rounded-xl text-sm font-extrabold border ${tab==='text'?'bg-white/15 border-white/15 text-white':'bg-white/5 border-white/10 text-white/70'}`}>Transcription</button>
      </div>

      <div className="mt-4">
        {tab === 'summary' && (
          <div className="text-sm text-white/80 whitespace-pre-wrap leading-6">
            {summary || (status === 'completed' ? 'Résumé indisponible (pas encore activé côté API).' : 'Lance la transcription pour obtenir le résumé.')}
          </div>
        )}

        {tab === 'chapters' && (
          <div className="space-y-3">
            {chapters?.length ? chapters.map((c, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-white font-extrabold text-sm">{c.headline || c.gist || `Chapitre ${i+1}`}</div>
                <div className="mt-1 text-white/60 text-xs">[{Math.round((c.start??0)/1000)}s → {Math.round((c.end??0)/1000)}s]</div>
                <div className="mt-2 text-white/75 text-sm leading-6">{c.summary}</div>
              </div>
            )) : (
              <div className="text-sm text-white/60">Aucun chapitre (pas encore activé côté API).</div>
            )}
          </div>
        )}

        {tab === 'text' && (
          <div className="text-sm text-white/80 whitespace-pre-wrap leading-6">
            {text || (status === 'completed' ? 'Transcription vide.' : 'En attente…')}
          </div>
        )}
      </div>
    </div>
  );
}