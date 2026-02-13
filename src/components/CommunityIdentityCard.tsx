'use client';
import { useEffect, useState } from 'react';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { useI18n } from '../contexts/I18nContext';

export default function CommunityIdentityCard() {
  const { t } = useI18n();
  const { identity, updateName } = useCommunityIdentity();
  const [name, setName] = useState('');

  useEffect(() => {
    setName(identity?.displayName || t('identity.guest'));
  }, [identity?.displayName, t]);

  const onSave = () => {
    updateName(name.trim() || t('identity.guest'));
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl">
      {/* Ambient glow */}
      <div className="absolute -left-12 -top-12 h-32 w-32 rounded-full bg-[color:var(--accent)]/15 blur-2xl" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] animate-pulse" />
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[color:var(--foreground)]/60">{t('identity.title')}</div>
        </div>
        <p className="text-xs font-medium text-[color:var(--foreground)]/70">{t('identity.subtitle')}</p>

        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <input
              className="h-11 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-4 text-sm text-[color:var(--foreground)] outline-none shadow-inner transition-colors placeholder:text-[color:var(--foreground)]/45 focus:border-[color:var(--accent-border)]/50"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('identity.placeholder')}
            />
          </div>
          <button
            onClick={onSave}
            className="h-11 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-5 text-sm font-bold text-[color:var(--foreground)] shadow-lg transition-all hover:bg-[color:var(--surface)] hover:border-[color:var(--border-strong)] active:scale-95"
          >
            {t('identity.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
