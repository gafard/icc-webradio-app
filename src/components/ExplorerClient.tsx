'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getFavorites, toggleFavorite } from './favorites';
import { categoryLabel, getCategory, getSpeaker, getThemes, type SmartCategory } from './explorerSmart';

type Video = {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
};

type Props = { videos: Video[] };

type Tab = 'videos' | 'favoris' | 'radio';

type CategoryFilter = 'all' | SmartCategory;

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition border ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white/70 backdrop-blur border-white/50 text-gray-700 hover:bg-white'
      }`}
    >
      {label}
    </button>
  );
}

export default function ExplorerClient({ videos }: Props) {
  const [tab, setTab] = useState<Tab>('videos');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'ancien'>('recent');
  const [range, setRange] = useState<'7' | '30' | 'all'>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [speaker, setSpeaker] = useState<string>('Tous');
  const [theme, setTheme] = useState<string>('Tous');
  const [fav, setFav] = useState<string[]>([]);

  useEffect(() => setFav(getFavorites()), []);

  // Options dynamiques (intervenants/thèmes) à partir des titres
  const speakerOptions = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => set.add(getSpeaker(v.title)));
    return ['Tous', ...Array.from(set).sort((a, b) => a.localeCompare(b)).slice(0, 30)];
  }, [videos]);

  const themeOptions = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => getThemes(v.title).forEach((t) => set.add(t)));
    return ['Tous', ...Array.from(set).sort((a, b) => a.localeCompare(b)).slice(0, 30)];
  }, [videos]);

  const filteredVideos = useMemo(() => {
    let list = [...videos];

    // période
    if (range !== 'all') {
      const days = Number(range);
      const min = Date.now() - days * 24 * 60 * 60 * 1000;
      list = list.filter((v) => new Date(v.published).getTime() >= min);
    }

    // recherche
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((v) => v.title.toLowerCase().includes(s));

    // catégorie (smart)
    if (category !== 'all') {
      list = list.filter((v) => getCategory(v.title) === category);
    }

    // intervenant
    if (speaker !== 'Tous') {
      list = list.filter((v) => getSpeaker(v.title) === speaker);
    }

    // thème
    if (theme !== 'Tous') {
      list = list.filter((v) => getThemes(v.title).includes(theme));
    }

    // tri
    list.sort((a, b) => {
      const ta = new Date(a.published).getTime();
      const tb = new Date(b.published).getTime();
      return sort === 'recent' ? tb - ta : ta - tb;
    });

    return list;
  }, [videos, q, sort, range, category, speaker, theme]);

  const favoriteItems = useMemo(() => {
    return fav.map((id) => ({
      id,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    }));
  }, [fav]);

  return (
    <>
      {/* Tabs */}
      <div className="bg-white/80 backdrop-blur border border-white/50 shadow-md rounded-2xl p-2 flex gap-2">
        <button
          onClick={() => setTab('videos')}
          className={`flex-1 px-4 py-2 rounded-xl font-semibold transition ${
            tab === 'videos' ? 'bg-blue-600 text-white' : 'hover:bg-neutral-100 text-gray-700'
          }`}
        >
          🎬 Vidéos
        </button>
        <button
          onClick={() => setTab('favoris')}
          className={`flex-1 px-4 py-2 rounded-xl font-semibold transition ${
            tab === 'favoris' ? 'bg-blue-600 text-white' : 'hover:bg-neutral-100 text-gray-700'
          }`}
        >
          ⭐ Favoris ({fav.length})
        </button>
        <button
          onClick={() => setTab('radio')}
          className={`flex-1 px-4 py-2 rounded-xl font-semibold transition ${
            tab === 'radio' ? 'bg-blue-600 text-white' : 'hover:bg-neutral-100 text-gray-700'
          }`}
        >
          🎧 Radio
        </button>
      </div>

      {/* Filters */}
      {tab === 'videos' ? (
        <>
          {/* Chips catégories */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            <Chip active={category === 'all'} label="Tout" onClick={() => setCategory('all')} />
            <Chip active={category === 'predication'} label="Prédications" onClick={() => setCategory('predication')} />
            <Chip active={category === 'louange'} label="Louange" onClick={() => setCategory('louange')} />
            <Chip active={category === 'enseignement'} label="Enseignements" onClick={() => setCategory('enseignement')} />
            <Chip active={category === 'temoignage'} label="Témoignages" onClick={() => setCategory('temoignage')} />
            <Chip active={category === 'priere'} label="Prière" onClick={() => setCategory('priere')} />
            <Chip active={category === 'live'} label="Live" onClick={() => setCategory('live')} />
            <Chip active={category === 'autres'} label="Autres" onClick={() => setCategory('autres')} />
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* search */}
            <div className="bg-white/80 backdrop-blur border border-white/50 shadow-md rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="text-gray-500">🔎</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher..."
                className="w-full bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
              />
              {q ? (
                <button
                  onClick={() => setQ('')}
                  className="text-sm px-3 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 transition"
                >
                  Effacer
                </button>
              ) : null}
            </div>

            {/* sort */}
            <div className="bg-white/80 backdrop-blur border border-white/50 shadow-md rounded-2xl px-4 py-3">
              <label className="text-xs text-gray-500">Tri</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="w-full bg-transparent outline-none text-gray-800 mt-1"
              >
                <option value="recent">Plus récentes</option>
                <option value="ancien">Plus anciennes</option>
              </select>
            </div>

            {/* range */}
            <div className="bg-white/80 backdrop-blur border border-white/50 shadow-md rounded-2xl px-4 py-3">
              <label className="text-xs text-gray-500">Période</label>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as any)}
                className="w-full bg-transparent outline-none text-gray-800 mt-1"
              >
                <option value="all">Tout</option>
                <option value="7">7 derniers jours</option>
                <option value="30">30 derniers jours</option>
              </select>
            </div>

            {/* speaker */}
            <div className="bg-white/80 backdrop-blur border border-white/50 shadow-md rounded-2xl px-4 py-3">
              <label className="text-xs text-gray-500">Intervenant</label>
              <select
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                className="w-full bg-transparent outline-none text-gray-800 mt-1"
              >
                {speakerOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Theme row */}
          <div className="mt-3 bg-white/80 backdrop-blur border border-white/50 shadow-md rounded-2xl px-4 py-3">
            <div className="text-xs text-gray-500 mb-2">Thème</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Chip active={theme === 'Tous'} label="Tous" onClick={() => setTheme('Tous')} />
              {themeOptions
                .filter((t) => t !== 'Tous')
                .map((t) => (
                  <Chip key={t} active={theme === t} label={t} onClick={() => setTheme(t)} />
                ))}
            </div>
          </div>

          <div className="text-sm text-gray-500 mt-3 flex items-center justify-between">
            <span>{filteredVideos.length} résultat(s)</span>
            <Link href="/ma-liste" className="font-semibold text-blue-600 hover:text-blue-700">
              ⭐ Ma liste ({fav.length})
            </Link>
          </div>
        </>
      ) : null}

      {/* Content */}
      <div className="mt-6 pb-28">
        {tab === 'videos' ? (
          filteredVideos.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center text-gray-600">Aucun résultat.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVideos.map((v) => {
                const liked = fav.includes(v.id);
                const cat = getCategory(v.title);
                const spk = getSpeaker(v.title);
                const th = getThemes(v.title);

                return (
                  <div
                    key={v.id}
                    className="bg-white/80 backdrop-blur border border-white/50 shadow-md hover:shadow-2xl transition rounded-2xl overflow-hidden hover:-translate-y-1"
                  >
                    <div className="aspect-video bg-gray-100 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" />

                      <button
                        onClick={() => setFav(toggleFavorite(v.id))}
                        className="absolute top-3 right-3 px-3 py-2 rounded-full bg-white/90 backdrop-blur shadow font-bold"
                        title={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                      >
                        {liked ? '⭐' : '☆'}
                      </button>

                      <div className="absolute left-3 bottom-3 flex gap-2">
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-black/70 text-white">
                          {categoryLabel(cat)}
                        </span>
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/90 text-gray-800">
                          {spk}
                        </span>
                      </div>
                    </div>

                    <Link href={`/y/watch/${v.id}`} className="block p-4">
                      <h3 className="font-semibold text-gray-800 line-clamp-2">{v.title}</h3>
                      <p className="text-sm text-gray-500 mt-2">
                        {new Date(v.published).toLocaleDateString('fr-FR')} • {th.join(' · ')}
                      </p>
                    </Link>
                  </div>
                );
              })}
            </div>
          )
        ) : null}

        {tab === 'favoris' ? (
          fav.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center text-gray-600">
              Ta liste est vide. Ajoute des ⭐ depuis Explorer.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {favoriteItems.map((it) => (
                <div
                  key={it.id}
                  className="bg-white/80 backdrop-blur border border-white/50 rounded-2xl shadow-md overflow-hidden"
                >
                  <div className="aspect-video bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.thumbnail} alt="thumb" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <Link href={`/y/watch/${it.id}`} className="text-sm font-semibold text-blue-600">
                      Ouvrir
                    </Link>
                    <button
                      onClick={() => setFav(toggleFavorite(it.id))}
                      className="text-sm px-3 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 transition"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : null}

        {tab === 'radio' ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">🎧 ICC WebRadio</h2>
            <p className="text-gray-600 mb-6">
              Clique sur <b>Play</b> en bas (mini-player) pour écouter en direct.
            </p>
            <a
              href="/radio"
              className="inline-flex items-center justify-center px-5 py-3 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Aller à la page Radio
            </a>
          </div>
        ) : null}
      </div>
    </>
  );
}