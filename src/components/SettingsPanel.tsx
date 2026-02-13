'use client';

import { X, Moon, Sun } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useMode } from '../contexts/ModeContext';

export default function SettingsPanel() {
  const {
    open,
    closeSettings,
    autoplayOnOpen,
    setAutoplayOnOpen,
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeSettings} />
      <div className="absolute right-0 top-0 h-full w-[360px] glass-panel card-anim text-[color:var(--foreground)] border-l border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.6)] p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-extrabold">Réglages</h2>
          <button onClick={closeSettings} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Mode */}
        <div className="mb-6">
          <div className="text-xs font-semibold mb-2 opacity-70">Thème</div>
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

        {/* Autoplay */}
        <div className="mb-6">
          <div className="text-xs font-semibold mb-2 opacity-70">Lecture</div>
          <button
            onClick={() => setAutoplayOnOpen(!autoplayOnOpen)}
            className="w-full flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/10"
          >
            <div className="font-bold">Autoplay à l’ouverture</div>
            <div
              className={`h-6 w-11 rounded-full border border-white/15 p-1 transition ${
                autoplayOnOpen ? '' : 'bg-white/10'
              }`}
              style={autoplayOnOpen ? { background: 'var(--accent)' } : undefined}
            >
              <div
                className={`h-4 w-4 rounded-full bg-white transition ${
                  autoplayOnOpen ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>
          <div className="mt-2 text-[11px] opacity-70">
            Note: l’autoplay peut être bloqué par certains navigateurs si l’utilisateur n’a pas cliqué.
          </div>

          <div className="mt-3">
            <button
              onClick={() => setAutoPlayNext(!autoPlayNext)}
              className="w-full flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/10"
            >
              <div className="font-bold">Lecture enchaînée</div>
              <div
                className={`h-6 w-11 rounded-full border border-white/15 p-1 transition ${
                  autoPlayNext ? '' : 'bg-white/10'
                }`}
                style={autoPlayNext ? { background: 'var(--accent)' } : undefined}
              >
                <div
                  className={`h-4 w-4 rounded-full bg-white transition ${
                    autoPlayNext ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Qualité audio */}
        <div className="mb-6">
          <div className="text-xs font-semibold mb-2 opacity-70">Qualité audio</div>
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

        {/* Personnalisation */}
        <div className="mb-6">
          <div className="text-xs font-semibold mb-2 opacity-70">Personnalisation</div>

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
            <button
              onClick={() => setDataSaver(!dataSaver)}
              className="w-full flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/10"
            >
              <div className="font-bold">Mode éco data</div>
              <div
                className={`h-6 w-11 rounded-full border border-white/15 p-1 transition ${
                  dataSaver ? '' : 'bg-white/10'
                }`}
                style={dataSaver ? { background: 'var(--accent)' } : undefined}
              >
                <div
                  className={`h-4 w-4 rounded-full bg-white transition ${
                    dataSaver ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>
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

        {/* Notifications */}
        <div className="mb-6">
          <div className="text-xs font-semibold mb-2 opacity-70">Notifications & rappels</div>

          <button
            onClick={async () => {
              const next = !notificationsEnabled;
              const { syncPushSubscription } = await import('./notifications');
              if (next) {
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
              setNotificationsEnabled(next);
            }}
            className="w-full flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/10"
          >
            <div className="font-bold">Nouveaux contenus</div>
            <div
              className={`h-6 w-11 rounded-full border border-white/15 p-1 transition ${
                notificationsEnabled ? '' : 'bg-white/10'
              }`}
              style={notificationsEnabled ? { background: 'var(--accent)' } : undefined}
            >
              <div
                className={`h-4 w-4 rounded-full bg-white transition ${
                  notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <div className="mt-3">
            <button
              onClick={async () => {
                const next = !remindersEnabled;
                if (next) {
                  const { ensureNotificationPermission } = await import('./notifications');
                  const perm = await ensureNotificationPermission();
                  if (perm !== 'granted') {
                    setRemindersEnabled(false);
                    return;
                  }
                }
                setRemindersEnabled(next);
              }}
              className="w-full flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/10"
            >
              <div className="font-bold">Rappel quotidien</div>
              <div
                className={`h-6 w-11 rounded-full border border-white/15 p-1 transition ${
                  remindersEnabled ? '' : 'bg-white/10'
                }`}
                style={remindersEnabled ? { background: 'var(--accent)' } : undefined}
              >
                <div
                  className={`h-4 w-4 rounded-full bg-white transition ${
                    remindersEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>
          </div>

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

        {/* Sync multi‑appareils */}
        <div className="mb-6">
          <div className="text-xs font-semibold mb-2 opacity-70">Synchronisation</div>
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
      </div>
    </div>
  );
}
