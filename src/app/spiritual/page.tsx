'use client';

import { useState, useEffect, useRef } from 'react';
import AppShell from '../../components/AppShell';
import { useSettings } from '../../contexts/SettingsContext';
import {
  PrayerJournal,
  ReadingPlanTracker,
  SpiritualChallenges,
  BibleVerseDisplay,
  PrayerMap,
  SpiritualProgressTracker
} from '../../components/SpiritualFeatures';
import PrayerGroupsPanel from '../../components/PrayerGroupsPanel';
import {
  PrayerEntry,
  ReadingPlan,
  SpiritualChallenge,
  BibleVerse,
  PrayerRequest,
  SpiritualProgress,
  SpiritualTemplate
} from '../../types/spiritual';
import { fetchSpiritualState, upsertSpiritualState } from '../../components/spiritualSync';
import { getDailyVerses, getPlanDefinitions } from '../../lib/biblePlans';
import { supabase } from '../../lib/supabase';
import { addPrayerRequestRemote, fetchPrayerRequestsRemote, subscribePrayerRequests, updatePrayerRequestRemote } from '../../components/prayerRequests';
import { CommunityLibrary } from '../../components/SpiritualStudio';
import { fetchCommunityTemplates, fetchTemplateReports, publishTemplate, reportTemplate } from '../../components/spiritualTemplates';
import CommunityFeed from '../../components/CommunityFeed';
import CommunityComposer from '../../components/CommunityComposer';
import CommunityStories from '../../components/CommunityStories';
import CommunityIdentityCard from '../../components/CommunityIdentityCard';
import FeedHeader from '../../components/FeedHeader';
import StoriesRow from '../../components/StoriesRow';
import RightPanel from '../../components/RightPanel';
import StoriesBar from '../../components/StoriesBar';
import { getRandomLocalVerse, type LocalVerse } from '../../lib/localBible';

const STORAGE_KEY = 'icc_spiritual_v1';
const ADMIN_KEY = 'icc_spiritual_admin_mode';

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toStoryVerse(verse: LocalVerse | null) {
  if (!verse) return null;
  return {
    reference: `${verse.book} ${verse.chapter}:${verse.verse}`,
    text: verse.text,
    version: verse.version,
  };
}

function buildMockData() {
  const challengeId = makeId();
  const today = new Date();
  const planDefs = getPlanDefinitions();
  const plan1 = planDefs.find((p) => p.key === 'bible-1y');
  const plan2 = planDefs.find((p) => p.key === 'psaumes-proverbes');
  return {
    meta: { version: 1, updatedAt: Date.now() },
    prayers: [
      {
        id: makeId(),
        title: 'Demande de guérison',
        content: 'Prière pour la guérison de mon frère malade',
        date: new Date().toISOString(),
        answered: false,
        category: 'guérison',
        tags: ['maladie', 'foi']
      },
      {
        id: makeId(),
        title: 'Direction divine',
        content: 'Demande de direction pour mes décisions professionnelles',
        date: new Date(Date.now() - 86400000).toISOString(), // hier
        answered: true,
        answer: 'Reçu un appel pour un nouvel emploi',
        answerDate: new Date().toISOString(),
        category: 'direction',
        tags: ['emploi', 'sagesse']
      }
    ],
    readingPlans: [
      {
        id: makeId(),
        title: plan1?.title ?? 'Bible en 1 an',
        description: plan1?.description ?? 'Lecture complète de la Bible en 365 jours.',
        days: plan1?.days ?? 365,
        planKey: plan1?.key ?? 'bible-1y',
        planCategory: 'Bible complète',
        mode: 'auto',
        startDate: new Date(today.getTime() - 44 * 86400000).toISOString(),
        dailyVerses: [],
        completed: false,
      },
      {
        id: makeId(),
        title: plan2?.title ?? 'Psaumes & Proverbes',
        description: plan2?.description ?? 'Lecture quotidienne des Psaumes et Proverbes',
        days: plan2?.days ?? 31,
        planKey: plan2?.key ?? 'psaumes-proverbes',
        planCategory: 'Psaumes & Sagesse',
        mode: 'auto',
        startDate: new Date(today.getTime() - 9 * 86400000).toISOString(),
        dailyVerses: [],
        completed: false,
      }
    ],
    challenges: [
      {
        id: challengeId,
        title: 'Défi de prière de 30 jours',
        description: 'Prier 3 fois par jour pendant 30 jours',
        duration: 30,
        startDate: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 jours plus tôt
        endDate: new Date(Date.now() + 86400000 * 20).toISOString(), // 20 jours plus tard
        completed: false,
        progress: 33,
        category: 'Prière',
        difficulty: 'moyen',
        frequency: 'quotidien',
        dailyTasks: [
          {
            id: makeId(),
            challengeId,
            day: 1,
            title: 'Prier le matin',
            completed: true,
            completedDate: new Date(Date.now() - 86400000 * 10).toISOString()
          },
          {
            id: makeId(),
            challengeId,
            day: 2,
            title: 'Prier le midi',
            completed: true,
            completedDate: new Date(Date.now() - 86400000 * 9).toISOString()
          },
          {
            id: makeId(),
            challengeId,
            day: 3,
            title: 'Prier le soir',
            completed: false
          }
        ]
      }
    ],
    verses: [
      {
        id: makeId(),
        reference: 'Philippiens 4:13',
        text: 'Je peux tout faire par celui qui me fortifie.'
      },
      {
        id: makeId(),
        reference: 'Jérémie 29:11',
        text: 'Car je connais les projets que je forme sur vous, dit l\'Éternel, des projets de paix et non de malheur, afin de vous donner un avenir et une espérance.'
      }
    ],
    prayerRequests: [],
    progress: [
      {
        id: makeId(),
        userId: 'user1',
        date: new Date().toISOString(),
        prayerCount: 5,
        readingCount: 3,
        challengeCompleted: 1,
        notes: 'Sens une croissance spirituelle significative cette semaine'
      },
      {
        id: makeId(),
        userId: 'user1',
        date: new Date(Date.now() - 86400000).toISOString(),
        prayerCount: 7,
        readingCount: 2,
        challengeCompleted: 0,
        notes: 'Beaucoup prié pour la famille cette semaine'
      }
    ],
    templates: [
      {
        id: makeId(),
        type: 'plan',
        title: 'Plan 7 jours - Renouveau',
        description: 'Un court parcours pour relancer ta lecture.',
        days: 7,
        scheduleMode: 'calendar',
        schedule: [
          ['Jean 1', 'Psaumes 1'],
          ['Jean 2', 'Psaumes 2'],
          ['Jean 3', 'Psaumes 3'],
          ['Jean 4', 'Psaumes 4'],
          ['Jean 5', 'Psaumes 5'],
          ['Jean 6', 'Psaumes 6'],
          ['Jean 7', 'Psaumes 7'],
        ],
        visibility: 'private',
        createdAt: new Date().toISOString(),
      },
      {
        id: makeId(),
        type: 'challenge',
        title: 'Défi gratitude 14 jours',
        description: 'Chaque jour, note 3 sujets de gratitude et prie dessus.',
        duration: 14,
        taskList: ['Note 3 gratitudes', 'Prière de 5 minutes'],
        category: 'Prière',
        difficulty: 'facile',
        frequency: 'quotidien',
        visibility: 'private',
        createdAt: new Date().toISOString(),
      },
    ]
  };
}

const SpiritualPage = () => {
  const [prayers, setPrayers] = useState<PrayerEntry[]>([]);
  const [readingPlans, setReadingPlans] = useState<ReadingPlan[]>([]);
  const [challenges, setChallenges] = useState<SpiritualChallenge[]>([]);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequest[]>([]);
  const [progress, setProgress] = useState<SpiritualProgress[]>([]);
  const [templates, setTemplates] = useState<SpiritualTemplate[]>([]);
  const [communityTemplates, setCommunityTemplates] = useState<SpiritualTemplate[]>([]);
  const [reportCounts, setReportCounts] = useState<Record<string, number>>({});
  const [communityStatus, setCommunityStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [adminMode, setAdminMode] = useState(false);
  const [ready, setReady] = useState(false);
  const [syncReady, setSyncReady] = useState(false);
  const [prayerStatus, setPrayerStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [selectedPassage, setSelectedPassage] = useState<string | null>(null);
  const [selectedPassageData, setSelectedPassageData] = useState<{ reference: string; text: string } | null>(null);
  const [storyVerse, setStoryVerse] = useState<{ reference: string; text: string; version?: string; language?: string } | null>(null);

  type CommunityTab = 'feed' | 'groups' | 'requests' | 'library';
  const [activeTab, setActiveTab] = useState<CommunityTab>('feed');
  const lastUpdatedRef = useRef<number>(0);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { syncId } = useSettings();
  const visibleCommunityTemplates = communityTemplates.filter(
    (tpl) => (reportCounts[tpl.id] || 0) < 3
  );

  const computeEffectiveDay = (plan: ReadingPlan) => {
    if (plan.startDate) {
      const start = new Date(plan.startDate).getTime();
      const now = new Date().setHours(0, 0, 0, 0);
      const startDay = new Date(start).setHours(0, 0, 0, 0);
      const diff = Math.max(0, Math.floor((now - startDay) / 86400000));
      return Math.min(plan.days, diff + 1);
    }
    return Math.max(1, Math.min(plan.days, plan.currentDay ?? 1));
  };

  const normalizeTemplates = (list: SpiritualTemplate[] = []) =>
    list.map((tpl) => ({
      ...tpl,
      visibility: tpl.visibility || 'private',
      createdAt: tpl.createdAt || new Date().toISOString(),
      schedule: tpl.schedule || undefined,
      taskList: tpl.taskList || undefined,
    }));

  const withDailyVerses = (plan: ReadingPlan) => {
    const key = plan.planKey || 'bible-1y';
    const categoryMap: Record<string, string> = {
      'bible-1y': 'Bible complète',
      'psaumes-proverbes': 'Psaumes & Sagesse',
      'nt-90': 'Nouveau Testament',
    };
    const day = computeEffectiveDay(plan);
    let verses: string[] = [];
    let totalDays = plan.days;
    if (plan.schedule && plan.schedule.length) {
      totalDays = plan.schedule.length;
      const index = Math.max(1, Math.min(totalDays, day)) - 1;
      verses = plan.schedule[index] || [];
    } else {
      verses = getDailyVerses(key, day);
    }
    return {
      ...plan,
      days: totalDays,
      planCategory: plan.planCategory || categoryMap[key] || 'Plan biblique',
      dailyVerses: verses,
      currentDay: day,
      completed: day >= totalDays,
    };
  };

  const buildWeekPreview = (plan: ReadingPlan, count = 7) => {
    const key = plan.planKey || 'bible-1y';
    const startDay = computeEffectiveDay(plan);
    const list: string[][] = [];
    for (let i = 0; i < count; i += 1) {
      if (plan.schedule && plan.schedule.length) {
        const index = Math.max(1, Math.min(plan.schedule.length, startDay + i)) - 1;
        list.push(plan.schedule[index] || []);
      } else {
        list.push(getDailyVerses(key, Math.min(plan.days, startDay + i)));
      }
    }
    return list;
  };
  
  // Chargement des données simulées
  useEffect(() => {
    const load = () => {
      if (typeof window === 'undefined') return null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    const saved = load();
    const data = saved?.prayers ? saved : buildMockData();
    if (!data.meta) {
      data.meta = { version: 1, updatedAt: Date.now() };
    }
    lastUpdatedRef.current = Number(data.meta?.updatedAt || Date.now());

    setPrayers(data.prayers || []);
    const plans = (data.readingPlans || []).map((p: ReadingPlan) => {
      const planKey = p.planKey || (p.title?.toLowerCase().includes('psaumes') ? 'psaumes-proverbes' : 'bible-1y');
      return withDailyVerses({ ...p, planKey });
    });
    setReadingPlans(plans);
    setChallenges(data.challenges || []);
    setVerses(data.verses || []);
    setPrayerRequests(data.prayerRequests || []);
    setProgress(data.progress || []);
    setTemplates(normalizeTemplates(data.templates || []));
    try {
      const savedAdmin = localStorage.getItem(ADMIN_KEY);
      setAdminMode(savedAdmin === '1');
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setSyncReady(false);
  }, [syncId, ready]);

  useEffect(() => {
    getRandomLocalVerse().then((verse) => setStoryVerse(toStoryVerse(verse)));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!syncId) {
      setSyncReady(true);
      return;
    }
    let cancelled = false;
    const loadRemote = async () => {
      const remote = await fetchSpiritualState(syncId);
      if (cancelled) return;
      if (remote?.payload) {
        const remoteUpdated = Number(remote.payload?.meta?.updatedAt || remote.updatedAt || 0);
          if (remoteUpdated > lastUpdatedRef.current) {
            const incoming = remote.payload;
            lastUpdatedRef.current = remoteUpdated;
            setPrayers(incoming.prayers || []);
            setReadingPlans((incoming.readingPlans || []).map((plan: ReadingPlan) => withDailyVerses(plan)));
            setChallenges(incoming.challenges || []);
            setVerses(incoming.verses || []);
            setPrayerRequests(incoming.prayerRequests || []);
            setProgress(incoming.progress || []);
            setTemplates(normalizeTemplates(incoming.templates || []));
          }
      }
      setSyncReady(true);
    };
    loadRemote().catch(() => setSyncReady(true));
    return () => {
      cancelled = true;
    };
  }, [ready, syncId]);

  useEffect(() => {
    if (!ready || !syncReady || typeof window === 'undefined') return;
    const now = Date.now();
    lastUpdatedRef.current = now;
    const payload = {
      meta: { version: 1, updatedAt: now },
      prayers,
      readingPlans,
      challenges,
      verses,
      prayerRequests,
      progress,
      templates,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    try {
      localStorage.setItem(ADMIN_KEY, adminMode ? '1' : '0');
    } catch {
      // ignore
    }

    if (syncId) {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      syncTimerRef.current = setTimeout(() => {
        upsertSpiritualState(syncId, payload).catch(() => {});
      }, 1200);
    }
  }, [prayers, readingPlans, challenges, verses, prayerRequests, progress, templates, adminMode, ready, syncReady, syncId]);

  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      setReadingPlans((prev) => prev.map((plan) => withDailyVerses(plan)));
    };
    tick();
    const timer = setInterval(tick, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [ready]);

  const addPrayer = (payload: { title: string; content: string; category: string; tags: string[] }) => {
    const next: PrayerEntry = {
      id: makeId(),
      title: payload.title,
      content: payload.content,
      category: payload.category,
      tags: payload.tags,
      date: new Date().toISOString(),
      answered: false,
    };
    setPrayers((prev) => [next, ...prev]);
  };

  const togglePrayerAnswered = (id: string, answered: boolean) => {
    setPrayers((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              answered,
              answerDate: answered ? new Date().toISOString() : undefined,
            }
          : p
      )
    );
  };

  const addPrayerAnswer = (id: string, answer: string) => {
    setPrayers((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              answer,
              answered: true,
              answerDate: p.answerDate ?? new Date().toISOString(),
            }
          : p
      )
    );
  };

  const removePrayer = (id: string) => {
    setPrayers((prev) => prev.filter((p) => p.id !== id));
  };

  const advanceReadingPlan = (id: string, delta: number) => {
    setReadingPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== id) return plan;
        if (plan.startDate) {
          const start = new Date(plan.startDate);
          start.setDate(start.getDate() - delta);
          return withDailyVerses({ ...plan, startDate: start.toISOString(), mode: 'auto' });
        }
        const current = plan.currentDay ?? 1;
        const nextDay = Math.min(plan.days, Math.max(1, current + delta));
        return withDailyVerses({ ...plan, currentDay: nextDay, mode: 'manual' });
      })
    );
  };

  const resetReadingPlan = (id: string) => {
    setReadingPlans((prev) =>
      prev.map((plan) =>
        plan.id === id
          ? withDailyVerses({
              ...plan,
              startDate: new Date().toISOString(),
              currentDay: 1,
              mode: 'auto',
            })
          : plan
      )
    );
  };

  const startReadingToday = (id: string) => {
    setReadingPlans((prev) =>
      prev.map((plan) =>
        plan.id === id
          ? withDailyVerses({
              ...plan,
              startDate: new Date().toISOString(),
              mode: 'auto',
            })
          : plan
      )
    );
  };

  const toggleChallengeTask = (challengeId: string, taskId: string) => {
    setChallenges((prev) =>
      prev.map((challenge) => {
        if (challenge.id !== challengeId) return challenge;
        const tasks = challenge.dailyTasks.map((task) => {
          if (task.id !== taskId) return task;
          const nextCompleted = !task.completed;
          return {
            ...task,
            completed: nextCompleted,
            completedDate: nextCompleted ? new Date().toISOString() : undefined,
          };
        });
        const done = tasks.filter((t) => t.completed).length;
        const progressValue = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
        return {
          ...challenge,
          dailyTasks: tasks,
          progress: progressValue,
          completed: done > 0 && done === tasks.length,
        };
      })
    );
  };

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    setPrayerStatus('syncing');
    fetchPrayerRequestsRemote()
      .then((items) => {
        if (!cancelled) setPrayerRequests(items);
        setPrayerStatus('idle');
      })
      .catch(() => {
        if (!cancelled) setPrayerStatus('error');
      });

    const channel = subscribePrayerRequests(async () => {
      const items = await fetchPrayerRequestsRemote().catch(() => []);
      if (!cancelled) setPrayerRequests(items);
    });

    return () => {
      cancelled = true;
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, []);

  const refreshCommunity = async () => {
    try {
      setCommunityStatus('loading');
      const items = await fetchCommunityTemplates();
      setCommunityTemplates(items);
      const counts = await fetchTemplateReports(items.map((t) => t.id));
      setReportCounts(counts);
      setCommunityStatus('idle');
    } catch {
      setCommunityStatus('error');
    }
  };

  useEffect(() => {
    refreshCommunity();
  }, []);

  const addPrayerRequest = async (payload: { content: string; city: string }) => {
    const tempId = makeId();
    const next: PrayerRequest = {
      id: tempId,
      content: payload.content,
      location: {
        latitude: 0,
        longitude: 0,
        city: payload.city || '—',
      },
      date: new Date().toISOString(),
      prayedForCount: 0,
      status: 'requested',
    };
    setPrayerRequests((prev) => [next, ...prev]);
    if (!supabase) return;
    const remote = await addPrayerRequestRemote(payload.content, payload.city || '—');
    if (remote) {
      setPrayerRequests((prev) =>
        prev.map((req) => (req.id === tempId ? remote : req))
      );
    }
  };

  const markPrayed = async (id: string) => {
    setPrayerRequests((prev) =>
      prev.map((req) =>
        req.id === id
          ? {
              ...req,
              prayedForCount: req.prayedForCount + 1,
              status: req.status === 'answered' ? 'answered' : 'prayed',
            }
          : req
      )
    );
    if (!supabase) return;
    const item = prayerRequests.find((r) => r.id === id);
    if (!item) return;
    await updatePrayerRequestRemote(id, {
      prayedForCount: item.prayedForCount + 1,
      status: item.status === 'answered' ? 'answered' : 'prayed',
    });
  };

  const markAnswered = async (id: string) => {
    setPrayerRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: 'answered' } : req))
    );
    if (!supabase) return;
    await updatePrayerRequestRemote(id, { status: 'answered' });
  };

  const addProgress = (payload: { prayerCount: number; readingCount: number; challengeCompleted: number; notes: string }) => {
    const next: SpiritualProgress = {
      id: makeId(),
      userId: 'user1',
      date: new Date().toISOString(),
      prayerCount: payload.prayerCount,
      readingCount: payload.readingCount,
      challengeCompleted: payload.challengeCompleted,
      notes: payload.notes,
    };
    setProgress((prev) => [next, ...prev].slice(0, 30));
  };

  const createPlanFromTemplate = (template: SpiritualTemplate, source: 'personal' | 'community' | 'official') => {
    const scheduleMode = template.scheduleMode || 'auto';
    const schedule = scheduleMode === 'calendar' ? template.schedule || [] : undefined;
    const days = scheduleMode === 'calendar'
      ? Math.max(1, schedule?.length || template.days || 1)
      : Math.max(1, template.days || 30);
    const base: ReadingPlan = {
      id: makeId(),
      title: template.title,
      description: template.description,
      days,
      dailyVerses: [],
      completed: false,
      startDate: new Date().toISOString(),
      planKey: scheduleMode === 'auto' ? template.planKey || 'bible-1y' : undefined,
      planCategory: scheduleMode === 'auto' ? 'Plan biblique' : 'Plan personnalisé',
      mode: 'auto',
      schedule,
      templateId: template.id,
      templateSource: source,
    };
    const next = withDailyVerses(base);
    setReadingPlans((prev) => [next, ...prev]);
  };

  const createChallengeFromTemplate = (template: SpiritualTemplate, source: 'personal' | 'community' | 'official') => {
    const duration = Math.max(1, template.duration || 7);
    const taskList = template.taskList?.length ? template.taskList : ['Prière personnelle'];
    const challengeId = makeId();
    const dailyTasks = Array.from({ length: duration }, (_, idx) => ({
      id: makeId(),
      challengeId,
      day: idx + 1,
      title: taskList[idx % taskList.length],
      completed: false,
    }));
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration - 1);
    const next: SpiritualChallenge = {
      id: challengeId,
      title: template.title,
      description: template.description,
      duration,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      completed: false,
      dailyTasks,
      progress: 0,
      category: template.category,
      difficulty: template.difficulty,
      frequency: template.frequency,
      templateId: template.id,
      templateSource: source,
    };
    setChallenges((prev) => [next, ...prev]);
  };

  const handleCreateTemplate = async (payload: { template: SpiritualTemplate; publishNow: boolean }) => {
    const template = {
      ...payload.template,
      createdBy: payload.template.createdBy || syncId || undefined,
      updatedAt: new Date().toISOString(),
    };
    setTemplates((prev) => [template, ...prev]);
    if (payload.publishNow) {
      await publishTemplate(template);
      refreshCommunity();
    }
  };

  const handlePublishTemplate = async (template: SpiritualTemplate, visibility: 'public' | 'official') => {
    const updated: SpiritualTemplate = {
      ...template,
      visibility,
      createdBy: template.createdBy || syncId || undefined,
      updatedAt: new Date().toISOString(),
    };
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? updated : t)));
    await publishTemplate(updated);
    refreshCommunity();
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
  };

  const handleReportTemplate = async (template: SpiritualTemplate, reason: string) => {
    await reportTemplate(template.id, template.type, reason, syncId || undefined);
    refreshCommunity();
  };

  if (!ready) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl px-4 py-12 text-[color:var(--foreground)]">
          Chargement des outils spirituels…
        </div>
      </AppShell>
    );
  }
  
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6 text-[color:var(--foreground)]">
        {/* Header */}
        <div className="glass-panel rounded-3xl p-6 mb-6 card-anim">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--foreground)]/60">
            Communautés
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mt-2">Réseau chrétien</h1>
          <p className="mt-2 text-[color:var(--foreground)]/70">
            Partage, prie, encourage — ensemble dans la foi.
          </p>
        </div>

        {/* 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_340px] gap-6">
          {/* Sidebar */}
          <aside className="glass-panel rounded-3xl p-4 h-fit lg:sticky lg:top-24">
            <CommunityIdentityCard />

            <div className="mt-4 text-sm font-semibold mb-3">Navigation</div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setActiveTab('feed')}
                className={`btn-base w-full justify-start text-sm px-3 py-3 ${
                  activeTab === 'feed' ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                Fil d’actualité
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('groups')}
                className={`btn-base w-full justify-start text-sm px-3 py-3 ${
                  activeTab === 'groups' ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                Groupes
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('requests')}
                className={`btn-base w-full justify-start text-sm px-3 py-3 ${
                  activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                Demandes de prière
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('library')}
                className={`btn-base w-full justify-start text-sm px-3 py-3 ${
                  activeTab === 'library' ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                Plans & défis
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold opacity-70">Conseil</div>
              <div className="mt-2 text-sm text-[color:var(--foreground)]/75 leading-6">
                Poste un témoignage, une requête, ou un verset. La communauté peut prier et encourager.
              </div>
            </div>
          </aside>

          {/* Center feed */}
          <main className="space-y-4">
            {activeTab === 'feed' ? (
              <>
                <div className="glass-panel rounded-3xl p-4">
                  <FeedHeader />
                  <div className="mt-4">
                    <StoriesRow />
                  </div>
                </div>

                <CommunityStories />
                {storyVerse ? (
                  <div className="glass-panel rounded-3xl p-4">
                    <div className="text-xs opacity-60">Verset aléatoire</div>
                    <div className="mt-2 font-semibold">{storyVerse.reference}</div>
                    <div className="mt-2 text-sm opacity-90">{storyVerse.text}</div>
                    {storyVerse.version ? (
                      <div className="mt-1 text-xs opacity-70">Version: {storyVerse.version}</div>
                    ) : null}

                    <button
                      className="btn-base btn-primary mt-4 px-4 py-2 text-sm"
                      onClick={() => getRandomLocalVerse().then((verse) => setStoryVerse(toStoryVerse(verse)))}
                    >
                      Nouveau verset 🎲
                    </button>
                  </div>
                ) : null}
                <CommunityComposer onPosted={() => {}} passage={selectedPassageData} />
                <CommunityFeed />
              </>
            ) : null}

            {activeTab === 'groups' ? (
              <PrayerGroupsPanel />
            ) : null}

            {activeTab === 'library' ? (
              <CommunityLibrary
                templates={visibleCommunityTemplates}
                reportCounts={reportCounts}
                onStartPlan={createPlanFromTemplate}
                onStartChallenge={createChallengeFromTemplate}
                onReport={handleReportTemplate}
              />
            ) : null}

            {activeTab === 'requests' ? (
              <PrayerMap
                requests={prayerRequests}
                onAddRequest={addPrayerRequest}
                onPray={markPrayed}
                onAnswer={markAnswered}
              />
            ) : null}
          </main>

          {/* Right widgets */}
          <aside className="space-y-4 lg:sticky lg:top-24 h-fit">
            <StoriesBar />
            <RightPanel />

          </aside>
        </div>
      </div>
    </AppShell>
  );
};

export default SpiritualPage;
