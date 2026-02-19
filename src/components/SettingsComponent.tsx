'use client';

import { useMode } from '../contexts/ModeContext';
import { useSettings } from '../contexts/SettingsContext';
import { Sun, Moon } from 'lucide-react';

export default function SettingsComponent() {
  const { mode, toggleMode } = useMode();
  const {
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
    audioQuality,
    setAudioQuality,
  } = useSettings();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="glass-panel card-anim rounded-2xl p-6 shadow-2xl text-[color:var(--foreground)]">
        <h1 className="text-2xl font-bold mb-6">Paramètres</h1>

        <div className="space-y-6">
          {/* Thème - Jour/Nuit */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Thème</h2>
                <p className="text-sm mt-1 opacity-70">
                  Changer entre le mode jour et nuit
                </p>
              </div>

              <button
                onClick={toggleMode}
                className={`btn-icon ${mode === 'night'
                  ? 'bg-blue-600 text-white'
                  : 'bg-yellow-400 text-yellow-900'
                  }`}
                aria-label={mode === 'night' ? 'Passer en mode jour' : 'Passer en mode nuit'}
              >
                {mode === 'night' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <span className={`text-sm font-medium ${mode === 'day' ? 'opacity-100' : 'opacity-60'}`}>
                Jour
              </span>
              <div className="relative flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className={`absolute top-0 left-0 h-full transition-all duration-300 ${mode === 'night' ? 'w-1/2 bg-blue-500' : 'w-full bg-yellow-400'
                    }`}
                />
              </div>
              <span className={`text-sm font-medium ${mode === 'night' ? 'opacity-100' : 'opacity-60'}`}>
                Nuit
              </span>
            </div>
          </div>

          {/* Autres paramètres pourraient être ajoutés ici */}
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-lg font-semibold">Personnalisation</h2>
            <div className="mt-4">
              <div className="text-xs font-semibold opacity-70 mb-2">Taille du texte</div>
              <div className="grid grid-cols-3 gap-2">
                {([1, 1.1, 1.2] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setTextScale(v)}
                    className={`btn-base text-xs px-3 py-2 ${textScale === v ? 'btn-primary' : 'btn-secondary'
                      }`}
                  >
                    {v === 1 ? 'Normal' : v === 1.1 ? 'Grand' : 'Très grand'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={() => setDataSaver(!dataSaver)}
                className="w-full flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/10"
              >
                <div className="font-bold">Mode éco data</div>
                <div
                  className={`h-6 w-11 rounded-full border border-white/15 p-1 transition ${dataSaver ? '' : 'bg-white/10'
                    }`}
                  style={dataSaver ? { background: 'var(--accent)' } : undefined}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white transition ${dataSaver ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </div>
              </button>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold opacity-70 mb-2">Couleur d’accent</div>
              <div className="grid grid-cols-3 gap-2">
                {(['blue', 'emerald', 'amber'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setAccent(c)}
                    className={`btn-base text-xs px-3 py-2 ${accent === c ? 'btn-primary' : 'btn-secondary'
                      }`}
                  >
                    {c === 'blue' ? 'Bleu' : c === 'emerald' ? 'Émeraude' : 'Ambre'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-4">
            <h2 className="text-lg font-semibold">Qualité audio</h2>
            <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
              {(['low', 'high'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setAudioQuality(q)}
                  className={`flex-1 py-2 rounded-md text-xs font-bold transition ${audioQuality === q
                    ? 'bg-[var(--accent)] text-white shadow-lg'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                >
                  {q === 'low' ? 'Standard (64kbps)' : 'Haut (128kbps)'}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-xl p-4">
            <h2 className="text-lg font-semibold">Notifications & rappels</h2>
            <div className="mt-4 space-y-3">
              <button
                onClick={async () => {
                  const next = !notificationsEnabled;
                  const { syncPushSubscription } = await import('./notifications');
                  if (next) {
                    const { ensureNotificationPermission } = await import('./notifications');
                    const perm = await ensureNotificationPermission();
                    if (perm !== 'granted') {
                      alert('Notifications bloquées. Vérifiez les paramètres de votre navigateur.');
                      setNotificationsEnabled(false);
                      return;
                    }
                    const result = await syncPushSubscription(true);
                    if (!result.ok) {
                      console.error('[Notifications] subscribe failed:', result.error);
                      alert(`Erreur d'activation : ${result.error}`);
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
                  className={`h-6 w-11 rounded-full border border-white/15 p-1 transition ${notificationsEnabled ? '' : 'bg-white/10'
                    }`}
                  style={notificationsEnabled ? { background: 'var(--accent)' } : undefined}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white transition ${notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </div>
              </button>

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
                  className={`h-6 w-11 rounded-full border border-white/15 p-1 transition ${remindersEnabled ? '' : 'bg-white/10'
                    }`}
                  style={remindersEnabled ? { background: 'var(--accent)' } : undefined}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white transition ${remindersEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </div>
              </button>

              <div className="flex items-center gap-3">
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
          </div>

          <div className="glass-card rounded-xl p-4">
            <h2 className="text-lg font-semibold">Synchronisation</h2>
            <p className="text-sm mt-1 opacity-70">
              Utilise ce code sur un autre appareil pour continuer la lecture.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
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
    </div>
  );
}
