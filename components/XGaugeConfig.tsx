
import React, { useState } from 'react';
import { FSX_AIRCRAFT } from '../constants';

export const XGaugeConfig: React.FC = () => {
  const [installed, setInstalled] = useState<string[]>([]);

  const toggleInstall = (ac: string) => {
    setInstalled(prev => 
      prev.includes(ac) ? prev.filter(i => i !== ac) : [...prev, ac]
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-sky-900/20 border border-sky-500/30 p-4 rounded-lg flex items-start gap-4">
        <div className="p-2 bg-sky-500 rounded text-white mt-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-sky-400">XGauge Installation Manager</h3>
          <p className="text-slate-400 text-sm">
            Select which aircraft will receive the custom Weather Radar panel. This modification alters the aircraft.cfg and panel.cfg files of your FSX installation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FSX_AIRCRAFT.map(ac => {
          const isInstalled = installed.includes(ac);
          return (
            <div 
              key={ac}
              onClick={() => toggleInstall(ac)}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                isInstalled 
                ? 'bg-sky-500/10 border-sky-500' 
                : 'bg-slate-800/40 border-slate-700 hover:border-slate-500'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-200">{ac}</span>
                {isInstalled ? (
                  <span className="text-xs bg-sky-500 text-white px-2 py-0.5 rounded">Installed</span>
                ) : (
                  <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">Native</span>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <div className={`h-1 flex-1 rounded ${isInstalled ? 'bg-sky-500' : 'bg-slate-700'}`} />
                <div className={`h-1 flex-1 rounded ${isInstalled ? 'bg-sky-500' : 'bg-slate-700'}`} />
                <div className={`h-1 flex-1 rounded ${isInstalled ? 'bg-sky-500' : 'bg-slate-700'}`} />
              </div>
            </div>
          );
        })}
      </div>

      {installed.length > 0 && (
        <button 
          className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-sky-900/20 transition-all flex items-center justify-center gap-2"
          onClick={() => alert("Syncing changes to FSX directory...")}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          APPLY PANEL MODIFICATIONS
        </button>
      )}
    </div>
  );
};
