'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { type MediaItem } from '../lib/media';
import { useMode } from '../contexts/ModeContext';
import { ui } from './ui';

type EpisodeEntry = {
  id: string;
  item: MediaItem;
  episodeNumber: number | null;
  dateTs: number;
};

type SeriesEntry = {
  key: string;
  name: string;
  episodes: EpisodeEntry[];
  count: number;
  first: EpisodeEntry;
};

export const SeriesList = () => {
  const { mode } = useMode();
  const [mounted, setMounted] = useState(false);
  const [seriesList, setSeriesList] = useState<SeriesEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPosts, setTotalPosts] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const t = useMemo(() => ui(mounted && mode === 'night' ? 'night' : 'day'), [mounted, mode]);
  const borderClass = mounted && mode === 'night' ? 'border-white/10' : 'border-black/10';

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/series');
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || 'Erreur de chargement');
        }
        if (cancelled) return;
        setSeriesList(payload?.series ?? []);
        setTotalPosts(typeof payload?.totalPosts === 'number' ? payload.totalPosts : null);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSeriesClick = (key: string) => {
    setSelectedSeries(selectedSeries === key ? null : key);
  };

  if (loading) {
    return (
      <div className={`glass-panel rounded-2xl p-6 ${t.text}`}>
        <div className="font-extrabold text-lg">Chargement des séries…</div>
        <div className={`mt-2 text-sm ${t.sub}`}>Cela peut prendre quelques secondes.</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`glass-panel rounded-2xl p-6 ${t.text}`}>
        <div className="font-extrabold text-lg">Impossible de charger les séries</div>
        <div className={`mt-2 text-sm ${t.sub}`}>{error}</div>
      </div>
    );
  }

  if (!seriesList.length) {
    return (
      <div className={`glass-panel rounded-2xl p-6 ${t.text}`}>
        <div className="font-extrabold text-lg">Aucune série détectée</div>
        <div className={`mt-2 text-sm ${t.sub}`}>
          Vérifie la structure des titres (ex: “Session 01 — …”).
        </div>
      </div>
    );
  }

  return (
    <div className="series-management">
      <div className="mb-6">
        <h2 className={`text-2xl font-extrabold ${t.text}`}>Toutes les séries</h2>
        <p className={`text-sm ${t.sub}`}>
          Un épisode par série est mis en avant. Clique pour voir la liste complète.
          {typeof totalPosts === 'number' ? ` • ${totalPosts} posts analysés` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {seriesList.map((series) => {
          const isOpen = selectedSeries === series.key;
          const cover = series.first?.item?.thumbnail ?? '/hero-radio.jpg';

          return (
            <div
              key={series.key}
              className={`rounded-2xl border overflow-hidden ${t.card} ${t.ring} card-anim`}
            >
              <button
                type="button"
                onClick={() => handleSeriesClick(series.key)}
                className={`w-full text-left p-4 transition ${t.hover}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-20 shrink-0">
                    <div className="aspect-video rounded-xl overflow-hidden bg-black/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cover}
                        alt={series.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className={`text-lg font-extrabold ${t.text}`}>{series.name}</div>
                    <div className={`mt-1 text-xs ${t.sub}`}>
                      {series.count} épisode{series.count > 1 ? 's' : ''} •
                      {' '}
                      {series.first?.item?.dateISO
                        ? new Date(series.first.item.dateISO).toLocaleDateString('fr-FR')
                        : 'Date inconnue'}
                    </div>
                    <div className={`mt-2 text-xs ${t.faint}`}>
                      {series.first?.item?.title}
                    </div>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`mt-1 transition ${t.sub} ${isOpen ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {isOpen && (
                <div className={`border-t ${borderClass} px-4 pb-4 pt-3`}>
                  <div className={`text-xs font-semibold mb-2 ${t.sub}`}>Épisodes</div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {series.episodes.map((ep) => (
                      <div key={ep.id} className={`text-sm border-b last:border-0 pb-2 ${borderClass}`}>
                        <Link href={ep.item.href} className={`font-semibold hover:underline ${t.text}`}>
                          {ep.item.title}
                        </Link>
                        <div className={`text-[11px] mt-1 ${t.sub}`}>
                          {ep.item.kind === 'video'
                            ? (ep.episodeNumber !== null ? `Vidéo ${ep.episodeNumber}` : 'Vidéo')
                            : (ep.episodeNumber !== null ? `Session ${ep.episodeNumber}` : 'Session')}
                          {' • '}
                          {new Date(ep.item.dateISO).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
