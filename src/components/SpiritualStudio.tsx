'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Flag, Plus, Shield, Sparkles, Trash2 } from 'lucide-react';
import type { SpiritualTemplate, TemplateType, TemplateVisibility } from '../types/spiritual';
import { getPlanDefinitions } from '../lib/biblePlans';

type CreateTemplatePayload = {
  template: SpiritualTemplate;
  publishNow: boolean;
};

export function SpiritualStudio({
  templates,
  adminMode,
  onToggleAdmin,
  onCreateTemplate,
  onPublishTemplate,
  onDeleteTemplate,
  onStartPlan,
  onStartChallenge,
}: {
  templates: SpiritualTemplate[];
  adminMode: boolean;
  onToggleAdmin: () => void;
  onCreateTemplate: (payload: CreateTemplatePayload) => void;
  onPublishTemplate: (template: SpiritualTemplate, visibility: TemplateVisibility) => void;
  onDeleteTemplate: (id: string) => void;
  onStartPlan: (template: SpiritualTemplate, source: 'personal' | 'community' | 'official') => void;
  onStartChallenge: (template: SpiritualTemplate, source: 'personal' | 'community' | 'official') => void;
}) {
  const [type, setType] = useState<TemplateType>('plan');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [days, setDays] = useState(30);
  const [scheduleMode, setScheduleMode] = useState<'auto' | 'calendar'>('auto');
  const [planKey, setPlanKey] = useState('bible-1y');
  const [scheduleText, setScheduleText] = useState('');
  const [duration, setDuration] = useState(21);
  const [taskListText, setTaskListText] = useState('');
  const [category, setCategory] = useState('Prière');
  const [difficulty, setDifficulty] = useState<'facile' | 'moyen' | 'difficile'>('moyen');
  const [frequency, setFrequency] = useState<'quotidien' | 'hebdo'>('quotidien');
  const [visibility, setVisibility] = useState<TemplateVisibility>('private');

  const planDefs = useMemo(() => getPlanDefinitions(), []);

  const personalPlans = templates.filter((t) => t.type === 'plan');
  const personalChallenges = templates.filter((t) => t.type === 'challenge');

  const parseSchedule = (value: string) => {
    const lines = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.map((line) =>
      line
        .split(/[;,]/)
        .map((ref) => ref.trim())
        .filter(Boolean)
    );
  };

  const parseTasks = (value: string) =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setScheduleText('');
    setTaskListText('');
  };

  const handleSubmit = () => {
    if (!title.trim() || !description.trim()) return;
    const now = new Date().toISOString();
    if (type === 'plan') {
      const schedule = scheduleMode === 'calendar' ? parseSchedule(scheduleText) : undefined;
      const resolvedDays = scheduleMode === 'calendar' ? schedule?.length || days : days;
      const template: SpiritualTemplate = {
        id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'plan',
        title: title.trim(),
        description: description.trim(),
        days: Math.max(1, resolvedDays || 1),
        scheduleMode,
        planKey: scheduleMode === 'auto' ? planKey : undefined,
        schedule,
        visibility,
        createdAt: now,
      };
      onCreateTemplate({ template, publishNow: visibility !== 'private' });
      resetForm();
      return;
    }

    const taskList = parseTasks(taskListText);
    const template: SpiritualTemplate = {
      id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'challenge',
      title: title.trim(),
      description: description.trim(),
      duration: Math.max(1, duration),
      taskList,
      category,
      difficulty,
      frequency,
      visibility,
      createdAt: now,
    };
    onCreateTemplate({ template, publishNow: visibility !== 'private' });
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--foreground)]/60">
              Studio
            </div>
            <h2 className="text-2xl font-extrabold">Plans & défis personnalisés</h2>
            <p className="text-sm text-[color:var(--foreground)]/70">
              Crée tes propres parcours, publie-les à la communauté, ou garde-les privés.
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleAdmin}
            className={`btn-base text-xs px-3 py-2 ${adminMode ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Shield size={14} />
            Mode admin {adminMode ? 'actif' : 'off'}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[140px_1fr]">
          <div className="space-y-2">
            <div className="text-xs text-[color:var(--foreground)]/60">Type</div>
            <div className="flex flex-col gap-2">
              {(['plan', 'challenge'] as TemplateType[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setType(item)}
                  className={`btn-base text-xs px-3 py-2 ${
                    type === item ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {item === 'plan' ? 'Plan' : 'Défi'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre"
              className="input-field text-sm"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              className="input-field text-sm min-h-[90px]"
            />

            {type === 'plan' ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[160px_1fr_1fr]">
                  <select
                    value={scheduleMode}
                    onChange={(e) => setScheduleMode(e.target.value as 'auto' | 'calendar')}
                    className="select-field text-sm"
                  >
                    <option value="auto">Auto-calcul</option>
                    <option value="calendar">Calendrier fixe</option>
                  </select>
                  <input
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value || 0))}
                    type="number"
                    min={1}
                    className="input-field text-sm"
                    placeholder="Jours"
                  />
                  {scheduleMode === 'auto' ? (
                    <select
                      value={planKey}
                      onChange={(e) => setPlanKey(e.target.value)}
                      className="select-field text-sm"
                    >
                      {planDefs.map((plan) => (
                        <option key={plan.key} value={plan.key}>
                          {plan.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-[color:var(--foreground)]/60">
                      1 ligne = 1 jour
                    </div>
                  )}
                </div>
                {scheduleMode === 'calendar' && (
                  <textarea
                    value={scheduleText}
                    onChange={(e) => setScheduleText(e.target.value)}
                    placeholder="Jour 1: Genèse 1-2; Psaumes 1"
                    className="input-field text-sm min-h-[140px]"
                  />
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                  <input
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value || 0))}
                    type="number"
                    min={1}
                    className="input-field text-sm"
                    placeholder="Durée (jours)"
                  />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="select-field text-sm"
                  >
                    <option value="Prière">Prière</option>
                    <option value="Lecture">Lecture</option>
                    <option value="Jeûne">Jeûne</option>
                    <option value="Service">Service</option>
                    <option value="Foi">Foi</option>
                  </select>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as 'facile' | 'moyen' | 'difficile')}
                    className="select-field text-sm"
                  >
                    <option value="facile">Facile</option>
                    <option value="moyen">Moyen</option>
                    <option value="difficile">Difficile</option>
                  </select>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as 'quotidien' | 'hebdo')}
                    className="select-field text-sm"
                  >
                    <option value="quotidien">Quotidien</option>
                    <option value="hebdo">Hebdo</option>
                  </select>
                </div>
                <textarea
                  value={taskListText}
                  onChange={(e) => setTaskListText(e.target.value)}
                  placeholder="1 ligne = 1 tâche (ex: 10 min de prière)"
                  className="input-field text-sm min-h-[120px]"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as TemplateVisibility)}
                className="select-field text-sm"
              >
                <option value="private">Privé</option>
                <option value="public">Public</option>
                {adminMode && <option value="official">Officiel</option>}
              </select>
              <button
                type="button"
                onClick={handleSubmit}
                className="btn-base btn-primary text-xs px-3 py-2"
              >
                <Plus size={14} />
                Ajouter
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Mes plans</div>
            <BookOpen size={16} className="text-blue-300" />
          </div>
          {personalPlans.length === 0 ? (
            <div className="mt-3 text-sm text-[color:var(--foreground)]/60">
              Aucun plan pour le moment.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {personalPlans.map((tpl) => (
                <div key={tpl.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{tpl.title}</div>
                      <div className="text-xs text-[color:var(--foreground)]/60">{tpl.description}</div>
                    </div>
                    <span className="chip-soft text-[11px] px-2 py-1">
                      {tpl.visibility === 'official' ? 'Officiel' : tpl.visibility}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-base btn-secondary text-xs px-3 py-2"
                      onClick={() => onStartPlan(tpl, 'personal')}
                    >
                      Lancer
                    </button>
                    {tpl.visibility === 'private' && (
                      <button
                        type="button"
                        className="btn-base btn-ghost text-xs px-3 py-2"
                        onClick={() => onPublishTemplate(tpl, adminMode ? 'official' : 'public')}
                      >
                        Publier
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-base btn-ghost text-xs px-3 py-2"
                      onClick={() => onDeleteTemplate(tpl.id)}
                    >
                      <Trash2 size={14} />
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Mes défis</div>
            <Sparkles size={16} className="text-amber-200" />
          </div>
          {personalChallenges.length === 0 ? (
            <div className="mt-3 text-sm text-[color:var(--foreground)]/60">
              Aucun défi pour le moment.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {personalChallenges.map((tpl) => (
                <div key={tpl.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{tpl.title}</div>
                      <div className="text-xs text-[color:var(--foreground)]/60">{tpl.description}</div>
                    </div>
                    <span className="chip-soft text-[11px] px-2 py-1">
                      {tpl.visibility === 'official' ? 'Officiel' : tpl.visibility}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-base btn-secondary text-xs px-3 py-2"
                      onClick={() => onStartChallenge(tpl, 'personal')}
                    >
                      Lancer
                    </button>
                    {tpl.visibility === 'private' && (
                      <button
                        type="button"
                        className="btn-base btn-ghost text-xs px-3 py-2"
                        onClick={() => onPublishTemplate(tpl, adminMode ? 'official' : 'public')}
                      >
                        Publier
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-base btn-ghost text-xs px-3 py-2"
                      onClick={() => onDeleteTemplate(tpl.id)}
                    >
                      <Trash2 size={14} />
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommunityLibrary({
  templates,
  reportCounts,
  onStartPlan,
  onStartChallenge,
  onReport,
}: {
  templates: SpiritualTemplate[];
  reportCounts: Record<string, number>;
  onStartPlan: (template: SpiritualTemplate, source: 'community' | 'official') => void;
  onStartChallenge: (template: SpiritualTemplate, source: 'community' | 'official') => void;
  onReport: (template: SpiritualTemplate, reason: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | TemplateType>('all');
  const [query, setQuery] = useState('');

  const filtered = templates.filter((tpl) => {
    if (filter !== 'all' && tpl.type !== filter) return false;
    if (!query) return true;
    const hay = `${tpl.title} ${tpl.description}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  return (
    <div className="glass-panel rounded-3xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--foreground)]/60">
            Communauté
          </div>
          <h2 className="text-2xl font-extrabold">Bibliothèque publique</h2>
          <p className="text-sm text-[color:var(--foreground)]/70">
            Parcours officiels et créations de la communauté (modérés par signalement).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher..."
            className="input-field text-sm"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | TemplateType)}
            className="select-field text-sm"
          >
            <option value="all">Tous</option>
            <option value="plan">Plans</option>
            <option value="challenge">Défis</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 text-sm text-[color:var(--foreground)]/60">
          Aucun contenu public pour le moment.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {filtered.map((tpl) => {
            const reports = reportCounts[tpl.id] || 0;
            const isOfficial = tpl.visibility === 'official';
            return (
              <div key={tpl.id} className="glass-card rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {tpl.title}
                      {isOfficial && (
                        <span className="chip-soft text-[10px] px-2 py-0.5">Officiel</span>
                      )}
                    </div>
                    <div className="text-xs text-[color:var(--foreground)]/60">{tpl.description}</div>
                  </div>
                  <span className="chip-soft text-[10px] px-2 py-0.5">
                    {tpl.type === 'plan' ? 'Plan' : 'Défi'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[color:var(--foreground)]/60">
                  {tpl.days ? <span>{tpl.days} jours</span> : null}
                  {tpl.duration ? <span>{tpl.duration} jours</span> : null}
                  {tpl.category ? <span>{tpl.category}</span> : null}
                  {tpl.difficulty ? <span>{tpl.difficulty}</span> : null}
                  {tpl.frequency ? <span>{tpl.frequency}</span> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tpl.type === 'plan' ? (
                    <button
                      type="button"
                      onClick={() =>
                        onStartPlan(tpl, isOfficial ? 'official' : 'community')
                      }
                      className="btn-base btn-secondary text-xs px-3 py-2"
                    >
                      Lancer
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        onStartChallenge(tpl, isOfficial ? 'official' : 'community')
                      }
                      className="btn-base btn-secondary text-xs px-3 py-2"
                    >
                      Lancer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onReport(tpl, 'Contenu inapproprié')}
                    className="btn-base btn-ghost text-xs px-3 py-2"
                  >
                    <Flag size={14} />
                    Signaler {reports > 0 ? `(${reports})` : ''}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
