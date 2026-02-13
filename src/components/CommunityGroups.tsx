'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Link2,
  Loader2,
  PlusCircle,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  createGroup,
  fetchGroupMembers,
  fetchGroups,
  moderateGroupMember,
  triggerGroupCallPush,
  joinGroup,
  leaveGroup,
  updateGroup,
  fetchGroupCallPresence,
  type CommunityGroup,
  type CommunityGroupMember,
  type CommunityGroupMemberStatus,
  type CommunityGroupType,
} from './communityApi';
import CommunityGroupChat from './CommunityGroupChat';
import CommunityGroupCall from './CommunityGroupCall';
import { supabase } from '../lib/supabase';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { useI18n } from '../contexts/I18nContext';

type CreateState = 'idle' | 'saving';
type GroupListMode = 'all' | 'joined' | 'discover';
type TranslateFn = (key: string, params?: Record<string, string | number>) => string;
type GroupAccent = {
  border: string;
  dot: string;
  chip: string;
  glow: string;
  wash: string;
};

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

function initials(name: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || '').toUpperCase();
  const b = (parts[1]?.[0] || '').toUpperCase();
  return (a + b) || 'G';
}

function AvatarPile({
  count,
  label,
}: {
  count: number;
  label?: string;
}) {
  const shown = Math.min(4, Math.max(0, count || 0));
  const rest = Math.max(0, (count || 0) - shown);
  const fallback = initials(label || 'Groupe');

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {Array.from({ length: shown }).map((_, index) => (
          <div
            key={`${label || 'member'}-${index}`}
            className="grid h-8 w-8 place-items-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[11px] font-extrabold backdrop-blur-md"
            title={label || 'Membre'}
          >
            {fallback[index] || String.fromCharCode(65 + index)}
          </div>
        ))}
        {rest > 0 ? (
          <div className="grid h-8 w-8 place-items-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[11px] font-extrabold">
            +{rest}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GroupTile({
  group,
  accent,
  typeLabel,
  onOpen,
}: {
  group: CommunityGroup;
  accent: GroupAccent;
  typeLabel: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        "relative shrink-0 w-[240px] sm:w-[260px]",
        "overflow-hidden rounded-3xl border border-[color:var(--border-soft)]",
        "bg-[color:var(--surface-strong)]/95 p-4 text-left",
        "shadow-[0_14px_34px_rgba(0,0,0,0.22)]",
        "hover:border-[color:var(--border-strong)] active:scale-[0.99] transition-all",
        accent.border,
      ].join(" ")}
    >
      <div className={`pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full blur-3xl ${accent.glow}`} />
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b ${accent.wash}`} />

      <div className="relative">
        <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${accent.chip}`}>
          <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
          {typeLabel}
        </div>

        <div className="mt-3">
          <div className="truncate text-base font-extrabold text-[color:var(--foreground)]">{group.name}</div>
          {group.description ? (
            <div className="mt-1 line-clamp-2 text-sm text-[color:var(--foreground)]/75">
              {group.description}
            </div>
          ) : (
            <div className="mt-1 text-sm text-[color:var(--foreground)]/45">—</div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs font-bold text-[color:var(--foreground)]/70">
            {group.members_count || 0} membres
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-black text-[color:var(--accent)] uppercase tracking-widest">
            <span>Ouvrir</span>
            <span className="text-sm">↗</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function GroupCard({
  group,
  isSelected,
  busy,
  accent,
  typeLabel,
  when,
  onOpen,
  onJoin,
  onLeave,
  t,
}: {
  group: CommunityGroup;
  isSelected: boolean;
  busy: boolean;
  accent: GroupAccent;
  typeLabel: string;
  when: string;
  onOpen: () => void;
  onJoin: () => void;
  onLeave: () => void;
  t: TranslateFn;
}) {
  return (
    <article
      className={[
        'relative overflow-hidden rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)]/95',
        'p-4 shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition-all',
        isSelected ? 'ring-2 ring-[color:var(--accent-border)]/60' : 'hover:border-[color:var(--border-strong)]',
        accent.border,
      ].join(' ')}
    >
      <div className={`pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full blur-3xl ${accent.glow}`} />
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b ${accent.wash}`} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${accent.chip}`}>
            <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
            {typeLabel}
          </div>
          <h4 className="mt-2 truncate text-base font-extrabold sm:text-lg">{group.name}</h4>

          {group.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-[color:var(--foreground)]/75">{group.description}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] shadow-[0_10px_24px_rgba(0,0,0,0.12)] backdrop-blur-md transition hover:bg-[color:var(--surface-strong)] active:scale-[0.98]"
          title={t('community.groups.open')}
        >
          <span className="text-lg font-black">↗</span>
        </button>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AvatarPile count={group.members_count || 0} label={group.name} />
          <div className="text-xs text-[color:var(--foreground)]/70">
            <div className="font-bold">{t('community.groups.members', { count: group.members_count })}</div>
            {when ? <div className="opacity-80">{when}</div> : <div className="opacity-50">—</div>}
          </div>
        </div>

        {group.joined ? (
          <button
            type="button"
            disabled={busy}
            onClick={onLeave}
            className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2 text-xs font-extrabold transition hover:bg-[color:var(--surface-strong)] disabled:opacity-60"
          >
            {t('community.groups.leave')}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onJoin}
            className="rounded-2xl border border-[color:var(--accent-border)]/60 bg-[color:var(--accent-soft)]/35 px-3 py-2 text-xs font-extrabold transition hover:bg-[color:var(--accent-soft)]/45 disabled:opacity-60"
          >
            {t('community.groups.join')}
          </button>
        )}
      </div>

      {group.joined ? (
        <div className="relative mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-100">
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
          {t('community.groups.joined')}
        </div>
      ) : null}
    </article>
  );
}

const GROUP_TYPES: CommunityGroupType[] = ['general', 'prayer', 'study', 'support'];

function GroupDetailTabs({
  selectedGroup,
  groupMembers,
  membersStatus,
  actor,
  feedRefreshToken,
  setFeedRefreshToken,
  actionState,
  savingGroupState,
  detailDescription,
  setDetailDescription,
  detailNextCallAt,
  setDetailNextCallAt,
  setCallFullscreenOpen,
  onJoin,
  onLeave,
  onSaveGroupSettings,
  onCloseGroupPage,
  onShareGroup,
  onPromoteAdmin,
  onDeleteGroup,
  formatWhen,
  initials,
  renderTypeLabel,
  isGroupAdmin,
  currentUserStatus,
  onModerate,
  callParticipants,
  t,
}: {
  selectedGroup: CommunityGroup;
  groupMembers: CommunityGroupMember[];
  membersStatus: 'idle' | 'loading' | 'ready' | 'error';
  actor: { deviceId: string; displayName: string };
  feedRefreshToken: number;
  setFeedRefreshToken: (fn: (prev: number) => number) => void;
  actionState: Record<string, boolean>;
  savingGroupState: boolean;
  detailDescription: string;
  setDetailDescription: (v: string) => void;
  detailNextCallAt: string;
  setDetailNextCallAt: (v: string) => void;
  setCallFullscreenOpen: (open: boolean) => void;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onSaveGroupSettings: () => void;
  onCloseGroupPage: () => void;
  onShareGroup: (id: string) => void;
  onPromoteAdmin: (deviceId: string) => void;
  onDeleteGroup: (id: string) => void;
  formatWhen: (value?: string | null) => string;
  initials: (name: string) => string;
  renderTypeLabel: (value: CommunityGroupType) => string;
  isGroupAdmin: (group: CommunityGroup, deviceId: string) => boolean;
  currentUserStatus: CommunityGroupMemberStatus | null;
  onModerate: (deviceId: string, action: 'approve' | 'reject') => void;
  callParticipants: any[];
  t: TranslateFn;
}) {
  const [activeTab, setActiveTab] = useState<'feed' | 'members' | 'about'>('feed');
  const isAdmin = isGroupAdmin(selectedGroup, actor.deviceId);
  const isCreator = selectedGroup.created_by_device_id === actor.deviceId;

  return (
    <div className="space-y-4">
      {/* Bouton retour */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onCloseGroupPage}
          className="btn-base btn-secondary px-3 py-2 text-xs"
        >
          {'←'} {t('community.groups.listTitle')}
        </button>
        <button
          type="button"
          className="btn-base btn-secondary px-3 py-2 text-xs"
          onClick={() => onShareGroup(selectedGroup.id)}
        >
          <Link2 size={13} />
          {t('community.groups.share')}
        </button>
      </div>

      {/* HEADER CARD (profil du groupe) - Design Premium */}
      <div className="community-premium-panel relative overflow-hidden rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)]">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] via-[color:var(--surface)] to-[color:var(--surface-strong)]" />

        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--accent-soft)]/20 to-transparent" />

        {/* Accent glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[color:var(--accent)]/20 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative px-6 py-6">
          {/* Header avec avatar et nom */}
          <div className="flex items-start gap-4 mb-5">
            {/* Avatar avec effet glow */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-[color:var(--accent)]/30 rounded-[20px] blur-xl" />
              <div className="relative h-[72px] w-[72px] overflow-hidden rounded-[20px] bg-gradient-to-br from-[color:var(--surface)] to-[color:var(--surface-strong)] backdrop-blur-xl ring-1 ring-[color:var(--border-soft)] shadow-lg">
                <div className="h-full w-full grid place-items-center text-2xl font-bold bg-gradient-to-br from-[color:var(--accent)]/30 to-transparent">
                  {initials(selectedGroup.name)}
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold tracking-tight text-[color:var(--foreground)]">{selectedGroup.name}</h1>
                    {callParticipants.length > 0 && (
                      <div className="flex items-center gap-1.5 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(244,63,94,0.4)] animate-pulse">
                        <div className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                        LIVE
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-[color:var(--foreground)]/70">
                    {renderTypeLabel(selectedGroup.group_type)}
                  </p>
                </div>

                {/* Bouton appel émeraude - Restricted to Admins */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { triggerGroupCallPush } = await import('./communityApi');
                        void triggerGroupCallPush({
                          groupId: selectedGroup.id,
                          callerDeviceId: actor.deviceId,
                          callerDisplayName: actor.displayName,
                          callType: 'audio',
                        });
                      } catch (e) {
                        console.error('Failed to trigger call push', e);
                      }
                      setCallFullscreenOpen(true);
                    }}
                    className="relative group"
                  >
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-2xl blur group-hover:blur-md transition-all" />
                    <div className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-lg ring-1 ring-emerald-200/35 backdrop-blur-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-transform hover:scale-105">
                      📞
                    </div>
                  </button>
                )}

                {/* Bouton rejoindre pour les non-admins si appel actif */}
                {!isAdmin && callParticipants.length > 0 && currentUserStatus === 'approved' && (
                  <button
                    type="button"
                    onClick={() => setCallFullscreenOpen(true)}
                    className="relative group animate-bounce"
                  >
                    <div className="absolute inset-0 bg-rose-500/20 rounded-2xl blur group-hover:blur-md transition-all" />
                    <div className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-lg ring-1 ring-rose-200/35 backdrop-blur-xl shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-transform hover:scale-110">
                      🤙
                    </div>
                  </button>
                )}
              </div>

              {/* Chips avec glassmorphism */}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)]/85 ring-1 ring-[color:var(--border-soft)] backdrop-blur-xl">
                  {renderTypeLabel(selectedGroup.group_type)}
                </span>
                {selectedGroup.joined ? (
                  <span className="rounded-full bg-emerald-500/16 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/30 backdrop-blur-xl dark:text-emerald-200">
                    ✓ {t('community.groups.joined')}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Stats avec design moderne */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--surface)]" />
              <div className="relative p-4 text-center backdrop-blur-xl ring-1 ring-[color:var(--border-soft)]">
                <div className="text-2xl font-bold mb-1 text-[color:var(--foreground)]">{selectedGroup.members_count || 0}</div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--foreground)]/60">Membres</div>
              </div>
            </div>
            <div className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--surface)]" />
              <div className="relative p-4 text-center backdrop-blur-xl ring-1 ring-[color:var(--border-soft)]">
                <div className="text-2xl font-bold mb-1 text-[color:var(--foreground)]">{groupMembers.length}</div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--foreground)]/60">Actifs</div>
              </div>
            </div>
            <div className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--surface)]" />
              <div className="relative p-4 text-center backdrop-blur-xl ring-1 ring-[color:var(--border-soft)]">
                <div className="text-2xl font-bold mb-1 text-[color:var(--foreground)]">—</div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--foreground)]/60">Activité</div>
              </div>
            </div>
          </div>

          {/* Description avec glassmorphism */}
          <div className="relative rounded-2xl overflow-hidden mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--surface)]" />
            <div className="relative p-4 backdrop-blur-xl ring-1 ring-[color:var(--border-soft)]">
              <p className="text-sm leading-relaxed line-clamp-3 text-[color:var(--foreground)]/78">
                {selectedGroup.description || t('community.groups.descriptionPlaceholder')}
              </p>
            </div>
          </div>

          {/* Primary CTA avec effet premium */}
          {selectedGroup.joined ? (
            <button
              type="button"
              disabled={!!actionState[selectedGroup.id]}
              onClick={() => onLeave(selectedGroup.id)}
              className="relative w-full overflow-hidden rounded-2xl disabled:opacity-60"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--surface)]" />
              <div className="relative px-6 py-4 text-center font-semibold text-[color:var(--foreground)] ring-1 ring-[color:var(--border-soft)] backdrop-blur-xl transition-all hover:ring-[color:var(--border-strong)]">
                {t('community.groups.leave')}
              </div>
            </button>
          ) : (
            <button
              type="button"
              disabled={!!actionState[selectedGroup.id]}
              onClick={() => onJoin(selectedGroup.id)}
              className="relative w-full group overflow-hidden rounded-2xl disabled:opacity-60"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent)]/80" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative px-6 py-4 text-center font-bold text-white shadow-lg">
                {t('community.groups.join')}
              </div>
            </button>
          )}
        </div>
      </div>

      {/* NEXT CALL - Design Premium - Restricted to Admin */}
      {isAdmin && (
        <div className="community-premium-panel relative overflow-hidden rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)]">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] via-[color:var(--surface)] to-[color:var(--surface-strong)]" />

          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--accent-soft)]/16 to-transparent" />

          {/* Accent glow */}
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[color:var(--accent)]/15 rounded-full blur-3xl" />

          {/* Content */}
          <div className="relative px-6 py-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold tracking-tight text-[color:var(--foreground)]">Prochain appel</h2>
              <span className="rounded-full bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)]/60 ring-1 ring-[color:var(--border-soft)] backdrop-blur-xl">
                {detailNextCallAt ? formatWhen(detailNextCallAt) : 'Aucun planifié'}
              </span>
            </div>

            {/* Paramètres d'appel avec glassmorphism */}
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--surface)]" />
                <div className="relative p-1 backdrop-blur-xl ring-1 ring-[color:var(--border-soft)]">
                  <label className="block">
                    <span className="mb-2 block px-3 pt-2 text-xs font-medium uppercase tracking-wider text-[color:var(--foreground)]/60">Description</span>
                    <textarea
                      value={detailDescription}
                      onChange={(event) => setDetailDescription(event.target.value)}
                      rows={2}
                      placeholder="Description de l'appel..."
                      className="w-full resize-none bg-transparent px-3 pb-3 text-sm text-[color:var(--foreground)]/86 placeholder:text-[color:var(--foreground)]/45 outline-none"
                    />
                  </label>
                </div>
              </div>

              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--surface)]" />
                <div className="relative p-1 backdrop-blur-xl ring-1 ring-[color:var(--border-soft)]">
                  <label className="block">
                    <span className="mb-2 block px-3 pt-2 text-xs font-medium uppercase tracking-wider text-[color:var(--foreground)]/60">Date et heure</span>
                    <input
                      value={detailNextCallAt}
                      onChange={(event) => setDetailNextCallAt(event.target.value)}
                      type="datetime-local"
                      className="w-full bg-transparent px-3 pb-3 text-sm text-[color:var(--foreground)]/86 outline-none"
                    />
                  </label>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onSaveGroupSettings}
              disabled={savingGroupState}
              className="relative w-full mt-5 group overflow-hidden rounded-2xl disabled:opacity-60"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--surface)]" />
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--accent-soft)]/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative px-6 py-4 text-center font-semibold text-[color:var(--foreground)] ring-1 ring-[color:var(--border-soft)] backdrop-blur-xl">
                {savingGroupState ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Enregistrement...
                  </span>
                ) : (
                  'Planifier'
                )}
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="community-premium-panel relative overflow-hidden rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)]">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] via-[color:var(--surface)] to-[color:var(--surface-strong)]" />

        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--accent-soft)]/14 to-transparent" />

        {/* Tabs Header */}
        <div className="relative flex border-b border-[color:var(--border-soft)]">
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={[
              'flex-1 py-4 text-sm font-semibold transition-all relative',
              activeTab === 'feed'
                ? 'text-[color:var(--foreground)]'
                : 'text-[color:var(--foreground)]/62 hover:text-[color:var(--foreground)]/88',
            ].join(' ')}
          >
            {activeTab === 'feed' && (
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--accent-soft)]/35 to-transparent" />
            )}
            <span className="relative">Feed</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={[
              'flex-1 py-4 text-sm font-semibold transition-all relative',
              activeTab === 'members'
                ? 'text-[color:var(--foreground)]'
                : 'text-[color:var(--foreground)]/62 hover:text-[color:var(--foreground)]/88',
            ].join(' ')}
          >
            {activeTab === 'members' && (
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--accent-soft)]/35 to-transparent" />
            )}
            <span className="relative">Membres</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={[
              'flex-1 py-4 text-sm font-semibold transition-all relative',
              activeTab === 'about'
                ? 'text-[color:var(--foreground)]'
                : 'text-[color:var(--foreground)]/62 hover:text-[color:var(--foreground)]/88',
            ].join(' ')}
          >
            {activeTab === 'about' && (
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--accent-soft)]/35 to-transparent" />
            )}
            <span className="relative">À propos</span>
          </button>
        </div>

        {/* Tabs Content */}
        <div className="relative p-6">
          {activeTab === 'feed' ? (
            <div className="space-y-4">
              {currentUserStatus === 'pending' ? (
                <div className="relative rounded-2xl overflow-hidden p-8 border border-amber-500/20 bg-amber-500/5 text-center">
                  <div className="text-4xl mb-3">⏳</div>
                  <h3 className="mb-1 font-bold text-[color:var(--foreground)]">Validation en cours</h3>
                  <p className="text-sm text-[color:var(--foreground)]/65">
                    Un administrateur doit valider votre adhésion pour que vous puissiez voir le contenu et discuter.
                  </p>
                </div>
              ) : (
                <CommunityGroupChat
                  groupId={selectedGroup.id}
                  actor={actor}
                />
              )}
            </div>
          ) : null}

          {activeTab === 'members' ? (
            <div className="space-y-3">
              {membersStatus === 'loading' ? (
                <div className="py-8 text-center text-sm text-[color:var(--foreground)]/72">
                  {t('community.groups.loading')}
                </div>
              ) : null}
              {membersStatus === 'error' ? (
                <div className="text-sm text-rose-700 dark:text-rose-300 text-center py-8">
                  {t('community.groups.loadError')}
                </div>
              ) : null}
              {membersStatus !== 'loading' && groupMembers.length === 0 ? (
                <div className="py-8 text-center text-sm text-[color:var(--foreground)]/65">
                  {t('community.groups.empty')}
                </div>
              ) : null}
              {groupMembers.map((member) => {
                const isMe = !!actor.deviceId && member.device_id === actor.deviceId;
                const joinedAt = formatWhen(member.joined_at);
                return (
                  <div
                    key={`${member.group_id}-${member.device_id}`}
                    className="relative rounded-2xl overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--surface)]" />
                    <div className="relative flex items-center justify-between px-4 py-3 backdrop-blur-xl ring-1 ring-[color:var(--border-soft)]">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative">
                          <div className="absolute inset-0 bg-[color:var(--accent)]/20 rounded-xl blur" />
                          <div className="relative grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[color:var(--surface)] to-[color:var(--surface-strong)] ring-1 ring-[color:var(--border-soft)] text-xs font-bold text-[color:var(--foreground)] shadow-lg">
                            {initials(member.display_name)}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                            {member.display_name || t('identity.guest')}
                          </div>
                          <div className="text-xs text-[color:var(--foreground)]/58">
                            {joinedAt || member.device_id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.device_id !== selectedGroup.created_by_device_id &&
                          selectedGroup.admin_ids?.includes(member.device_id) && (
                            <span className="px-2 py-1 text-[10px] font-bold rounded-lg bg-blue-500/20 text-blue-700 ring-1 ring-blue-400/20 dark:text-blue-300">
                              ADMIN
                            </span>
                          )}
                        {member.device_id === selectedGroup.created_by_device_id && (
                          <span className="px-2 py-1 text-[10px] font-bold rounded-lg bg-amber-500/20 text-amber-700 ring-1 ring-amber-400/20 dark:text-amber-300">
                            CRÉATEUR
                          </span>
                        )}
                        {isMe ? (
                          <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-emerald-500/20 backdrop-blur-xl ring-1 ring-emerald-400/30 text-emerald-700 dark:text-emerald-200">
                            {member.status === 'pending' ? 'En attente' : 'Vous'}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            {isAdmin && member.status === 'pending' && (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => onModerate(member.device_id, 'approve')}
                                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/20 text-emerald-700 ring-1 ring-emerald-400/20 hover:bg-emerald-500/30 transition-colors dark:text-emerald-300"
                                >
                                  VALIDER
                                </button>
                                <button
                                  onClick={() => onModerate(member.device_id, 'reject')}
                                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-rose-500/20 text-rose-700 ring-1 ring-rose-400/20 hover:bg-rose-500/30 transition-colors dark:text-rose-300"
                                >
                                  REFUSER
                                </button>
                              </div>
                            )}
                            {isAdmin && member.status === 'approved' && !selectedGroup.admin_ids?.includes(member.device_id) && (
                              <button
                                onClick={() => onPromoteAdmin(member.device_id)}
                                className="rounded-lg bg-[color:var(--surface)] px-2 py-1 text-[10px] font-bold text-[color:var(--foreground)]/72 ring-1 ring-[color:var(--border-soft)] transition-colors hover:bg-[color:var(--surface-strong)]"
                              >
                                NOMMER ADMIN
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {activeTab === 'about' ? (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--surface)]" />
                <div className="relative p-5 backdrop-blur-xl ring-1 ring-[color:var(--border-soft)]">
                  <p className="text-sm leading-relaxed text-[color:var(--foreground)]/76">
                    {selectedGroup.description || t('community.groups.descriptionPlaceholder')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative rounded-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--surface)]" />
                  <div className="relative p-4 backdrop-blur-xl ring-1 ring-[color:var(--border-soft)]">
                    <div className="text-xs font-medium uppercase tracking-wider text-[color:var(--foreground)]/58">Créé par</div>
                    <div className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{selectedGroup.created_by_name || '—'}</div>
                  </div>
                </div>
                <div className="relative rounded-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--surface)]" />
                  <div className="relative p-4 backdrop-blur-xl ring-1 ring-[color:var(--border-soft)]">
                    <div className="text-xs font-medium uppercase tracking-wider text-[color:var(--foreground)]/58">Type</div>
                    <div className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{selectedGroup.group_type}</div>
                  </div>
                </div>
              </div>

              {isCreator && (
                <div className="mt-8 border-t border-[color:var(--border-soft)] pt-6">
                  <div className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-3">Zone de danger</div>
                  <p className="mb-4 text-xs text-justify text-[color:var(--foreground)]/62">
                    La suppression d'un groupe est irréversible. Tous les messages et membres seront définitivement déconnectés.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Voulez-vous vraiment supprimer ce groupe ? Cette action est irréversible.')) {
                        onDeleteGroup(selectedGroup.id);
                      }
                    }}
                    disabled={actionState[selectedGroup.id]}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-sm font-bold border border-rose-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    Supprimer définitivement le groupe
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
  const [shouldScrollToDetail, setShouldScrollToDetail] = useState(false);
  const [groupMembers, setGroupMembers] = useState<CommunityGroupMember[]>([]);
  const [membersStatus, setMembersStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [callFullscreenOpen, setCallFullscreenOpen] = useState(false);
  const [callParticipants, setCallParticipants] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const detailPanelRef = useRef<HTMLElement | null>(null);

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

  const loadGroupMembers = useCallback(
    async (groupId: string) => {
      if (!groupId) {
        setGroupMembers([]);
        setMembersStatus('idle');
        return;
      }
      setMembersStatus('loading');
      try {
        const members = await fetchGroupMembers(groupId, 120);
        setGroupMembers(members);
        setMembersStatus('ready');
      } catch {
        setGroupMembers([]);
        setMembersStatus('error');
      }
    },
    []
  );

  const currentUserStatus = useMemo(() => {
    const member = groupMembers.find((m) => m.device_id === actor.deviceId);
    return member?.status || null;
  }, [groupMembers, actor.deviceId]);

  const onModerate = useCallback(
    async (memberDeviceId: string, action: 'approve' | 'reject') => {
      if (!selectedGroup) return;
      try {
        await moderateGroupMember(selectedGroup.id, memberDeviceId, action);
        await loadGroupMembers(selectedGroup.id);
        const list = await fetchGroups(60, actor.deviceId || undefined);
        setGroups(list);
        setFeedback(action === 'approve' ? 'Membre approuvé' : 'Membre refusé');
      } catch (e) {
        console.error('Moderation failed', e);
        setFeedback('Échec de la modération');
      }
    },
    [selectedGroup, loadGroupMembers, actor.deviceId]
  );

  const isGroupAdmin = useCallback((group: CommunityGroup, deviceId: string) => {
    return group.created_by_device_id === deviceId || !!(group.admin_ids && group.admin_ids.includes(deviceId));
  }, []);

  useEffect(() => {
    if (!selectedGroupId || !supabase) {
      setCallParticipants([]);
      return;
    }

    const checkCall = async () => {
      const active = await fetchGroupCallPresence(selectedGroupId);
      setCallParticipants(active);
    };

    checkCall();
    const interval = setInterval(checkCall, 30000); // Polling toutes les 30s
    return () => clearInterval(interval);
  }, [selectedGroupId, supabase]);

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
      setShouldScrollToDetail(true);
      setFeedback(t('community.groups.opened'));
      updateGroupQuery(groupId);
    },
    [t, updateGroupQuery]
  );

  const onCloseGroupPage = useCallback(() => {
    setSelectedGroupId('');
    setShouldScrollToDetail(false);
    updateGroupQuery(null);
  }, [updateGroupQuery]);

  const loadGroups = useCallback(async () => {
    setStatus('loading');
    try {
      const list = await fetchGroups(60, actor.deviceId || undefined);
      setGroups(list);
      if (list.length) {
        const queryGroup = searchParams.get('group') || initialGroupId || '';
        const hasQueryGroup = !!queryGroup && list.some((item) => item.id === queryGroup);
        const hasCurrent = !!selectedGroupId && list.some((item) => item.id === selectedGroupId);

        if (hasQueryGroup && queryGroup !== selectedGroupId) {
          setSelectedGroupId(queryGroup);
        } else if (!hasQueryGroup && !hasCurrent && selectedGroupId) {
          setSelectedGroupId('');
        }
      } else if (selectedGroupId) {
        setSelectedGroupId('');
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
    let timer: number | null = null;

    const scheduleGroupsRefresh = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void loadGroups();
        if (selectedGroupId) {
          void loadGroupMembers(selectedGroupId);
        }
      }, 450);
    };

    if (!supabase) {
      const poll = window.setInterval(() => {
        void loadGroups();
        if (selectedGroupId) {
          void loadGroupMembers(selectedGroupId);
        }
      }, 30000);
      return () => {
        if (timer) window.clearTimeout(timer);
        window.clearInterval(poll);
      };
    }

    const realtimeClient = supabase;
    const channel = realtimeClient
      .channel('community_groups_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_groups' }, () => {
        scheduleGroupsRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_group_members' }, () => {
        scheduleGroupsRefresh();
      })
      .subscribe();

    return () => {
      if (timer) window.clearTimeout(timer);
      realtimeClient.removeChannel(channel);
    };
  }, [loadGroups, loadGroupMembers, selectedGroupId]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!selectedGroupId) {
      setCallFullscreenOpen(false);
      setGroupMembers([]);
      setMembersStatus('idle');
      return;
    }
    void loadGroupMembers(selectedGroupId);
  }, [loadGroupMembers, selectedGroupId]);

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

  useEffect(() => {
    if (!shouldScrollToDetail || !selectedGroupId) return;
    const timer = window.setTimeout(() => {
      const isMobileLayout = window.matchMedia('(max-width: 1279px)').matches;
      if (isMobileLayout) {
        detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setShouldScrollToDetail(false);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [selectedGroupId, shouldScrollToDetail]);

  useEffect(() => {
    if (!callFullscreenOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [callFullscreenOpen]);

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
      await loadGroups();
      setShowCreateForm(false);
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
      if (groupId === selectedGroupId) {
        await loadGroupMembers(groupId);
      }
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
      if (groupId === selectedGroupId) {
        await loadGroupMembers(groupId);
      }
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

  const onPromoteAdmin = async (memberDeviceId: string) => {
    if (!selectedGroup || !actor.deviceId || !isGroupAdmin(selectedGroup, actor.deviceId)) return;
    setActionState((prev) => ({ ...prev, [`promote-${memberDeviceId}`]: true }));
    try {
      const newAdminIds = [...(selectedGroup.admin_ids || []), memberDeviceId];
      await updateGroup(selectedGroup.id, { admin_ids: newAdminIds });
      setFeedback(t('community.groups.adminPromoted'));
      await loadGroups(); // Refresh groups to get updated admin_ids
      await loadGroupMembers(selectedGroup.id); // Refresh members list
    } catch {
      setFeedback(t('community.groups.actionError'));
    } finally {
      setActionState((prev) => ({ ...prev, [`promote-${memberDeviceId}`]: false }));
    }
  };

  const onDeleteGroup = async (groupId: string) => {
    if (!actor.deviceId) return;
    setActionState((prev) => ({ ...prev, [groupId]: true }));
    try {
      const { deleteGroup } = await import('./communityApi');
      await deleteGroup(groupId, actor.deviceId);
      setFeedback(t('community.groups.deleted') || 'Groupe supprime.');
      setSelectedGroupId('');
      updateGroupQuery('');
      await loadGroups();
    } catch (error: any) {
      setFeedback(error?.message || t('community.groups.actionError'));
    } finally {
      setActionState((prev) => ({ ...prev, [groupId]: false }));
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

  const [searchTerm, setSearchTerm] = useState('');
  const [listMode, setListMode] = useState<GroupListMode>('all');

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groups;
    const lower = searchTerm.toLowerCase();
    return groups.filter(g => g.name.toLowerCase().includes(lower) || (g.description && g.description.toLowerCase().includes(lower)));
  }, [groups, searchTerm]);

  const joinedGroups = useMemo(() => filteredGroups.filter((g) => !!g.joined), [filteredGroups]);
  const otherGroups = useMemo(() => filteredGroups.filter((g) => !g.joined), [filteredGroups]);
  const filteredJoinedCount = useMemo(
    () => filteredGroups.reduce((count, group) => (group.joined ? count + 1 : count), 0),
    [filteredGroups]
  );
  const filteredOtherCount = useMemo(
    () => filteredGroups.reduce((count, group) => (group.joined ? count : count + 1), 0),
    [filteredGroups]
  );

  const joinedGroupsCount = useMemo(
    () => groups.reduce((count, group) => (group.joined ? count + 1 : count), 0),
    [groups]
  );
  const mobileSwitcherGroups = useMemo(
    () => [...groups].sort((a, b) => Number(!!b.joined) - Number(!!a.joined)).slice(0, 14),
    [groups]
  );


  const typeAccent = (value: CommunityGroupType) => {
    if (value === 'prayer') {
      return {
        border: 'border-l-4 border-l-emerald-400/70',
        dot: 'bg-emerald-300',
        chip: 'border-emerald-300/30 bg-emerald-500/10',
        glow: 'bg-emerald-500/35',
        wash: 'from-emerald-500/18 to-transparent',
      };
    }
    if (value === 'study') {
      return {
        border: 'border-l-4 border-l-sky-400/70',
        dot: 'bg-sky-300',
        chip: 'border-sky-300/30 bg-sky-500/10',
        glow: 'bg-sky-500/35',
        wash: 'from-sky-500/18 to-transparent',
      };
    }
    if (value === 'support') {
      return {
        border: 'border-l-4 border-l-amber-400/70',
        dot: 'bg-amber-300',
        chip: 'border-amber-300/30 bg-amber-500/10',
        glow: 'bg-amber-500/35',
        wash: 'from-amber-500/18 to-transparent',
      };
    }
    return {
      border: 'border-l-4 border-l-violet-400/70',
      dot: 'bg-violet-300',
      chip: 'border-violet-300/30 bg-violet-500/10',
      glow: 'bg-violet-500/35',
      wash: 'from-violet-500/18 to-transparent',
    };
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -left-16 top-12 h-44 w-44 rounded-full bg-[color:var(--accent)]/12 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-16 h-52 w-52 rounded-full bg-sky-400/12 blur-3xl" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* Left Column: List/Carousel */}
        <div
          className={[
            'space-y-6',
            selectedGroup ? 'hidden xl:block' : '',
            'xl:sticky xl:top-[88px] xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto xl:pr-1',
          ].join(' ')}
        >
          {/* Header & Search */}
          <div className="glass-panel relative overflow-hidden rounded-3xl p-5">
            <div className="pr-20 sm:pr-44">
              <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--foreground)]/60">
                {t('community.groups.title')}
              </div>
              <h3 className="mt-1 text-xl font-extrabold sm:text-2xl">
                {t('community.groups.subtitle') || "Simple, Fast Team Communication"}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateForm((prev) => !prev)}
              className={[
                'absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold transition-all',
                showCreateForm
                  ? 'border-[color:var(--accent-border)]/50 bg-[color:var(--accent-soft)]/45 text-[color:var(--foreground)]'
                  : 'border-[color:var(--accent-border)]/50 bg-[color:var(--accent)] text-white shadow-[0_8px_24px_rgba(var(--accent-rgb),0.25)]',
              ].join(' ')}
            >
              {showCreateForm ? <X size={14} /> : <PlusCircle size={14} />}
              <span className="hidden sm:inline">{showCreateForm ? 'Fermer' : 'Nouveau groupe'}</span>
            </button>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)]/50 px-3 py-2.5 transition-colors focus-within:border-[color:var(--accent-border)] hover:bg-[color:var(--surface)]">
              <Search size={16} className="text-[color:var(--foreground)]/50" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--foreground)]/40 text-[color:var(--foreground)]"
                placeholder="Rechercher un groupe..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setListMode('all')}
                className={[
                  'rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all',
                  listMode === 'all'
                    ? 'border-[color:var(--accent-border)]/60 bg-[color:var(--accent-soft)]/45 text-[color:var(--foreground)]'
                    : 'border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)]',
                ].join(' ')}
              >
                Tous ({filteredGroups.length})
              </button>
              <button
                type="button"
                onClick={() => setListMode('joined')}
                className={[
                  'rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all',
                  listMode === 'joined'
                    ? 'border-emerald-400/55 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'
                    : 'border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)]',
                ].join(' ')}
              >
                Rejoints ({filteredJoinedCount})
              </button>
              <button
                type="button"
                onClick={() => setListMode('discover')}
                className={[
                  'rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all',
                  listMode === 'discover'
                    ? 'border-sky-400/55 bg-sky-500/15 text-sky-700 dark:text-sky-200'
                    : 'border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)]',
                ].join(' ')}
              >
                À découvrir ({filteredOtherCount})
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-2.5 py-1 text-xs font-semibold">
                  {groups.length} total
                </span>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                  {joinedGroupsCount} rejoints
                </span>
              </div>
            </div>

            <div className="mt-2 hidden sm:flex rounded-2xl border border-[color:var(--accent-border)]/60 bg-[color:var(--accent-soft)]/40 px-3 py-1.5 text-xs font-semibold shadow-[0_4px_12px_rgba(37,99,235,0.1)] w-fit">
              {actor.displayName}
            </div>
          </div>

          {/* Create Form (inline in left col) */}
          {showCreateForm ? (
            <section className="glass-panel rounded-3xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 text-sm font-semibold mb-3">
                <div className="flex items-center gap-2">
                  <PlusCircle size={16} />
                  {t('community.groups.createTitle')}
                </div>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-1 rounded-full hover:bg-[color:var(--surface-strong)] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-[color:var(--foreground)]/65">{t('community.groups.name')}</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('community.groups.namePlaceholder')}
                    className="w-full rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[color:var(--accent-border)]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-[color:var(--foreground)]/65">{t('community.groups.type')}</span>
                  <select
                    value={groupType}
                    onChange={(event) => setGroupType(event.target.value as CommunityGroupType)}
                    className="w-full rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[color:var(--accent-border)]"
                  >
                    {GROUP_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {renderTypeLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-[color:var(--foreground)]/65">{t('community.groups.description')}</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={t('community.groups.descriptionPlaceholder')}
                    rows={2}
                    className="w-full resize-none rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[color:var(--accent-border)]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-[color:var(--foreground)]/65">{t('community.groups.nextCall')}</span>
                  <input
                    value={nextCallAt}
                    onChange={(event) => setNextCallAt(event.target.value)}
                    type="datetime-local"
                    className="w-full rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[color:var(--accent-border)]"
                  />
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={onCreate}
                  disabled={createState === 'saving'}
                  className="btn-base btn-primary w-full justify-center px-4 py-2 text-sm"
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
          ) : null}

          {/* Groups Sections */}
          {status === 'loading' && groups.length === 0 ? (
            <div className="space-y-4">
              {[0, 1].map((i) => (
                <div key={i} className="glass-panel rounded-[24px] border border-[color:var(--border-soft)] p-5 animate-pulse h-32" />
              ))}
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="glass-panel rounded-3xl p-4 text-sm text-rose-700 dark:text-rose-300">
              {t('community.groups.loadError')}
            </div>
          ) : null}

          {status === 'ready' && groups.length === 0 ? (
            <div className="glass-panel rounded-3xl p-6 text-center text-[color:var(--foreground)]/70">
              <div className="text-4xl mb-3">📭</div>
              {t('community.groups.empty')}
            </div>
          ) : null}

          {status === 'ready' && groups.length > 0 && (
            <>
              {/* Your Groups Carousel */}
              {listMode !== 'discover' && (joinedGroups.length > 0 || listMode === 'joined') && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-sm font-extrabold text-[color:var(--foreground)]/85">Vos groupes</h4>
                    <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--foreground)]/60">
                      {joinedGroups.length}
                    </span>
                  </div>
                  {joinedGroups.length > 0 ? (
                    <div className="flex gap-3 overflow-x-auto pb-4 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide snap-x snap-mandatory">
                      {joinedGroups.map(group => {
                        const accent = typeAccent(group.group_type);
                        return (
                          <div key={group.id} className="snap-start">
                            <GroupTile
                              group={group}
                              accent={accent}
                              typeLabel={renderTypeLabel(group.group_type)}
                              onOpen={() => onSelectGroup(group.id)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3 text-xs text-[color:var(--foreground)]/60">
                      Vous n&apos;avez pas encore rejoint de groupe.
                    </div>
                  )}
                </section>
              )}

              {/* Other Groups List */}
              {listMode !== 'joined' && (
                <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-sm font-extrabold text-[color:var(--foreground)]/85">
                    {joinedGroups.length > 0 ? 'Autres groupes' : 'Tous les groupes'}
                  </h4>
                  <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-2.5 py-0.5 text-[10px] font-bold text-[color:var(--foreground)]/60">
                    {otherGroups.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {otherGroups.map((group) => {
                    const busy = !!actionState[group.id];
                    const when = formatWhen(group.next_call_at);
                    const accent = typeAccent(group.group_type);

                    return (
                      <GroupCard
                        key={group.id}
                        group={group}
                        isSelected={selectedGroupId === group.id}
                        busy={busy}
                        accent={accent}
                        typeLabel={renderTypeLabel(group.group_type)}
                        when={when}
                        onOpen={() => onSelectGroup(group.id)}
                        onJoin={() => onJoin(group.id)}
                        onLeave={() => onLeave(group.id)}
                        t={t}
                      />
                    );
                  })}
                  {otherGroups.length === 0 && (
                    <div className="p-4 text-center text-xs text-[color:var(--foreground)]/50 italic">
                      {searchTerm.trim()
                        ? 'Aucun groupe ne correspond à votre recherche.'
                        : listMode === 'discover'
                          ? 'Vous avez déjà rejoint tous les groupes disponibles.'
                        : joinedGroups.length > 0
                          ? 'Aucun autre groupe disponible.'
                          : 'Aucun groupe disponible.'}
                    </div>
                  )}
                </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Right Column: Detail View */}
        <div className="min-w-0 xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto xl:pr-1">
          {selectedGroup ? (
            <section ref={detailPanelRef} className="space-y-4">
              <div className="xl:hidden glass-panel rounded-3xl p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--foreground)]/58">
                    Changer de groupe
                  </div>
                  <button
                    type="button"
                    onClick={onCloseGroupPage}
                    className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--foreground)]/70"
                  >
                    Liste complete
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {mobileSwitcherGroups.map((group) => (
                    <button
                      key={`mobile-switch-${group.id}`}
                      type="button"
                      onClick={() => onSelectGroup(group.id)}
                      className={[
                        'shrink-0 rounded-xl border px-3 py-2 text-left transition-all',
                        selectedGroupId === group.id
                          ? 'border-[color:var(--accent-border)]/65 bg-[color:var(--accent-soft)]/45'
                          : 'border-[color:var(--border-soft)] bg-[color:var(--surface)]',
                      ].join(' ')}
                    >
                      <div className="max-w-[180px] truncate text-xs font-bold text-[color:var(--foreground)]">
                        {group.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[color:var(--foreground)]/58">
                        <span>{group.members_count || 0} membres</span>
                        {group.joined ? (
                          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-700 dark:text-emerald-200">
                            rejoint
                          </span>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <GroupDetailTabs
                selectedGroup={selectedGroup}
                groupMembers={groupMembers}
                membersStatus={membersStatus}
                actor={actor}
                feedRefreshToken={feedRefreshToken}
                setFeedRefreshToken={setFeedRefreshToken}
                actionState={actionState}
                savingGroupState={savingGroupState}
                detailDescription={detailDescription}
                setDetailDescription={setDetailDescription}
                detailNextCallAt={detailNextCallAt}
                setDetailNextCallAt={setDetailNextCallAt}
                setCallFullscreenOpen={setCallFullscreenOpen}
                onJoin={onJoin}
                onLeave={onLeave}
                onSaveGroupSettings={onSaveGroupSettings}
                onCloseGroupPage={onCloseGroupPage}
                onShareGroup={onShareGroup}
                onPromoteAdmin={onPromoteAdmin}
                onDeleteGroup={onDeleteGroup}
                formatWhen={formatWhen}
                initials={initials}
                renderTypeLabel={renderTypeLabel}
                isGroupAdmin={isGroupAdmin}
                currentUserStatus={currentUserStatus}
                onModerate={onModerate}
                callParticipants={callParticipants}
                t={t}
              />
            </section>
          ) : (
            <div className="hidden xl:flex h-[80vh] flex-col items-center justify-center rounded-[32px] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)]/50 p-6 text-center text-[color:var(--foreground)]/40">
              <div className="text-6xl mb-4 opacity-50">👋</div>
              <p className="font-semibold text-lg">Sélectionnez un groupe</p>
              <p className="text-sm mt-2 opacity-70 max-w-[200px]">
                Choisissez un groupe dans la liste à gauche pour voir les détails et discuter.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback ? (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-4 py-2 text-sm shadow-lg">
          {feedback}
        </div>
      ) : null}

      {/* Legacy Fullscreen Call (kept for compatibility) */}
      {callFullscreenOpen && selectedGroup ? (
        <div className="fixed inset-0 z-[90] bg-black/80 p-2 backdrop-blur-sm sm:p-4 md:pl-[90px]">
          <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col gap-2">
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-base rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-xs text-white"
                onClick={() => setCallFullscreenOpen(false)}
              >
                {t('community.groups.callCloseFullscreen')}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-3xl">
              <CommunityGroupCall
                groupId={selectedGroup.id}
                deviceId={actor.deviceId}
                displayName={actor.displayName}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
