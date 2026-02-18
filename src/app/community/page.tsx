'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '../../components/AppShell';
import CommunityComposer from '../../components/CommunityComposer';
import CommunityFeed from '../../components/CommunityFeed';
import CommunityIdentityCard from '../../components/CommunityIdentityCard';
import CommunityStories from '../../components/CommunityStories';
import CommunityGroups from '../../components/CommunityGroups';
import { PrayerMap } from '../../components/SpiritualFeatures';
import { SeriesList } from '../../components/SeriesManagement';
import { canPublishAnnouncement } from '../../components/communityApi';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../contexts/I18nContext';
import {
  addPrayerRequestRemote,
  fetchPrayerRequestsRemote,
  subscribePrayerRequests,
  updatePrayerRequestRemote,
} from '../../components/prayerRequests';
import type { PrayerRequest } from '../../types/spiritual';
import { BookOpen, HandHeart, Megaphone, Handshake, LayoutList, Users } from 'lucide-react';

type TabKey = 'all' | 'prayer' | 'help' | 'announcements' | 'content' | 'groups';

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<AppShell><div className="mx-auto max-w-7xl px-4 py-6">{'...'}</div></AppShell>}>
      <CommunityPageInner />
    </Suspense>
  );
}

function CommunityPageInner() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [feedRefreshToken, setFeedRefreshToken] = useState(0);
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequest[]>([]);
  const [canPostAnnouncements, setCanPostAnnouncements] = useState(false);
  const [announcementAccessChecked, setAnnouncementAccessChecked] = useState(false);
  const tabs = useMemo<Array<{ key: TabKey; label: string; icon: ElementType; description: string }>>(
    () => [
      {
        key: 'all',
        label: t('community.tab.all'),
        icon: LayoutList,
        description: t('community.tabDesc.all'),
      },
      {
        key: 'prayer',
        label: t('community.tab.prayer'),
        icon: HandHeart,
        description: t('community.tabDesc.prayer'),
      },
      {
        key: 'help',
        label: t('community.tab.help'),
        icon: Handshake,
        description: t('community.tabDesc.help'),
      },
      {
        key: 'announcements',
        label: t('community.tab.announcements'),
        icon: Megaphone,
        description: t('community.tabDesc.announcements'),
      },
      {
        key: 'content',
        label: t('community.tab.content'),
        icon: BookOpen,
        description: t('community.tabDesc.content'),
      },
      {
        key: 'groups',
        label: t('community.tab.groups'),
        icon: Users,
        description: t('community.tabDesc.groups'),
      },
    ],
    [t]
  );

  const loadPrayerRequests = async () => {
    const list = await fetchPrayerRequestsRemote();
    setPrayerRequests(list);
  };

  useEffect(() => {
    loadPrayerRequests();
    const channel = subscribePrayerRequests(() => loadPrayerRequests());
    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const groupId = searchParams.get('group');
    if (groupId) setActiveTab('groups');
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const loadAnnouncementPermission = async () => {
      try {
        const allowed = await canPublishAnnouncement();
        if (cancelled) return;
        setCanPostAnnouncements(allowed);
      } finally {
        if (!cancelled) setAnnouncementAccessChecked(true);
      }
    };

    void loadAnnouncementPermission();
    return () => {
      cancelled = true;
    };
  }, []);

  const addPrayerRequest = async (payload: { content: string; city: string }) => {
    const tempId = makeId();
    const next: PrayerRequest = {
      id: tempId,
      content: payload.content,
      location: { latitude: 0, longitude: 0, city: payload.city || '—' },
      date: new Date().toISOString(),
      prayedForCount: 0,
      status: 'requested',
    };
    setPrayerRequests((prev) => [next, ...prev]);
    if (!supabase) return;
    const remote = await addPrayerRequestRemote(payload.content, payload.city || '—');
    if (remote) {
      setPrayerRequests((prev) => prev.map((req) => (req.id === tempId ? remote : req)));
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

  const activeTabMeta = useMemo(
    () => tabs.find((t) => t.key === activeTab),
    [activeTab, tabs]
  );
  const isGroupsTab = activeTab === 'groups';
  const bumpFeedRefresh = () => setFeedRefreshToken((prev) => prev + 1);
  const feedFallback = (
    <div className="glass-panel rounded-3xl p-4 text-sm text-[color:var(--foreground)]/70">
      {t('feed.loading')}
    </div>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6 text-[color:var(--foreground)]">
        <div className="rounded-2xl bg-[color:var(--surface-strong)] border border-[color:var(--border-soft)] p-6 mb-6">
          <div className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[color:var(--text-muted)]">
            {t('community.badge')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mt-2 tracking-tight">{t('community.title')}</h1>
          <p className="mt-2 text-[15px] text-[color:var(--text-muted)] leading-relaxed">
            {t('community.subtitle')}
          </p>
        </div>

        <div
          className={`grid grid-cols-1 gap-6 ${isGroupsTab
            ? 'xl:grid-cols-[260px_minmax(0,1fr)]'
            : 'xl:grid-cols-[260px_minmax(0,1fr)_320px]'
            }`}
        >
          <aside className="hidden xl:block space-y-4 xl:sticky xl:top-24 h-fit">
            <CommunityIdentityCard />

            <div className="rounded-2xl bg-[color:var(--surface-strong)] border border-[color:var(--border-soft)] p-4">
              <div className="text-sm font-semibold mb-3">{t('community.navigation')}</div>
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = tab.key === activeTab;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`w-full flex items-center text-[13px] font-semibold px-3 py-2.5 rounded-[10px] transition-all duration-200 ${active
                        ? 'bg-[rgba(200,168,54,0.10)] text-[#C8A836]'
                        : 'text-[color:var(--text-muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]'
                        }`}
                    >
                      <Icon size={16} className="mr-2.5" strokeWidth={active ? 2.2 : 1.8} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTabMeta ? (
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-4">
                <div className="text-xs font-semibold opacity-70">
                  {activeTabMeta.label}
                </div>
                <div className="mt-2 text-sm text-[color:var(--foreground)]/75 leading-6">
                  {activeTabMeta.description}
                </div>
              </div>
            ) : null}
          </aside>

          <main className="space-y-4">
            <div className="rounded-2xl bg-[color:var(--surface-strong)] border border-[color:var(--border-soft)] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[color:var(--text-muted)]">
                    {activeTabMeta?.label || t('community.title')}
                  </div>
                  <div className="text-base font-bold mt-1">
                    {activeTabMeta?.description || t('community.subtitle')}
                  </div>
                </div>
                <div className="rounded-[10px] bg-[color:var(--surface)] border border-[color:var(--border-soft)] px-3 py-1.5 text-[12px] font-semibold text-[color:var(--text-muted)]">
                  {t('identity.subtitle')}
                </div>
              </div>
            </div>

            <div className="xl:hidden sticky top-[72px] z-20 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)]/95 p-2.5 backdrop-blur-xl">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = tab.key === activeTab;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] font-semibold transition-all duration-200 ${active
                        ? 'bg-[rgba(200,168,54,0.10)] text-[#C8A836]'
                        : 'text-[color:var(--text-muted)] hover:bg-[color:var(--surface)]'
                        }`}
                    >
                      <Icon size={14} strokeWidth={active ? 2.2 : 1.8} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              {activeTabMeta ? (
                <div className="mt-2 text-xs text-[color:var(--foreground)]/70">
                  {activeTabMeta.description}
                </div>
              ) : null}
            </div>

            <CommunityStories />

            {activeTab === 'all' ? (
              <>
                <div className="glass-panel rounded-3xl p-4 text-sm text-[color:var(--foreground)]/70">
                  {t('community.feedReadOnlyInfo')}
                </div>
                <Suspense fallback={feedFallback}>
                  <CommunityFeed
                    showKind
                    mode="deck"
                    emptyLabel={t('feed.emptyDefault')}
                    refreshToken={feedRefreshToken}
                  />
                </Suspense>
              </>
            ) : null}

            {activeTab === 'prayer' ? (
              <>
                <CommunityComposer
                  kind="prayer"
                  placeholder={t('community.placeholder.prayer')}
                  onPosted={bumpFeedRefresh}
                />

                <PrayerMap
                  requests={prayerRequests}
                  onAddRequest={addPrayerRequest}
                  onPray={markPrayed}
                  onAnswer={markAnswered}
                />

                <Suspense fallback={feedFallback}>
                  <CommunityFeed
                    kind="prayer"
                    showKind={false}
                    emptyLabel={t('community.empty.prayer')}
                    refreshToken={feedRefreshToken}
                  />
                </Suspense>
              </>
            ) : null}

            {activeTab === 'help' ? (
              <>
                <CommunityComposer
                  kind="help"
                  allowStory={false}
                  placeholder={t('community.placeholder.help')}
                  submitLabel={t('community.submit.help')}
                  onPosted={bumpFeedRefresh}
                />
                <Suspense fallback={feedFallback}>
                  <CommunityFeed
                    kind="help"
                    showKind={false}
                    emptyLabel={t('community.empty.help')}
                    refreshToken={feedRefreshToken}
                  />
                </Suspense>
              </>
            ) : null}

            {activeTab === 'announcements' ? (
              <>
                <div className="glass-panel rounded-3xl p-4 text-sm text-[color:var(--foreground)]/70">
                  {canPostAnnouncements
                    ? t('community.announcementsInfo')
                    : t('community.announcementAdminOnly')}
                </div>
                {announcementAccessChecked && canPostAnnouncements ? (
                  <CommunityComposer
                    kind="announcement"
                    allowStory={false}
                    placeholder={t('community.placeholder.announcement')}
                    submitLabel={t('community.submit.announcement')}
                    onPosted={bumpFeedRefresh}
                  />
                ) : null}
                <Suspense fallback={feedFallback}>
                  <CommunityFeed
                    kind="announcement"
                    showKind={false}
                    emptyLabel={t('community.empty.announcements')}
                    refreshToken={feedRefreshToken}
                  />
                </Suspense>
              </>
            ) : null}

            {activeTab === 'content' ? (
              <>
                <CommunityComposer
                  kind="content"
                  allowStory={false}
                  placeholder={t('community.placeholder.content')}
                  submitLabel={t('community.submit.content')}
                  onPosted={bumpFeedRefresh}
                />
                <SeriesList />
                <Suspense fallback={feedFallback}>
                  <CommunityFeed
                    kind="content"
                    showKind={false}
                    emptyLabel={t('community.empty.content')}
                    refreshToken={feedRefreshToken}
                  />
                </Suspense>
              </>
            ) : null}

            {activeTab === 'groups' ? (
              <CommunityGroups initialGroupId={searchParams.get('group')} />
            ) : null}
          </main>

          <aside className="hidden xl:block space-y-4 xl:sticky xl:top-24 h-fit" style={{ display: isGroupsTab ? 'none' : undefined }}>
            <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-4 shadow-[var(--shadow-soft)]">
              <div className="text-xs uppercase tracking-[0.18em] opacity-60">Communaute</div>
              <div className="mt-2 text-lg font-extrabold">Fil social</div>
              <p className="mt-2 text-sm text-[color:var(--foreground)]/70 leading-6">
                Poste comme sur un reseau social: texte court, image, reaction et commentaires.
              </p>
            </div>

            <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-4 shadow-[var(--shadow-soft)]">
              <div className="text-sm font-semibold">Bonnes pratiques</div>
              <ul className="mt-3 space-y-2 text-sm text-[color:var(--foreground)]/75">
                <li>Messages courts et clairs.</li>
                <li>Partage des images pertinentes.</li>
                <li>Commentaires respectueux et constructifs.</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-4 shadow-[var(--shadow-soft)]">
              <div className="text-sm font-semibold">Section active</div>
              <div className="mt-2 text-sm text-[color:var(--foreground)]/70">
                {activeTabMeta?.label}
              </div>
              <div className="mt-1 text-xs text-[color:var(--foreground)]/60 leading-5">
                {activeTabMeta?.description}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
