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
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/40 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      {/* Ambient glow */}
      <div className="absolute -left-12 -top-12 h-32 w-32 rounded-full bg-[color:var(--accent)]/15 blur-2xl" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] animate-pulse" />
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">{t('identity.title')}</div>
        </div>
        <p className="text-xs text-slate-400 font-medium">{t('identity.subtitle')}</p>

        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <input
              className="w-full h-11 rounded-xl bg-slate-950/50 border border-white/10 px-4 text-sm text-white placeholder:text-slate-700 outline-none focus:border-[color:var(--accent-border)]/50 transition-colors shadow-inner"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('identity.placeholder')}
            />
          </div>
          <button
            onClick={onSave}
            className="h-11 px-5 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 text-sm font-bold text-white hover:bg-white/15 hover:border-white/20 transition-all active:scale-95 shadow-lg"
          >
            {t('identity.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
