'use client';

import { X, Moon, Sun } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useMode } from '../contexts/ModeContext';

export default function SettingsPanel() {
  const { open, closeSettings, autoplayOnOpen, setAutoplayOnOpen, audioQuality, setAudioQuality } = useSettings();
  const { mode, toggleMode } = useMode();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeSettings} />
      <div className="absolute right-0 top-0 h-full w-[360px] bg-[#0B1220] text-white border-l border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.6)] p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-extrabold">Réglages</h2>
          <button onClick={closeSettings} className="h-10 w-10 grid place-items-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Mode */}
        <div className="mb-6">
          <div className="text-white/60 text-xs font-semibold mb-2">Thème</div>
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

        {/* Autoplay */}
        <div className="mb-6">
          <div className="text-white/60 text-xs font-semibold mb-2">Lecture</div>
          <button
            onClick={() => setAutoplayOnOpen(!autoplayOnOpen)}
            className="w-full flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/10"
          >
            <div className="font-bold">Autoplay à l’ouverture</div>
            <div
              className={`h-6 w-11 rounded-full border border-white/15 p-1 transition ${
                autoplayOnOpen ? 'bg-blue-500/70' : 'bg-white/10'
              }`}
            >
              <div
                className={`h-4 w-4 rounded-full bg-white transition ${
                  autoplayOnOpen ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>
          <div className="mt-2 text-[11px] text-white/45">
            Note: l’autoplay peut être bloqué par certains navigateurs si l’utilisateur n’a pas cliqué.
          </div>
        </div>

        {/* Qualité audio */}
        <div className="mb-6">
          <div className="text-white/60 text-xs font-semibold mb-2">Qualité audio</div>
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
      </div>
    </div>
  );
}