'use client';

import { useEffect, useMemo, useState } from 'react';

type PrayerGroup = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: number;
};

type GroupPost = {
  id: string;
  groupId: string;
  author: string;
  content: string;
  createdAt: number;
  prayed: number;
};

const GROUPS_KEY = 'icc_prayer_groups_v1';
const MEMBERS_KEY = 'icc_prayer_groups_members_v1';
const POSTS_KEY = 'icc_prayer_groups_posts_v1';
const GUEST_KEY = 'icc_guest_id';

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getGuestId() {
  if (typeof window === 'undefined') return 'guest';
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

const seedGroups: PrayerGroup[] = [
  {
    id: 'grp-healing',
    name: 'Guérison & Espoir',
    description: 'Prier pour la guérison et l’espérance.',
    tags: ['guérison', 'foi'],
    createdAt: Date.now() - 86400000 * 7,
  },
  {
    id: 'grp-family',
    name: 'Famille & Mariage',
    description: 'Soutien en prière pour les familles.',
    tags: ['famille', 'mariage'],
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'grp-fasting',
    name: 'Jeûne & Prière',
    description: 'Unissons nos cœurs dans le jeûne.',
    tags: ['jeûne', 'discipline'],
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'grp-youth',
    name: 'Jeunesse ICC',
    description: 'Prier pour les jeunes et leurs projets.',
    tags: ['jeunesse', 'avenir'],
    createdAt: Date.now() - 86400000 * 2,
  },
];

export default function PrayerGroupsPanel() {
  const [groups, setGroups] = useState<PrayerGroup[]>([]);
  const [members, setMembers] = useState<Record<string, string[]>>({});
  const [posts, setPosts] = useState<Record<string, GroupPost[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [tags, setTags] = useState('');
  const [postAuthor, setPostAuthor] = useState('');
  const [postContent, setPostContent] = useState('');

  useEffect(() => {
    const stored = read<Record<string, PrayerGroup>>(GROUPS_KEY, {});
    if (Object.keys(stored).length === 0) {
      const seeded: Record<string, PrayerGroup> = {};
      for (const g of seedGroups) seeded[g.id] = g;
      write(GROUPS_KEY, seeded);
    }
    const nextGroups = Object.values(read<Record<string, PrayerGroup>>(GROUPS_KEY, {}));
    setGroups(nextGroups.sort((a, b) => b.createdAt - a.createdAt));
    setMembers(read<Record<string, string[]>>(MEMBERS_KEY, {}));
    setPosts(read<Record<string, GroupPost[]>>(POSTS_KEY, {}));
    if (!selectedId && nextGroups.length) setSelectedId(nextGroups[0].id);
  }, []);

  const currentGroup = groups.find((g) => g.id === selectedId) || null;
  const guestId = getGuestId();
  const isMember = currentGroup ? (members[currentGroup.id] || []).includes(guestId) : false;

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => {
      const hay = `${g.name} ${g.description} ${g.tags.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [groups, query]);

  const saveGroups = (list: PrayerGroup[]) => {
    const map: Record<string, PrayerGroup> = {};
    for (const g of list) map[g.id] = g;
    write(GROUPS_KEY, map);
    setGroups(list);
  };

  const toggleJoin = () => {
    if (!currentGroup) return;
    const next = { ...members };
    const list = new Set(next[currentGroup.id] || []);
    if (list.has(guestId)) list.delete(guestId);
    else list.add(guestId);
    next[currentGroup.id] = Array.from(list);
    write(MEMBERS_KEY, next);
    setMembers(next);
  };

  const createGroup = () => {
    const title = name.trim();
    if (!title) return;
    const g: PrayerGroup = {
      id: crypto.randomUUID(),
      name: title,
      description: desc.trim() || 'Groupe de prière',
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      createdAt: Date.now(),
    };
    const list = [g, ...groups];
    saveGroups(list);
    setSelectedId(g.id);
    setName('');
    setDesc('');
    setTags('');
  };

  const addPost = () => {
    if (!currentGroup || !isMember) return;
    const content = postContent.trim();
    if (!content) return;
    const item: GroupPost = {
      id: crypto.randomUUID(),
      groupId: currentGroup.id,
      author: postAuthor.trim() || 'Anonyme',
      content,
      createdAt: Date.now(),
      prayed: 0,
    };
    const next = { ...posts };
    const list = next[currentGroup.id] ? [...next[currentGroup.id]] : [];
    list.unshift(item);
    next[currentGroup.id] = list;
    write(POSTS_KEY, next);
    setPosts(next);
    setPostContent('');
  };

  const prayFor = (postId: string) => {
    if (!currentGroup) return;
    const next = { ...posts };
    const list = next[currentGroup.id] ? [...next[currentGroup.id]] : [];
    const idx = list.findIndex((p) => p.id === postId);
    if (idx === -1) return;
    list[idx] = { ...list[idx], prayed: (list[idx].prayed || 0) + 1 };
    next[currentGroup.id] = list;
    write(POSTS_KEY, next);
    setPosts(next);
  };

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold text-[color:var(--foreground)]">Groupes de prière</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un groupe…"
          className="input-field text-sm max-w-[240px]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <div className="glass-panel rounded-2xl p-4">
          <div className="text-xs font-semibold opacity-70 mb-3">Créer un groupe</div>
          <div className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du groupe"
              className="input-field text-sm"
            />
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Description courte"
              className="input-field text-sm"
            />
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (ex: foi, guérison)"
              className="input-field text-sm"
            />
            <button
              type="button"
              onClick={createGroup}
              className="btn-base btn-primary text-xs px-3 py-2 w-full"
            >
              Créer
            </button>
          </div>

          <div className="mt-5 text-xs font-semibold opacity-70">Groupes</div>
          <div className="mt-2 space-y-2">
            {filteredGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedId(g.id)}
                className={`w-full text-left rounded-xl border px-3 py-2 transition ${
                  selectedId === g.id
                    ? 'bg-white/10 border-white/20 text-[color:var(--foreground)]'
                    : 'bg-white/5 border-white/10 text-[color:var(--foreground)]/70 hover:bg-white/10'
                }`}
              >
                <div className="font-semibold text-sm">{g.name}</div>
                <div className="text-[11px] opacity-70">{g.description}</div>
                <div className="mt-1 text-[10px] opacity-60">
                  {g.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          {!currentGroup ? (
            <div className="text-sm text-[color:var(--foreground)]/70">Sélectionne un groupe.</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-extrabold text-[color:var(--foreground)]">{currentGroup.name}</div>
                  <div className="text-xs text-[color:var(--foreground)]/60">{currentGroup.description}</div>
                </div>
                <button
                  type="button"
                  onClick={toggleJoin}
                  className={`btn-base text-xs px-3 py-2 ${isMember ? 'btn-secondary' : 'btn-primary'}`}
                >
                  {isMember ? 'Quitter' : 'Rejoindre'}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {currentGroup.tags.map((t) => (
                  <span key={t} className="chip-soft text-[10px]">#{t}</span>
                ))}
                <span className="chip-soft text-[10px]">
                  {(members[currentGroup.id] || []).length} membre(s)
                </span>
              </div>

              <div className="mt-5">
                <div className="text-xs font-semibold opacity-70 mb-2">Partager une demande</div>
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
                  <input
                    value={postAuthor}
                    onChange={(e) => setPostAuthor(e.target.value)}
                    placeholder="Votre nom"
                    className="input-field text-sm"
                  />
                  <input
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder={isMember ? 'Votre demande de prière...' : 'Rejoignez le groupe pour poster'}
                    className="input-field text-sm"
                    disabled={!isMember}
                  />
                </div>
                <button
                  type="button"
                  onClick={addPost}
                  className="btn-base btn-primary text-xs px-3 py-2 mt-2"
                  disabled={!isMember}
                >
                  Publier
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {(posts[currentGroup.id] || []).length === 0 ? (
                  <div className="text-xs text-[color:var(--foreground)]/60">
                    Aucune demande pour l’instant.
                  </div>
                ) : (
                  (posts[currentGroup.id] || []).map((p) => (
                    <div key={p.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-white/90 text-sm font-semibold">{p.author}</div>
                        <div className="text-[11px] text-white/40">
                          {new Date(p.createdAt).toLocaleString('fr-FR')}
                        </div>
                      </div>
                      <div className="mt-2 text-white/75 text-sm leading-6">{p.content}</div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => prayFor(p.id)}
                          className="btn-base btn-secondary text-xs px-3 py-2"
                        >
                          🙏 J’ai prié
                        </button>
                        <span className="text-xs text-white/50">{p.prayed} prières</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
