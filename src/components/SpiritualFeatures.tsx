// Composants pour les fonctionnalités spirituelles

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PrayerEntry, ReadingPlan, SpiritualChallenge, BibleVerse, PrayerRequest, SpiritualProgress } from '../types/spiritual';

type AddPrayerPayload = {
  title: string;
  content: string;
  category: string;
  tags: string[];
};

type AddPrayerRequestPayload = {
  content: string;
  city: string;
};

type AddProgressPayload = {
  prayerCount: number;
  readingCount: number;
  challengeCompleted: number;
  notes: string;
};

function fmtDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('fr-FR');
  } catch {
    return value;
  }
}

function normalize(text: string) {
  return (text || '').toLowerCase().trim();
}

const PRAYER_CATEGORIES = [
  'général',
  'guérison',
  'direction',
  'famille',
  'finances',
  'travail',
  'études',
  'mission',
  'protection',
  'gratitude',
  'santé',
];

const CHALLENGE_CATEGORIES = [
  'Prière',
  'Lecture',
  'Jeûne',
  'Service',
  'Foi',
];

// Composant pour afficher les versets bibliques
export const BibleVerseDisplay = ({ verse }: { verse: BibleVerse }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bible-verse-container glass-card card-anim p-4 mb-4 rounded-2xl text-[color:var(--foreground)]">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-[color:var(--foreground)]">{verse.reference}</h3>
        <button 
          onClick={() => setExpanded(!expanded)}
          className="btn-base btn-secondary text-xs px-3 py-2"
        >
          {expanded ? 'Moins' : 'Plus'}
        </button>
      </div>
      <p className="mt-2 text-[color:var(--foreground)]/80">{verse.text.substring(0, expanded ? verse.text.length : 100)}</p>
      {expanded && verse.text.length > 100 && (
        <p className="mt-2 text-[color:var(--foreground)]/80">{verse.text.substring(100)}</p>
      )}
    </div>
  );
};

// Composant pour le journal de prière
export const PrayerJournal = ({
  prayers,
  onAddPrayer,
  onToggleAnswered,
  onAddAnswer,
  onRemovePrayer,
}: {
  prayers: PrayerEntry[];
  onAddPrayer: (payload: AddPrayerPayload) => void;
  onToggleAnswered: (id: string, answered: boolean) => void;
  onAddAnswer: (id: string, answer: string) => void;
  onRemovePrayer: (id: string) => void;
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('général');
  const [tags, setTags] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'answered'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'ancien'>('recent');
  const [groupBy, setGroupBy] = useState(false);

  const canSubmit = title.trim().length >= 2 && content.trim().length >= 4;
  const categories = Array.from(
    new Set([...PRAYER_CATEGORIES, ...prayers.map((p) => p.category).filter(Boolean)])
  );
  const allTags = Array.from(
    new Set(prayers.flatMap((p) => p.tags || []).filter(Boolean))
  );
  const stats = {
    total: prayers.length,
    answered: prayers.filter((p) => p.answered).length,
    pending: prayers.filter((p) => !p.answered).length,
  };

  const filtered = prayers
    .filter((p) => {
      if (statusFilter === 'answered' && !p.answered) return false;
      if (statusFilter === 'pending' && p.answered) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (tagFilter !== 'all' && !(p.tags || []).includes(tagFilter)) return false;
      if (query) {
        const hay = `${p.title} ${p.content} ${(p.tags || []).join(' ')}`;
        if (!normalize(hay).includes(normalize(query))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      return sort === 'recent' ? tb - ta : ta - tb;
    });

  const grouped = filtered.reduce<Record<string, PrayerEntry[]>>((acc, item) => {
    const key = item.category || 'général';
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="prayer-journal">
      <h2 className="text-xl font-bold mb-4 text-[color:var(--foreground)]">Journal de Prière</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="glass-card rounded-2xl p-4">
          <div className="text-xs text-[color:var(--foreground)]/60">Total</div>
          <div className="text-2xl font-extrabold">{stats.total}</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-xs text-[color:var(--foreground)]/60">Répondues</div>
          <div className="text-2xl font-extrabold text-emerald-300">{stats.answered}</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-xs text-[color:var(--foreground)]/60">En attente</div>
          <div className="text-2xl font-extrabold text-amber-300">{stats.pending}</div>
        </div>
      </div>
      <div className="glass-panel rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la prière"
            className="input-field text-sm"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Catégorie (ex: guérison)"
            className="input-field text-sm"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Détaille ta prière..."
            className="input-field text-sm md:col-span-2 min-h-[90px]"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (ex: foi, famille)"
            className="input-field text-sm md:col-span-2"
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={!canSubmit}
            className="btn-base btn-primary text-xs px-3 py-2 disabled:opacity-50"
            onClick={() => {
              const nextTags = tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);
              onAddPrayer({
                title: title.trim(),
                content: content.trim(),
                category: category.trim() || 'général',
                tags: nextTags,
              });
              setTitle('');
              setContent('');
              setCategory('général');
              setTags('');
            }}
          >
            Ajouter
          </button>
          <span className="text-xs text-[color:var(--foreground)]/60">Enregistré localement</span>
        </div>
      </div>
      <div className="glass-panel rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-[11px] text-[color:var(--foreground)]/60 mb-1">Statut</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'answered')}
              className="select-field text-sm"
            >
              <option value="all">Tout</option>
              <option value="pending">En attente</option>
              <option value="answered">Répondu</option>
            </select>
          </div>
          <div>
            <div className="text-[11px] text-[color:var(--foreground)]/60 mb-1">Catégorie</div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="select-field text-sm"
            >
              <option value="all">Toutes</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[11px] text-[color:var(--foreground)]/60 mb-1">Tag</div>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="select-field text-sm"
            >
              <option value="all">Tous</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[11px] text-[color:var(--foreground)]/60 mb-1">Tri</div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'recent' | 'ancien')}
              className="select-field text-sm"
            >
              <option value="recent">Plus récents</option>
              <option value="ancien">Plus anciens</option>
            </select>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Recherche (titre, contenu, tags)…"
            className="input-field text-sm"
          />
          <button
            type="button"
            className={`btn-base text-xs px-3 py-2 ${groupBy ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setGroupBy((v) => !v)}
          >
            {groupBy ? 'Vue groupée' : 'Vue simple'}
          </button>
        </div>
      </div>
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-sm text-[color:var(--foreground)]/70">
            Aucun résultat pour ces filtres.
          </div>
        ) : null}
        {!groupBy
          ? filtered.map(prayer => (
          <div key={prayer.id} className="p-4 glass-card rounded-2xl border border-white/10 text-[color:var(--foreground)]">
            <h3 className="font-semibold">{prayer.title}</h3>
            <p className="my-2 text-[color:var(--foreground)]/80">{prayer.content}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[color:var(--foreground)]/60">
              <span>{fmtDate(prayer.date)}</span>
              <div className="flex items-center gap-2">
                <span className="rounded-full px-2 py-1 text-xs bg-white/10 border border-white/10">
                  {prayer.category}
                </span>
                {prayer.tags?.length ? (
                  <span className="rounded-full px-2 py-1 text-xs bg-white/10 border border-white/10">
                    {prayer.tags.slice(0, 3).join(' • ')}
                  </span>
                ) : null}
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  prayer.answered ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'
                }`}>
                  {prayer.answered ? 'Répondu' : 'En attente'}
                </span>
              </div>
            </div>
            {prayer.answered ? (
              <div className="mt-3 text-xs text-[color:var(--foreground)]/70">
                {prayer.answer ? `Réponse: ${prayer.answer}` : 'Aucune note de réponse.'}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-base btn-secondary text-xs px-3 py-2"
                onClick={() => onToggleAnswered(prayer.id, !prayer.answered)}
              >
                {prayer.answered ? 'Marquer en attente' : 'Marquer répondu'}
              </button>
              <button
                type="button"
                className="btn-base btn-secondary text-xs px-3 py-2"
                onClick={() => {
                  const value = window.prompt('Ajouter une note de réponse', prayer.answer || '');
                  if (value && value.trim().length > 0) {
                    onAddAnswer(prayer.id, value.trim());
                  }
                }}
              >
                Ajouter une réponse
              </button>
              <button
                type="button"
                className="btn-base btn-ghost text-xs px-3 py-2"
                onClick={() => onRemovePrayer(prayer.id)}
              >
                Supprimer
              </button>
            </div>
          </div>
        ))
          : Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="glass-panel rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold">{cat}</div>
                <div className="text-xs text-[color:var(--foreground)]/60">{items.length} prière(s)</div>
              </div>
              <div className="space-y-3">
                {items.map((prayer) => (
                  <div key={prayer.id} className="p-3 rounded-xl border border-white/10 bg-white/5">
                    <div className="font-semibold">{prayer.title}</div>
                    <div className="text-xs text-[color:var(--foreground)]/60 mt-1">{fmtDate(prayer.date)}</div>
                    <div className="mt-2 text-sm text-[color:var(--foreground)]/80 line-clamp-2">{prayer.content}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-base btn-secondary text-xs px-3 py-2"
                        onClick={() => onToggleAnswered(prayer.id, !prayer.answered)}
                      >
                        {prayer.answered ? 'Marquer en attente' : 'Marquer répondu'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

// Composant pour le plan de lecture biblique
export const ReadingPlanTracker = ({
  plan,
  effectiveDay,
  dailyVerses,
  weekPreview,
  onAdvanceDay,
  onResetPlan,
  onStartToday,
  onSelectPassage,
}: {
  plan: ReadingPlan;
  effectiveDay: number;
  dailyVerses: string[];
  weekPreview: string[][];
  onAdvanceDay: (id: string, delta: number) => void;
  onResetPlan: (id: string) => void;
  onStartToday: (id: string) => void;
  onSelectPassage?: (reference: string) => void;
}) => {
  const progress = effectiveDay ? Math.round((effectiveDay / plan.days) * 100) : 0;
  const [showWeek, setShowWeek] = useState(false);
  
  return (
    <div className="reading-plan-tracker p-4 glass-card rounded-2xl border border-white/10 text-[color:var(--foreground)]">
      <h2 className="text-xl font-bold mb-2">{plan.title}</h2>
      <p className="text-[color:var(--foreground)]/70 mb-4">{plan.description}</p>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="chip-soft text-xs px-3 py-1">
          {plan.planCategory || 'Plan'}
        </span>
        <span className="chip-soft text-xs px-3 py-1">
          {plan.mode === 'auto' ? 'Auto' : 'Manuel'}
        </span>
        <span className="chip-soft text-xs px-3 py-1">
          {plan.days} jours
        </span>
      </div>
      
      <div className="mb-4">
        <div className="w-full bg-white/10 rounded-full h-2.5">
          <div 
            className="bg-[color:var(--accent)] h-2.5 rounded-full" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-sm text-[color:var(--foreground)]/60 mt-1">
          <span>Jour {effectiveDay || 0} sur {plan.days}</span>
          <span>{progress}% terminé</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-base btn-primary text-xs px-3 py-2"
          onClick={() => onAdvanceDay(plan.id, 1)}
          disabled={plan.completed}
        >
          Jour suivant
        </button>
        <button
          type="button"
          className="btn-base btn-secondary text-xs px-3 py-2"
          onClick={() => onAdvanceDay(plan.id, -1)}
          disabled={effectiveDay <= 1}
        >
          Reculer
        </button>
        <button
          type="button"
          className="btn-base btn-ghost text-xs px-3 py-2"
          onClick={() => onResetPlan(plan.id)}
        >
          Réinitialiser
        </button>
        <button
          type="button"
          className="btn-base btn-secondary text-xs px-3 py-2"
          onClick={() => onStartToday(plan.id)}
        >
          Démarrer aujourd’hui
        </button>
        <span className="text-[11px] text-[color:var(--foreground)]/60">
          {plan.startDate ? `Auto (depuis ${fmtDate(plan.startDate)})` : 'Manuel'}
        </span>
      </div>
      
      {dailyVerses && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Versets d'aujourd'hui:</h3>
          <div className="flex flex-wrap gap-2">
            {dailyVerses.slice(0, 6).map((verse, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSelectPassage?.(verse)}
                className="btn-base btn-secondary text-xs px-3 py-2"
                title="Voir le passage"
              >
                {verse}
              </button>
            ))}
          </div>
        </div>
      )}

      {weekPreview?.length ? (
        <div className="mt-4">
          <button
            type="button"
            className="btn-base btn-ghost text-xs px-3 py-2"
            onClick={() => setShowWeek((v) => !v)}
          >
            {showWeek ? 'Masquer la semaine' : 'Voir les 7 prochains jours'}
          </button>
          {showWeek ? (
            <div className="mt-3 space-y-2">
              {weekPreview.map((refs, idx) => (
                <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                  <div className="text-xs text-[color:var(--foreground)]/60 mb-1">
                    Jour {Math.min(plan.days, effectiveDay + idx)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {refs.map((ref, i) => (
                      <button
                        key={`${ref}-${i}`}
                        type="button"
                        onClick={() => onSelectPassage?.(ref)}
                        className="btn-base btn-secondary text-xs px-3 py-2"
                      >
                        {ref}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

// Composant pour les défis spirituels
export const SpiritualChallengeCard = ({
  challenge,
  onToggleTask,
}: {
  challenge: SpiritualChallenge;
  onToggleTask: (challengeId: string, taskId: string) => void;
}) => {
  const [daysLeft, setDaysLeft] = useState(0);
  const [expanded, setExpanded] = useState(false);
  
  useEffect(() => {
    const end = new Date(challenge.endDate);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setDaysLeft(Math.max(0, diffDays));
  }, [challenge.endDate]);
  
  return (
    <div className="challenge-card p-4 glass-card rounded-2xl border border-white/10 text-[color:var(--foreground)]">
      <h3 className="text-lg font-bold">{challenge.title}</h3>
      <p className="text-[color:var(--foreground)]/70 my-2">{challenge.description}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {challenge.category ? (
          <span className="chip-soft text-xs px-3 py-1">{challenge.category}</span>
        ) : null}
        {challenge.difficulty ? (
          <span className="chip-soft text-xs px-3 py-1">Niveau {challenge.difficulty}</span>
        ) : null}
        {challenge.frequency ? (
          <span className="chip-soft text-xs px-3 py-1">{challenge.frequency}</span>
        ) : null}
      </div>
      
      <div className="flex justify-between text-sm text-[color:var(--foreground)]/60 mb-3">
        <span>Jours restants: {daysLeft}</span>
        <span>Progression: {challenge.progress}%</span>
      </div>
      
      <div className="w-full bg-white/10 rounded-full h-2 mb-4">
        <div 
          className="bg-emerald-500 h-2 rounded-full" 
          style={{ width: `${challenge.progress}%` }}
        ></div>
      </div>
      
      <div className="daily-tasks">
        <h4 className="font-semibold mb-2">Tâches quotidiennes:</h4>
        <ul className="space-y-2">
          {(expanded ? challenge.dailyTasks : challenge.dailyTasks.slice(0, 3)).map(task => (
            <li key={task.id} className="flex items-center">
              <input 
                type="checkbox" 
                checked={task.completed} 
                className="mr-2"
                onChange={() => onToggleTask(challenge.id, task.id)}
              />
              <span className={task.completed ? 'line-through text-[color:var(--foreground)]/60' : ''}>
                {task.title}
              </span>
            </li>
          ))}
        </ul>
        {challenge.dailyTasks.length > 3 ? (
          <button
            type="button"
            className="btn-base btn-ghost text-xs px-3 py-2 mt-3"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Réduire' : 'Voir tout'}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export const SpiritualChallenges = ({
  challenges,
  onToggleTask,
}: {
  challenges: SpiritualChallenge[];
  onToggleTask: (challengeId: string, taskId: string) => void;
}) => {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'progress' | 'days'>('progress');

  const categories = Array.from(
    new Set([...CHALLENGE_CATEGORIES, ...challenges.map((c) => c.category).filter(Boolean)])
  );

  const filtered = challenges
    .filter((c) => {
      if (statusFilter === 'active' && c.completed) return false;
      if (statusFilter === 'completed' && !c.completed) return false;
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      if (query) {
        const hay = `${c.title} ${c.description}`;
        if (!normalize(hay).includes(normalize(query))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === 'progress') return (b.progress || 0) - (a.progress || 0);
      const da = new Date(a.endDate).getTime();
      const db = new Date(b.endDate).getTime();
      return da - db;
    });

  return (
    <div>
      <div className="glass-panel rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-[11px] text-[color:var(--foreground)]/60 mb-1">Catégorie</div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="select-field text-sm"
            >
              <option value="all">Toutes</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[11px] text-[color:var(--foreground)]/60 mb-1">Statut</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'completed')}
              className="select-field text-sm"
            >
              <option value="all">Tout</option>
              <option value="active">Actifs</option>
              <option value="completed">Terminés</option>
            </select>
          </div>
          <div>
            <div className="text-[11px] text-[color:var(--foreground)]/60 mb-1">Tri</div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'progress' | 'days')}
              className="select-field text-sm"
            >
              <option value="progress">Progression</option>
              <option value="days">Échéance</option>
            </select>
          </div>
          <div>
            <div className="text-[11px] text-[color:var(--foreground)]/60 mb-1">Recherche</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher un défi..."
              className="input-field text-sm"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-[color:var(--foreground)]/70">Aucun défi pour ces filtres.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((challenge) => (
            <SpiritualChallengeCard
              key={challenge.id}
              challenge={challenge}
              onToggleTask={onToggleTask}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Composant pour la carte de prière interactive
export const PrayerMap = ({
  requests,
  onAddRequest,
  onPray,
  onAnswer,
}: {
  requests: PrayerRequest[];
  onAddRequest: (payload: AddPrayerRequestPayload) => void;
  onPray: (id: string) => void;
  onAnswer: (id: string) => void;
}) => {
  const [content, setContent] = useState('');
  const [city, setCity] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'requested' | 'prayed' | 'answered'>('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [sort, setSort] = useState<'recent' | 'prayed'>('recent');
  const [query, setQuery] = useState('');

  const cities = Array.from(new Set(requests.map((r) => r.location?.city).filter(Boolean)));
  const summary = {
    total: requests.length,
    answered: requests.filter((r) => r.status === 'answered').length,
    active: requests.filter((r) => r.status !== 'answered').length,
  };

  const filtered = requests
    .filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (cityFilter !== 'all' && r.location?.city !== cityFilter) return false;
      if (query) {
        const hay = `${r.content} ${r.location?.city || ''}`;
        if (!normalize(hay).includes(normalize(query))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === 'prayed') return (b.prayedForCount || 0) - (a.prayedForCount || 0);
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  // Dans une implémentation réelle, on utiliserait une bibliothèque de cartographie comme Leaflet ou Google Maps
  return (
    <div className="prayer-map p-4 glass-card rounded-2xl border border-white/10 text-[color:var(--foreground)]">
      <h2 className="text-xl font-bold mb-4">Carte de Prière</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="glass-card rounded-2xl p-4">
          <div className="text-xs text-[color:var(--foreground)]/60">Total</div>
          <div className="text-2xl font-extrabold">{summary.total}</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-xs text-[color:var(--foreground)]/60">Actives</div>
          <div className="text-2xl font-extrabold text-amber-300">{summary.active}</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-xs text-[color:var(--foreground)]/60">Exaucées</div>
          <div className="text-2xl font-extrabold text-emerald-300">{summary.answered}</div>
        </div>
      </div>
      <div className="glass-panel rounded-2xl p-3 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-2">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nouvelle requête de prière..."
            className="input-field text-sm"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ville"
            className="input-field text-sm"
          />
        </div>
        <div className="mt-2">
          <button
            type="button"
            className="btn-base btn-primary text-xs px-3 py-2"
            disabled={content.trim().length < 4}
            onClick={() => {
              onAddRequest({ content: content.trim(), city: city.trim() || '—' });
              setContent('');
              setCity('');
            }}
          >
            Ajouter
          </button>
        </div>
      </div>
      <div className="glass-panel rounded-2xl p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-[11px] text-[color:var(--foreground)]/60 mb-1">Statut</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="select-field text-sm"
            >
              <option value="all">Tous</option>
              <option value="requested">Demandé</option>
              <option value="prayed">En prière</option>
              <option value="answered">Répondu</option>
            </select>
          </div>
          <div>
            <div className="text-[11px] text-[color:var(--foreground)]/60 mb-1">Ville</div>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="select-field text-sm"
            >
              <option value="all">Toutes</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[11px] text-[color:var(--foreground)]/60 mb-1">Tri</div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'recent' | 'prayed')}
              className="select-field text-sm"
            >
              <option value="recent">Plus récents</option>
              <option value="prayed">Plus priés</option>
            </select>
          </div>
          <div>
            <div className="text-[11px] text-[color:var(--foreground)]/60 mb-1">Recherche</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Recherche..."
              className="input-field text-sm"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="text-sm text-[color:var(--foreground)]/70">
            Aucune requête pour l’instant. Sois le premier à poster 🙏
          </div>
        ) : null}
        {filtered.map(request => (
          <div key={request.id} className="p-3 rounded-xl border border-white/10 bg-white/5">
            <p className="text-sm">{request.content}</p>
            <div className="flex justify-between text-xs text-[color:var(--foreground)]/60 mt-2">
              <span>{request.location?.city || 'Localisation inconnue'}</span>
              <span>Prié {request.prayedForCount} fois</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-base btn-secondary text-xs px-3 py-2"
                onClick={() => onPray(request.id)}
              >
                J’ai prié
              </button>
              <button
                type="button"
                className="btn-base btn-ghost text-xs px-3 py-2"
                onClick={() => onAnswer(request.id)}
              >
                Exaucée
              </button>
              <span className="text-[10px] text-[color:var(--foreground)]/60">
                {request.status === 'answered' ? 'Répondu' : request.status === 'prayed' ? 'Prière en cours' : 'Demandé'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Composant pour le suivi de la croissance spirituelle
export const SpiritualProgressTracker = ({
  progress,
  onAddProgress,
}: {
  progress: SpiritualProgress[];
  onAddProgress: (payload: AddProgressPayload) => void;
}) => {
  const [prayerCount, setPrayerCount] = useState(0);
  const [readingCount, setReadingCount] = useState(0);
  const [challengeCompleted, setChallengeCompleted] = useState(0);
  const [notes, setNotes] = useState('');
  const [range, setRange] = useState<'7' | '30' | 'all'>('30');
  const [showAllNotes, setShowAllNotes] = useState(false);

  const now = Date.now();
  const rangeMs = range === 'all' ? Infinity : Number(range) * 24 * 60 * 60 * 1000;
  const filtered = progress.filter((item) => now - new Date(item.date).getTime() <= rangeMs);
  const totals = filtered.reduce(
    (acc, item) => {
      acc.prayers += item.prayerCount;
      acc.readings += item.readingCount;
      acc.challenges += item.challengeCompleted;
      return acc;
    },
    { prayers: 0, readings: 0, challenges: 0 }
  );
  const uniqueDays = new Set(filtered.map((item) => new Date(item.date).toDateString()));
  const dayCount = Math.max(1, uniqueDays.size);
  const avg = {
    prayers: Math.round(totals.prayers / dayCount),
    readings: Math.round(totals.readings / dayCount),
    challenges: Math.round(totals.challenges / dayCount),
  };
  const notesList = showAllNotes ? filtered : filtered.slice(0, 5);
  const maxScore = Math.max(
    1,
    ...filtered.map((item) => item.prayerCount + item.readingCount + item.challengeCompleted)
  );

  return (
    <div className="spiritual-progress p-4 glass-card rounded-2xl border border-white/10 text-[color:var(--foreground)]">
      <h2 className="text-xl font-bold mb-4">Suivi de Croissance Spirituelle</h2>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-[color:var(--foreground)]/60">Période:</span>
        {(['7', '30', 'all'] as const).map((r) => (
          <button
            key={r}
            type="button"
            className={`btn-base text-xs px-3 py-2 ${range === r ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRange(r)}
          >
            {r === 'all' ? 'Tout' : `${r} jours`}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 rounded-xl bg-white/10">
          <div className="text-2xl font-bold text-[color:var(--accent)]">
            {totals.prayers}
          </div>
          <div className="text-sm text-[color:var(--foreground)]/70">Prières</div>
          <div className="text-[11px] text-[color:var(--foreground)]/50">~{avg.prayers}/jour</div>
        </div>
        <div className="p-3 rounded-xl bg-white/10">
          <div className="text-2xl font-bold text-emerald-400">
            {totals.readings}
          </div>
          <div className="text-sm text-[color:var(--foreground)]/70">Lectures</div>
          <div className="text-[11px] text-[color:var(--foreground)]/50">~{avg.readings}/jour</div>
        </div>
        <div className="p-3 rounded-xl bg-white/10">
          <div className="text-2xl font-bold text-purple-300">
            {totals.challenges}
          </div>
          <div className="text-sm text-[color:var(--foreground)]/70">Défis</div>
          <div className="text-[11px] text-[color:var(--foreground)]/50">~{avg.challenges}/jour</div>
        </div>
      </div>
      {filtered.length > 0 ? (
        <div className="mt-4 grid grid-cols-7 gap-2">
          {filtered.slice(0, 7).map((item) => {
            const score = item.prayerCount + item.readingCount + item.challengeCompleted;
            const height = Math.max(8, Math.round((score / maxScore) * 48));
            return (
              <div key={item.id} className="flex flex-col items-center gap-1">
                <div className="w-3 rounded-full bg-[color:var(--accent)]/70" style={{ height }} />
                <div className="text-[10px] text-[color:var(--foreground)]/50">{fmtDate(item.date)}</div>
              </div>
            );
          })}
        </div>
      ) : null}
      
      <div className="mt-5 glass-panel rounded-2xl p-3">
        <div className="text-sm font-semibold mb-2">Journal du jour</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            type="number"
            min={0}
            value={prayerCount}
            onChange={(e) => setPrayerCount(Number(e.target.value))}
            className="input-field text-sm"
            placeholder="Prières"
          />
          <input
            type="number"
            min={0}
            value={readingCount}
            onChange={(e) => setReadingCount(Number(e.target.value))}
            className="input-field text-sm"
            placeholder="Lectures"
          />
          <input
            type="number"
            min={0}
            value={challengeCompleted}
            onChange={(e) => setChallengeCompleted(Number(e.target.value))}
            className="input-field text-sm"
            placeholder="Défis"
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input-field text-sm mt-2 min-h-[70px]"
          placeholder="Notes / gratitude / sujets..."
        />
        <div className="mt-2">
          <button
            type="button"
            className="btn-base btn-primary text-xs px-3 py-2"
            disabled={notes.trim().length < 3}
            onClick={() => {
              onAddProgress({
                prayerCount,
                readingCount,
                challengeCompleted,
                notes: notes.trim(),
              });
              setPrayerCount(0);
              setReadingCount(0);
              setChallengeCompleted(0);
              setNotes('');
            }}
          >
            Ajouter une note
          </button>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="font-semibold mb-2">Notes récentes:</h3>
        <div className="space-y-2">
          {notesList.map(item => (
            <div key={item.id} className="p-2 rounded text-sm bg-white/5">
              {item.notes}
              <div className="text-xs text-[color:var(--foreground)]/60">
                {fmtDate(item.date)}
              </div>
            </div>
          ))}
        </div>
        {filtered.length > 5 ? (
          <button
            type="button"
            className="btn-base btn-ghost text-xs px-3 py-2 mt-3"
            onClick={() => setShowAllNotes((v) => !v)}
          >
            {showAllNotes ? 'Réduire' : 'Voir tout'}
          </button>
        ) : null}
      </div>
    </div>
  );
};

type BibleResult = {
  reference: string;
  text?: string;
  translation?: string;
  verses?: Array<{ book_name: string; chapter: number; verse: number; text: string }>;
};

export const BibleIntegrationPanel = ({
  selectedReference,
  onSelectReference,
  onPassageResolved,
}: {
  selectedReference?: string | null;
  onSelectReference?: (ref: string) => void;
  onPassageResolved?: (p: { reference: string; text: string }) => void;
}) => {
  const [reference, setReference] = useState(selectedReference || '');
  const [translation, setTranslation] = useState('web');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BibleResult | null>(null);

  useEffect(() => {
    if (selectedReference) {
      setReference(selectedReference);
    }
  }, [selectedReference]);

  const fetchPassage = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bible/passage?q=${encodeURIComponent(reference)}&translation=${encodeURIComponent(translation)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? 'Passage indisponible');
      }

      const verses: BibleResult['verses'] = Array.isArray(data.verses)
        ? data.verses.map((v: any) => ({
            book_name: String(v?.book_name || ''),
            chapter: Number(v?.chapter || 0),
            verse: Number(v?.verse || 0),
            text: String(v?.text || ''),
          }))
        : [];

      const resultData = {
        reference: data.reference || reference,
        text: data.text,
        translation: data.translation,
        verses,
      };

      setResult(resultData);

      // Appel du callback avec le texte du passage
      if (resultData.text && resultData.reference) {
        onPassageResolved?.({ reference: resultData.reference, text: resultData.text });
      } else if (resultData.verses && resultData.verses.length > 0) {
        const text = resultData.verses.map((v) => `${v.chapter}:${v.verse} ${v.text}`).join('\n');
        onPassageResolved?.({ reference: resultData.reference, text });
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur de récupération');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 text-[color:var(--foreground)]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-semibold opacity-70">Intégration Bible</div>
          <div className="text-lg font-extrabold">Afficher le texte du passage</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto_auto] gap-2">
        <input
          value={reference}
          onChange={(e) => {
            setReference(e.target.value);
            onSelectReference?.(e.target.value);
          }}
          placeholder="Ex: Jean 3:16-18"
          className="input-field text-sm"
        />
        <select
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          className="select-field text-sm"
        >
          <option value="web">WEB</option>
          <option value="kjv">KJV</option>
          <option value="clementine">Vulgate</option>
          <option value="almeida">Almeida</option>
          <option value="rccv">RCCV</option>
        </select>
        <button
          type="button"
          className="btn-base btn-primary text-xs px-3 py-2"
          onClick={fetchPassage}
          disabled={loading || reference.trim().length < 3}
        >
          {loading ? 'Chargement…' : 'Charger'}
        </button>
        <Link
          href={`/bible?q=${encodeURIComponent(reference)}`}
          className="btn-base btn-secondary text-xs px-3 py-2"
        >
          Ouvrir lecteur
        </Link>
      </div>

      {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}

      {result ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-bold">{result.reference}</div>
          {result.translation ? (
            <div className="text-xs text-[color:var(--foreground)]/60">
              Traduction: {result.translation}
            </div>
          ) : null}
          {result.text ? (
            <div className="mt-3 text-sm whitespace-pre-line">{result.text}</div>
          ) : result.verses?.length ? (
            <div className="mt-3 space-y-2 text-sm">
              {result.verses.map((v, idx) => (
                <div key={`${v.book_name}-${v.chapter}-${v.verse}-${idx}`}>
                  <span className="text-[color:var(--foreground)]/60 mr-2">
                    {v.chapter}:{v.verse}
                  </span>
                  {v.text}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-[color:var(--foreground)]/60">
              Aucun texte disponible.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
