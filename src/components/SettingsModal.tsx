'use client';

import { X, Moon, Sun } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useMode } from '../contexts/ModeContext';
import { useI18n } from '../contexts/I18nContext';

export default function SettingsModal() {
  const {
    open,
    closeSettings,
    autoplayOnOpen,
    setAutoplayOnOpen,
    autoTranscribe,
    setAutoTranscribe,
    autoSummarize,
    setAutoSummarize,
    autoPlayNext,
    setAutoPlayNext,
    audioQuality,
    setAudioQuality,
    textScale,
    setTextScale,
    dataSaver,
    setDataSaver,
    accent,
    setAccent,
    notificationsEnabled,
    setNotificationsEnabled,
    remindersEnabled,
    setRemindersEnabled,
    reminderTime,
    setReminderTime,
    syncId,
    setSyncId,
    regenerateSyncId,
  } = useSettings();

  const { mode, toggleMode } = useMode();
  const { locale, setLocale, t } = useI18n();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60" onClick={closeSettings} />

      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-3xl glass-panel card-anim text-[color:var(--foreground)] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="font-extrabold text-lg">{t('settings.title')}</div>
          <button
            onClick={closeSettings}
            className="btn-icon"
            aria-label={t('settings.close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[70vh] md:max-h-[80vh] overflow-y-auto">
          {/* Thème */}
          <div>
            <div className="text-xs font-semibold mb-3 opacity-70">Thème</div>
            <button
              onClick={toggleMode}
              className="w-full btn-base btn-secondary justify-between"
            >
              <div className="flex items-center gap-2">
                {mode === 'night' ? <Moon size={18} /> : <Sun size={18} />}
                <span className="font-bold">{mode === 'night' ? 'Nuit' : 'Jour'}</span>
              </div>
              <span className="text-xs opacity-60">Changer</span>
            </button>
          </div>

          <div className="border-t border-white/10" />

          {/* Langue */}
          <div>
            <div className="text-xs font-semibold mb-3 opacity-70">{t('settings.language')}</div>
            <div className="text-xs opacity-70 mb-3">{t('settings.languageHelp')}</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLocale('fr')}
                className={`btn-base text-xs px-3 py-2 ${locale === 'fr' ? 'btn-primary' : 'btn-secondary'}`}
              >
                {t('lang.fr')}
              </button>
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`btn-base text-xs px-3 py-2 ${locale === 'en' ? 'btn-primary' : 'btn-secondary'}`}
              >
                {t('lang.en')}
              </button>
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* Lecture */}
          <div>
            <div className="text-xs font-semibold mb-3 opacity-70">Lecture</div>
            <Toggle
              label="Auto-play à l'ouverture"
              value={autoplayOnOpen}
              onChange={setAutoplayOnOpen}
            />

            <div className="my-3" />

            <Toggle
              label="Lecture enchaînée"
              value={autoPlayNext}
              onChange={setAutoPlayNext}
            />
          </div>

          <div className="border-t border-white/10" />

          {/* Qualité audio */}
          <div>
            <div className="text-xs font-semibold mb-3 opacity-70">Qualité audio</div>
            <div className="grid grid-cols-3 gap-2">
              {(['auto', 'low', 'high'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setAudioQuality(q)}
                  className={`btn-base text-xs px-3 py-2 ${
                    audioQuality === q
                      ? 'btn-primary'
                      : 'btn-secondary'
                  }`}
                >
                  {q === 'auto' ? 'Auto' : q === 'low' ? 'Faible' : 'Haute'}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* Personnalisation */}
          <div>
            <div className="text-xs font-semibold mb-3 opacity-70">Personnalisation</div>

            <div className="mb-4">
              <div className="text-[11px] font-semibold opacity-60 mb-2">Taille du texte</div>
              <div className="grid grid-cols-3 gap-2">
                {([1, 1.1, 1.2] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setTextScale(v)}
                    className={`btn-base text-xs px-3 py-2 ${
                      textScale === v
                        ? 'btn-primary'
                        : 'btn-secondary'
                    }`}
                  >
                    {v === 1 ? 'Normal' : v === 1.1 ? 'Grand' : 'Très grand'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <Toggle
                label="Mode éco data"
                value={dataSaver}
                onChange={setDataSaver}
              />
            </div>

            <div>
              <div className="text-[11px] font-semibold opacity-60 mb-2">Couleur d’accent</div>
              <div className="grid grid-cols-3 gap-2">
                {(['blue', 'emerald', 'amber'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setAccent(c)}
                    className={`btn-base text-xs px-3 py-2 ${
                      accent === c ? 'btn-primary' : 'btn-secondary'
                    }`}
                  >
                    {c === 'blue' ? 'Bleu' : c === 'emerald' ? 'Émeraude' : 'Ambre'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* Notifications */}
          <div>
            <div className="text-xs font-semibold mb-3 opacity-70">Notifications & rappels</div>

            <Toggle
              label="Nouveaux contenus"
              value={notificationsEnabled}
              onChange={async (v) => {
                const { syncPushSubscription } = await import('./notifications');
                if (v) {
                  const { ensureNotificationPermission } = await import('./notifications');
                  const perm = await ensureNotificationPermission();
                  if (perm !== 'granted') {
                    setNotificationsEnabled(false);
                    return;
                  }
                  const result = await syncPushSubscription(true);
                  if (!result.ok) {
                    console.error('[Notifications] subscribe failed:', result.error);
                    setNotificationsEnabled(false);
                    return;
                  }
                } else {
                  const result = await syncPushSubscription(false);
                  if (!result.ok) {
                    console.error('[Notifications] unsubscribe failed:', result.error);
                  }
                }
                setNotificationsEnabled(v);
              }}
            />

            <div className="my-3" />

            <Toggle
              label="Rappel quotidien"
              value={remindersEnabled}
              onChange={async (v) => {
                if (v) {
                  const { ensureNotificationPermission } = await import('./notifications');
                  const perm = await ensureNotificationPermission();
                  if (perm !== 'granted') {
                    setRemindersEnabled(false);
                    return;
                  }
                }
                setRemindersEnabled(v);
              }}
            />

            <div className="mt-3 flex items-center gap-3">
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="select-field text-sm"
              />
              <button
                type="button"
                className="btn-base btn-secondary text-xs px-3 py-2"
                onClick={async () => {
                  const { sendNotification } = await import('./notifications');
                  await sendNotification({
                    title: 'ICC WebRadio',
                    body: 'Test de notification OK ✅',
                    url: '/radio',
                  });
                }}
              >
                Tester
              </button>
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* Sync multi‑appareils */}
          <div>
            <div className="text-xs font-semibold mb-3 opacity-70">Synchronisation</div>
            <div className="text-xs text-white/60 mb-2">
              Utilise ce code sur un autre appareil pour continuer la lecture.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={syncId}
                onChange={(e) => setSyncId(e.target.value.toUpperCase())}
                placeholder="CODE (6 lettres/chiffres)"
                className="input-field text-sm uppercase tracking-widest"
              />
              <button
                type="button"
                className="btn-base btn-secondary text-xs px-3 py-2"
                onClick={regenerateSyncId}
              >
                Générer
              </button>
              <button
                type="button"
                className="btn-base btn-secondary text-xs px-3 py-2"
                onClick={async () => {
                  if (!syncId) return;
                  await navigator.clipboard?.writeText(syncId);
                }}
              >
                Copier
              </button>
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* IA */}
          <div>
            <div className="text-xs font-bold tracking-wide mb-3 opacity-80">IA</div>

            <Toggle
              label="Auto-transcrire au chargement"
              value={autoTranscribe}
              onChange={setAutoTranscribe}
            />

            <div className="my-3" />

            <Toggle
              label="Auto-résumer après transcription"
              value={autoSummarize}
              onChange={setAutoSummarize}
            />

            <div className="mt-4 text-xs leading-relaxed opacity-70">
              Astuce : sur un VPS 4GB / 2CPU, on garde l'IA en API (AssemblyAI) pour la stabilité.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/8"
    >
      <div className="text-sm font-semibold">{label}</div>
      <div
        className={`h-6 w-11 rounded-full border transition relative ${
          value ? 'border-white/20' : 'bg-white/10 border-white/15'
        }`}
        style={value ? { background: 'var(--accent)' } : undefined}
      >
        <div
          className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white transition ${
            value ? 'left-[22px]' : 'left-[2px]'
          }`}
        />
      </div>
    </button>
  );
}
