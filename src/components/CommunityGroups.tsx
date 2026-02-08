'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  ExternalLink,
  Link2,
  Loader2,
  PlusCircle,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  createGroup,
  fetchGroups,
  joinGroup,
  leaveGroup,
  updateGroup,
  type CommunityGroup,
  type CommunityGroupType,
} from './communityApi';
import CommunityComposer from './CommunityComposer';
import CommunityFeed from './CommunityFeed';
import CommunityGroupCall from './CommunityGroupCall';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { useI18n } from '../contexts/I18nContext';

type CreateState = 'idle' | 'saving';

function formatWhen(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const GROUP_TYPES: CommunityGroupType[] = ['general', 'prayer', 'study', 'support'];

export default function CommunityGroups({ initialGroupId }: { initialGroupId?: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { identity } = useCommunityIdentity();
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [actionState, setActionState] = useState<Record<string, boolean>>({});
  const [createState, setCreateState] = useState<CreateState>('idle');
  const [savingGroupState, setSavingGroupState] = useState(false);
  const [feedRefreshToken, setFeedRefreshToken] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId || '');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState<CommunityGroupType>('general');
  const [nextCallAt, setNextCallAt] = useState('');
  const [detailDescription, setDetailDescription] = useState('');
  const [detailNextCallAt, setDetailNextCallAt] = useState('');

  const actor = useMemo(() => {
    return {
      deviceId: identity?.deviceId || '',
      displayName: (identity?.displayName || '').trim() || t('identity.guest'),
    };
  }, [identity?.deviceId, identity?.displayName, t]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  const updateGroupQuery = useCallback(
    (groupId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (groupId) params.set('group', groupId);
      else params.delete('group');
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      router.replace(url, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const onSelectGroup = useCallback(
    (groupId: string) => {
      setSelectedGroupId(groupId);
      updateGroupQuery(groupId);
    },
    [updateGroupQuery]
  );

  const loadGroups = useCallback(async () => {
    setStatus('loading');
    try {
      const list = await fetchGroups(60, actor.deviceId || undefined);
      setGroups(list);
      if (!selectedGroupId && list.length) {
        const queryGroup = searchParams.get('group') || initialGroupId || '';
        const chosen = list.some((item) => item.id === queryGroup) ? queryGroup : list[0].id;
        if (chosen) setSelectedGroupId(chosen);
      }
      setStatus('ready');
    } catch {
      setStatus('error');
      setFeedback(t('community.groups.loadError'));
    }
  }, [actor.deviceId, initialGroupId, searchParams, selectedGroupId, t]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!selectedGroup) return;
    setDetailDescription(selectedGroup.description || '');
    if (selectedGroup.next_call_at) {
      const date = new Date(selectedGroup.next_call_at);
      const yyyy = String(date.getFullYear());
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      setDetailNextCallAt(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    } else {
      setDetailNextCallAt('');
    }
  }, [selectedGroup]);

  const onCreate = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      setFeedback(t('community.groups.nameTooShort'));
      return;
    }
    if (!actor.deviceId) {
      setFeedback(t('community.groups.actionError'));
      return;
    }

    setCreateState('saving');
    try {
      const created = await createGroup({
        name: trimmedName,
        description: description.trim(),
        group_type: groupType,
        created_by_name: actor.displayName,
        created_by_device_id: actor.deviceId,
        next_call_at: nextCallAt ? new Date(nextCallAt).toISOString() : null,
      });

      setName('');
      setDescription('');
      setGroupType('general');
      setNextCallAt('');
      setFeedback(t('community.groups.created'));
      if (created?.id) {
        setSelectedGroupId(created.id);
        updateGroupQuery(created.id);
      }
      await loadGroups();
    } catch (error: any) {
      setFeedback(error?.message || t('community.groups.createError'));
    } finally {
      setCreateState('idle');
    }
  };

  const onJoin = async (groupId: string) => {
    if (!actor.deviceId) return;
    setActionState((prev) => ({ ...prev, [groupId]: true }));
    try {
      await joinGroup(groupId, actor.deviceId, actor.displayName);
      await loadGroups();
    } catch {
      setFeedback(t('community.groups.actionError'));
    } finally {
      setActionState((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  const onLeave = async (groupId: string) => {
    if (!actor.deviceId) return;
    setActionState((prev) => ({ ...prev, [groupId]: true }));
    try {
      await leaveGroup(groupId, actor.deviceId);
      await loadGroups();
    } catch {
      setFeedback(t('community.groups.actionError'));
    } finally {
      setActionState((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  const onSaveGroupSettings = async () => {
    if (!selectedGroup) return;
    setSavingGroupState(true);
    try {
      await updateGroup(selectedGroup.id, {
        description: detailDescription.trim(),
        call_provider: null,
        call_link: null,
        next_call_at: detailNextCallAt ? new Date(detailNextCallAt).toISOString() : null,
      });
      setFeedback(t('community.groups.saved'));
      await loadGroups();
    } catch {
      setFeedback(t('community.groups.saveError'));
    } finally {
      setSavingGroupState(false);
    }
  };

  const onShareGroup = async (groupId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin || ''}/community?group=${encodeURIComponent(groupId)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: t('community.groups.title'),
          text: t('community.groups.shareLabel'),
          url: shareUrl,
        });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setFeedback(t('community.groups.linkCopied'));
      }
    } catch {
      setFeedback(t('community.groups.actionError'));
    }
  };

  const renderTypeLabel = (value: CommunityGroupType) => {
    if (value === 'prayer') return t('community.groups.type.prayer');
    if (value === 'study') return t('community.groups.type.study');
    if (value === 'support') return t('community.groups.type.support');
    return t('community.groups.type.general');
  };

  return (
    <div className="space-y-4">
      <section className="glass-panel rounded-3xl p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--foreground)]/60">
              {t('community.groups.title')}
            </div>
            <h3 className="mt-1 text-xl font-extrabold">{t('community.groups.subtitle')}</h3>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold">
            {actor.displayName}
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-3xl p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PlusCircle size={16} />
          {t('community.groups.createTitle')}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-[color:var(--foreground)]/65">{t('community.groups.name')}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('community.groups.namePlaceholder')}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-[color:var(--foreground)]/65">{t('community.groups.type')}</span>
            <select
              value={groupType}
              onChange={(event) => setGroupType(event.target.value as CommunityGroupType)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
            >
              {GROUP_TYPES.map((value) => (
                <option key={value} value={value}>
                  {renderTypeLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-[color:var(--foreground)]/65">{t('community.groups.description')}</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('community.groups.descriptionPlaceholder')}
              rows={3}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-[color:var(--foreground)]/65">{t('community.groups.nextCall')}</span>
            <input
              value={nextCallAt}
              onChange={(event) => setNextCallAt(event.target.value)}
              type="datetime-local"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCreate}
            disabled={createState === 'saving'}
            className="btn-base btn-primary px-4 py-2 text-sm"
          >
            {createState === 'saving' ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                {t('community.groups.creating')}
              </span>
            ) : (
              t('community.groups.create')
            )}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        {status === 'loading' ? (
          <div className="glass-panel rounded-3xl p-4 text-sm text-[color:var(--foreground)]/70">
            {t('community.groups.loading')}
          </div>
        ) : null}

        {status === 'ready' && groups.length === 0 ? (
          <div className="glass-panel rounded-3xl p-4 text-sm text-[color:var(--foreground)]/70">
            {t('community.groups.empty')}
          </div>
        ) : null}

        {groups.map((group) => {
          const busy = !!actionState[group.id];
          const when = formatWhen(group.next_call_at);
          const isSelected = selectedGroupId === group.id;
          return (
            <article
              key={group.id}
              className={`rounded-3xl border p-4 shadow-[0_14px_34px_rgba(0,0,0,0.22)] ${
                isSelected
                  ? 'border-[color:var(--accent-border)] bg-[color:var(--surface-strong)]'
                  : 'border-white/10 bg-[color:var(--surface-strong)]/95'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-base font-extrabold">{group.name}</h4>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[color:var(--foreground)]/65">
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1">
                      {renderTypeLabel(group.group_type)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} />
                      {t('community.groups.members', { count: group.members_count })}
                    </span>
                    {group.joined ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <ShieldCheck size={12} />
                        {t('community.groups.joined')}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectGroup(group.id)}
                    className={`btn-base px-3 py-2 text-xs ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    <ExternalLink size={13} />
                    {t('community.groups.open')}
                  </button>
                  {group.joined ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onLeave(group.id)}
                      className="btn-base btn-secondary px-3 py-2 text-xs"
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                      {t('community.groups.leave')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onJoin(group.id)}
                      className="btn-base btn-primary px-3 py-2 text-xs"
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                      {t('community.groups.join')}
                    </button>
                  )}

                </div>
              </div>

              {group.description ? (
                <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]/80">{group.description}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[color:var(--foreground)]/65">
                {when ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays size={12} />
                    {when}
                  </span>
                ) : null}
              </div>
            </article>
          );
        })}

        {status === 'error' ? (
          <div className="glass-panel rounded-3xl p-4 text-sm text-rose-300">
            {t('community.groups.loadError')}
          </div>
        ) : null}
      </section>

      {selectedGroup ? (
        <section className="space-y-4 rounded-3xl border border-white/10 bg-[color:var(--surface-strong)]/95 p-4 shadow-[0_16px_44px_rgba(0,0,0,0.24)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--foreground)]/60">
                {t('community.groups.active')}
              </div>
              <h4 className="mt-1 text-xl font-extrabold">{selectedGroup.name}</h4>
              <div className="mt-1 text-sm text-[color:var(--foreground)]/70">
                {renderTypeLabel(selectedGroup.group_type)} · {t('community.groups.members', { count: selectedGroup.members_count })}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-base btn-secondary px-3 py-2 text-xs"
                onClick={() => onShareGroup(selectedGroup.id)}
              >
                <Link2 size={13} />
                {t('community.groups.share')}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
            <div className="text-sm font-semibold">{t('community.groups.callSchedule')}</div>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs text-[color:var(--foreground)]/65">{t('community.groups.description')}</span>
                <textarea
                  value={detailDescription}
                  onChange={(event) => setDetailDescription(event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-[color:var(--foreground)]/65">{t('community.groups.nextCall')}</span>
                <input
                  value={detailNextCallAt}
                  onChange={(event) => setDetailNextCallAt(event.target.value)}
                  type="datetime-local"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
                />
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={onSaveGroupSettings}
                className="btn-base btn-secondary px-3 py-2 text-xs"
                disabled={savingGroupState}
              >
                {savingGroupState ? <Loader2 size={13} className="animate-spin" /> : null}
                {t('community.groups.save')}
              </button>
            </div>
          </div>

          <CommunityGroupCall
            groupId={selectedGroup.id}
            deviceId={actor.deviceId}
            displayName={actor.displayName}
          />

          <CommunityComposer
            kind="general"
            groupId={selectedGroup.id}
            allowStory={false}
            placeholder={t('community.groups.postPlaceholder')}
            submitLabel={t('community.groups.post')}
            onPosted={() => setFeedRefreshToken((prev) => prev + 1)}
          />
          <CommunityFeed
            groupId={selectedGroup.id}
            showKind={false}
            emptyLabel={t('community.groups.feedEmpty')}
            refreshToken={feedRefreshToken}
          />
        </section>
      ) : null}

      {feedback ? (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-2xl border border-white/10 bg-[color:var(--surface-strong)] px-4 py-2 text-sm shadow-lg">
          {feedback}
        </div>
      ) : null}
    </div>
  );
}
