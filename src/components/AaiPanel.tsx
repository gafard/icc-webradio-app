'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';

export default function AaiPanel({ postKey, audioUrl, onSeekSeconds }: { postKey: string; audioUrl: string | null; onSeekSeconds?: (s: number) => void }) {
  const { autoTranscribe, autoSummarize } = useSettings();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'none'|'queued'|'processing'|'completed'|'error'>('none');
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [text, setText] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [chapters, setChapters] = useState<any[]>([]);
  const [tab, setTab] = useState<'summary'|'chapters'|'text'|'translate'>('summary');
  const [query, setQuery] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [retryDelayMs, setRetryDelayMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [etaMs, setEtaMs] = useState<number | null>(null);
  const [targetLang, setTargetLang] = useState('fr');
  const [translateSource, setTranslateSource] = useState<'summary'|'text'>('summary');
  const [translatedText, setTranslatedText] = useState('');
  const [translateErr, setTranslateErr] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  const fmtEta = (ms: number | null) => {
    if (!ms || ms <= 0 || !isFinite(ms)) return '';
    const total = Math.round(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const fmtTime = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  const copyText = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement('textarea');
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  };

  const downloadText = (filename: string, value: string) => {
    const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadJson = (filename: string, value: any) => {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const refresh = async () => {
    setErr(null);

    if (!transcriptId) {
      setStatus('none');
      return;
    }

    try {
      const r = await fetch(`/api/aai/status?id=${encodeURIComponent(transcriptId)}&postKey=${encodeURIComponent(postKey)}`, { cache: 'no-store' });
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
      if (typeof j.percent_complete === 'number') {
        setProgress(Math.max(0, Math.min(100, Math.round(j.percent_complete))));
      } else {
        setProgress(j.status === 'completed' ? 100 : null);
      }
      if (startedAt && typeof j.percent_complete === 'number' && j.percent_complete > 1) {
        const elapsed = Date.now() - startedAt;
        const remaining = (elapsed * (100 - j.percent_complete)) / j.percent_complete;
        setEtaMs(Math.max(0, remaining));
      }
      if (j.text) setText(j.text);
      if (j.summary) setSummary(j.summary);
      if (Array.isArray(j.chapters)) setChapters(j.chapters);

    } catch (e: any) {
      const nextRetry = Math.min(4, retryCount + 1);
      const delay = Math.min(16000, 2000 * Math.pow(2, nextRetry));
      setRetryCount(nextRetry);
      setRetryDelayMs(delay);
      setStatus('processing');
      setErr(`Erreur réseau. Nouvelle tentative dans ${Math.round(delay / 1000)}s`);
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
      const r = await fetch('/api/aai/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postKey, audioUrl, autoSummarize }),
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
      setProgress(0);
      setRetryCount(0);
      setRetryDelayMs(0);
      setStartedAt(Date.now());
      setEtaMs(null);
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
    setQuery('');
    setTranslatedText('');
    setTranslateErr(null);
    setTranslating(false);
    setErr(null);
    setProgress(null);
    setRetryCount(0);
    setRetryDelayMs(0);
    setStartedAt(null);
    setEtaMs(null);
  }, [postKey]);

  useEffect(() => {
    if (!autoTranscribe || !audioUrl || status !== 'none') return;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTranscribe, audioUrl, postKey]);

  useEffect(() => {
    if (status !== 'queued' && status !== 'processing') return;
    const t = setInterval(() => refresh(), 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, transcriptId, retryCount]);

  useEffect(() => {
    if (retryDelayMs <= 0) return;
    const t = setTimeout(() => {
      setRetryDelayMs(0);
      refresh();
    }, retryDelayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryDelayMs]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !text) return [];
    const hay = text.toLowerCase();
    const res: Array<{ index: number; snippet: string }> = [];
    let idx = 0;
    const limit = 20;
    while (idx < hay.length && res.length < limit) {
      const found = hay.indexOf(q, idx);
      if (found === -1) break;
      const start = Math.max(0, found - 60);
      const end = Math.min(text.length, found + q.length + 60);
      const snippet = text.slice(start, end);
      res.push({ index: found, snippet });
      idx = found + q.length;
    }
    return res;
  }, [query, text]);

  const canTranslate = (translateSource === 'summary' ? summary : text)?.trim().length > 0;

  const runTranslate = async () => {
    setTranslateErr(null);
    setTranslatedText('');
    const src = translateSource === 'summary' ? summary : text;
    if (!src || !src.trim()) {
      setTranslateErr('Aucun texte à traduire.');
      return;
    }
    setTranslating(true);
    try {
      const r = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: src, source: 'auto', target: targetLang }),
      });
      const j = await r.json();
      if (!r.ok) {
        setTranslateErr(j?.error ?? 'Erreur traduction');
        return;
      }
      setTranslatedText(j?.translatedText ?? '');
    } catch (e: any) {
      setTranslateErr(e?.message ?? 'Erreur réseau');
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)]/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-extrabold text-[color:var(--foreground)]">IA (AssemblyAI)</div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[color:var(--foreground)]/60">
            {status === 'none' ? 'Non lancé' : status}
          </span>
          {status === 'queued' || status === 'processing' ? (
            <span className="text-xs text-[color:var(--foreground)]/60">
              {progress !== null ? `• ${progress}%` : '• ...'}
              {etaMs ? ` • ~${fmtEta(etaMs)}` : ''}
            </span>
          ) : null}

          <button
            type="button"
            disabled={!audioUrl || loading || status === 'queued' || status === 'processing'}
            onClick={start}
            className="btn-base btn-primary text-xs px-3 py-2 disabled:opacity-50"
          >
            {loading ? '...' : 'Transcrire'}
          </button>

          <button
            type="button"
            onClick={refresh}
            disabled={!transcriptId}
            className="btn-base btn-secondary text-xs px-3 py-2 disabled:opacity-50"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-2 text-sm text-rose-700 dark:text-rose-300">
          {err}
        </div>
      ) : null}

      {(status === 'queued' || status === 'processing') ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-strong)]">
            <div
              className="h-full bg-blue-500 transition-[width] duration-500"
              style={{ width: `${progress ?? 10}%` }}
            />
          </div>
        </div>
      ) : null}

      {!audioUrl && (
        <div className="mt-2 text-xs text-[color:var(--foreground)]/60">
          Pas d'audio détecté → transcription désactivée.
        </div>
      )}

      {transcriptId ? (
        <div className="mt-2 text-xs text-[color:var(--foreground)]/55">
          ID: {transcriptId}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="mt-4 flex gap-2">
        <button onClick={() => setTab('summary')} className={`h-9 rounded-xl border px-3 text-sm font-extrabold transition-colors ${tab==='summary'?'border-[color:var(--border-strong)] bg-[color:var(--surface)] text-[color:var(--foreground)]':'border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)]'}`}>Résumé</button>
        <button onClick={() => setTab('chapters')} className={`h-9 rounded-xl border px-3 text-sm font-extrabold transition-colors ${tab==='chapters'?'border-[color:var(--border-strong)] bg-[color:var(--surface)] text-[color:var(--foreground)]':'border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)]'}`}>Chapitres</button>
        <button onClick={() => setTab('text')} className={`h-9 rounded-xl border px-3 text-sm font-extrabold transition-colors ${tab==='text'?'border-[color:var(--border-strong)] bg-[color:var(--surface)] text-[color:var(--foreground)]':'border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)]'}`}>Transcription</button>
        <button onClick={() => setTab('translate')} className={`h-9 rounded-xl border px-3 text-sm font-extrabold transition-colors ${tab==='translate'?'border-[color:var(--border-strong)] bg-[color:var(--surface)] text-[color:var(--foreground)]':'border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)]'}`}>Traduire</button>
      </div>

      <div className="mt-4">
      {tab === 'summary' && (
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button
                type="button"
                className="btn-base btn-secondary text-xs px-3 py-2"
                onClick={() => copyText(summary)}
                disabled={!summary}
              >
                Copier le résumé
              </button>
              <button
                type="button"
                className="btn-base btn-secondary text-xs px-3 py-2"
                onClick={() => downloadText('resume.txt', summary)}
                disabled={!summary}
              >
                Exporter .txt
              </button>
            </div>

            <div className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]/82">
              {summary || (status === 'completed' ? (autoSummarize ? 'Résumé indisponible.' : 'Résumé désactivé dans les réglages.') : 'Lance la transcription pour obtenir le résumé.')}
            </div>
          </div>
        )}

        {tab === 'chapters' && (
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button
                type="button"
                className="btn-base btn-secondary text-xs px-3 py-2"
                onClick={() => copyText(chapters?.map((c, i) => {
                  const title = c.headline || c.gist || `Chapitre ${i + 1}`;
                  const start = fmtTime(Math.round((c.start ?? 0) / 1000));
                  const end = fmtTime(Math.round((c.end ?? 0) / 1000));
                  return `${i + 1}. ${title}\n${start} → ${end}\n${c.summary || ''}`;
                }).join('\n\n'))}
                disabled={!chapters?.length}
              >
                Copier chapitres
              </button>
              <button
                type="button"
                className="btn-base btn-secondary text-xs px-3 py-2"
                onClick={() => downloadJson('chapitres.json', chapters)}
                disabled={!chapters?.length}
              >
                Exporter JSON
              </button>
            </div>

            <div className="space-y-3">
            {chapters?.length ? chapters.map((c, i) => (
              <div key={i} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-3">
                <div className="text-sm font-extrabold text-[color:var(--foreground)]">{c.headline || c.gist || `Chapitre ${i+1}`}</div>
                <div className="mt-1 text-xs text-[color:var(--foreground)]/60">[{fmtTime(Math.round((c.start??0)/1000))} → {fmtTime(Math.round((c.end??0)/1000))}]</div>
                <div className="mt-2 text-sm leading-6 text-[color:var(--foreground)]/76">{c.summary}</div>
                {onSeekSeconds ? (
                  <button
                    type="button"
                    onClick={() => onSeekSeconds(Math.round((c.start ?? 0) / 1000))}
                    className="mt-3 btn-base btn-secondary text-xs px-3 py-2"
                  >
                    Aller à ce chapitre
                  </button>
                ) : null}
              </div>
            )) : (
              <div className="text-sm text-[color:var(--foreground)]/62">Aucun chapitre (pas encore activé côté API).</div>
            )}
            </div>
          </div>
        )}

        {tab === 'text' && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher dans la transcription…"
                className="input-field text-sm"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="btn-base btn-secondary text-xs px-3 py-2"
                >
                  Effacer
                </button>
              ) : null}
            </div>

            {query && (
              <div className="mb-3 text-xs text-[color:var(--foreground)]/60">
                {searchResults.length} résultat{searchResults.length > 1 ? 's' : ''} (max 20)
              </div>
            )}

            {query && searchResults.length > 0 ? (
              <div className="space-y-2 mb-4">
                {searchResults.map((r, i) => {
                  const q = query.trim();
                  const parts = q ? r.snippet.split(new RegExp(`(${q})`, 'ig')) : [r.snippet];
                  return (
                    <div key={`${r.index}-${i}`} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-3 text-sm leading-6 text-[color:var(--foreground)]/82">
                      {parts.map((p, idx) => (
                        <span key={idx} className={p.toLowerCase() === q.toLowerCase() ? 'rounded bg-[color:var(--accent)]/18 px-1 text-[color:var(--foreground)]' : ''}>
                          {p}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button
                type="button"
                className="btn-base btn-secondary text-xs px-3 py-2"
                onClick={() => copyText(text)}
                disabled={!text}
              >
                Copier transcription
              </button>
              <button
                type="button"
                className="btn-base btn-secondary text-xs px-3 py-2"
                onClick={() => downloadText('transcription.txt', text)}
                disabled={!text}
              >
                Exporter .txt
              </button>
            </div>

            <div className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]/82">
              {text || (status === 'completed' ? 'Transcription vide.' : 'En attente…')}
            </div>
          </div>
        )}

        {tab === 'translate' && (
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <select
                value={translateSource}
                onChange={(e) => setTranslateSource(e.target.value as 'summary'|'text')}
                className="select-field text-sm"
              >
                <option value="summary">Résumé</option>
                <option value="text">Transcription</option>
              </select>

              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="select-field text-sm"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="pt">Português</option>
                <option value="de">Deutsch</option>
                <option value="it">Italiano</option>
                <option value="nl">Nederlands</option>
                <option value="ru">Русский</option>
                <option value="ar">العربية</option>
                <option value="hi">हिन्दी</option>
                <option value="tr">Türkçe</option>
                <option value="sv">Svenska</option>
                <option value="pl">Polski</option>
                <option value="id">Bahasa Indonesia</option>
                <option value="vi">Tiếng Việt</option>
                <option value="sw">Swahili (sw)</option>
                <option value="yo">Yorùbá (yo)</option>
                <option value="ln">Lingála (ln)</option>
                <option value="ha">Hausa (ha)</option>
                <option value="ee">Eʋegbe (ee)</option>
              </select>

              <button
                type="button"
                onClick={runTranslate}
                disabled={!canTranslate || translating}
                className="btn-base btn-primary text-xs px-3 py-2 disabled:opacity-50"
              >
                {translating ? 'Traduction…' : 'Traduire'}
              </button>
            </div>

            {translateErr ? (
              <div className="mb-2 text-sm text-rose-700 dark:text-rose-300">{translateErr}</div>
            ) : null}

            <div className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]/82">
              {translatedText || (canTranslate ? 'Aucune traduction pour l’instant.' : 'Aucun texte à traduire.')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
