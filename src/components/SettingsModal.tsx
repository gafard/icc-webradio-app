'use client';

import { X, Moon, Sun } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useMode } from '../contexts/ModeContext';

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
    audioQuality,
    setAudioQuality,
  } = useSettings();

  const { mode, toggleMode } = useMode();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60" onClick={closeSettings} />

      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[#0B1022] text-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="font-extrabold text-lg">Réglages</div>
          <button
            onClick={closeSettings}
            className="h-10 w-10 rounded-full bg-white/5 border border-white/10 grid place-items-center hover:bg-white/10"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[70vh] md:max-h-[80vh] overflow-y-auto">
          {/* Thème */}
          <div>
            <div className="text-white/60 text-xs font-semibold mb-3">Thème</div>
            <button
              onClick={toggleMode}
              className="w-full flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/10"
            >
              <div className="flex items-center gap-2">
                {mode === 'night' ? <Moon size={18} /> : <Sun size={18} />}
                <span className="font-bold">{mode === 'night' ? 'Nuit' : 'Jour'}</span>
              </div>
              <span className="text-white/50 text-xs">Changer</span>
            </button>
          </div>

          <div className="border-t border-white/10" />

          {/* Lecture */}
          <div>
            <div className="text-white/60 text-xs font-semibold mb-3">Lecture</div>
            <Toggle
              label="Auto-play à l'ouverture"
              value={autoplayOnOpen}
              onChange={setAutoplayOnOpen}
            />
          </div>

          <div className="border-t border-white/10" />

          {/* Qualité audio */}
          <div>
            <div className="text-white/60 text-xs font-semibold mb-3">Qualité audio</div>
            <div className="grid grid-cols-3 gap-2">
              {(['auto', 'low', 'high'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setAudioQuality(q)}
                  className={`rounded-xl px-3 py-2 text-sm font-extrabold border transition ${
                    audioQuality === q
                      ? 'bg-blue-500/80 border-transparent'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {q === 'auto' ? 'Auto' : q === 'low' ? 'Faible' : 'Haute'}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* IA */}
          <div>
            <div className="text-white/70 text-xs font-bold tracking-wide mb-3">IA</div>

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

            <div className="mt-4 text-white/50 text-xs leading-relaxed">
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
          value ? 'bg-blue-600/90 border-blue-300/20' : 'bg-white/10 border-white/15'
        }`}
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