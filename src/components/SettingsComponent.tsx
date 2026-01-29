'use client';

import { useMode } from '../contexts/ModeContext';
import { Sun, Moon } from 'lucide-react';

export default function SettingsComponent() {
  const { mode, toggleMode } = useMode();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-6">Paramètres</h1>
        
        <div className="space-y-6">
          {/* Thème - Jour/Nuit */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Thème</h2>
                <p className="text-white/60 text-sm mt-1">
                  Changer entre le mode jour et nuit
                </p>
              </div>
              
              <button
                onClick={toggleMode}
                className={`p-3 rounded-full transition-all duration-300 ${
                  mode === 'night' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-yellow-400 text-yellow-900'
                }`}
                aria-label={mode === 'night' ? 'Passer en mode jour' : 'Passer en mode nuit'}
              >
                {mode === 'night' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
            </div>
            
            <div className="mt-4 flex items-center gap-4">
              <span className={`text-sm font-medium ${mode === 'day' ? 'text-white' : 'text-white/50'}`}>
                Jour
              </span>
              <div className="relative flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full transition-all duration-300 ${
                    mode === 'night' ? 'w-1/2 bg-blue-500' : 'w-full bg-yellow-400'
                  }`}
                />
              </div>
              <span className={`text-sm font-medium ${mode === 'night' ? 'text-white' : 'text-white/50'}`}>
                Nuit
              </span>
            </div>
          </div>
          
          {/* Autres paramètres pourraient être ajoutés ici */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h2 className="text-lg font-semibold text-white">Langue</h2>
            <select className="mt-2 w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white">
              <option>Français</option>
              <option>English</option>
            </select>
          </div>
          
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h2 className="text-lg font-semibold text-white">Qualité audio</h2>
            <select className="mt-2 w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white">
              <option>Haute qualité</option>
              <option>Standard</option>
              <option>Basse consommation</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}