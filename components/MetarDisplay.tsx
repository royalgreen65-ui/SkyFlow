
import React from 'react';
import { MetarData } from '../types';

interface MetarDisplayProps {
  data: MetarData;
}

export const MetarDisplay: React.FC<MetarDisplayProps> = ({ data }) => {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 font-mono text-sm">
      <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-2">
        <span className="text-sky-400 font-bold text-lg">{data.icao}</span>
        <span className="text-slate-400">{data.timestamp || 'N/A'}</span>
      </div>
      <div className="text-sky-100 mb-4 bg-slate-900 p-2 rounded border border-slate-700 break-all">
        {data.raw}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 uppercase">Wind</span>
          <span className="text-slate-200">{data.windDirection}° @ {data.windSpeed}KT</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 uppercase">Visibility</span>
          <span className="text-slate-200">{data.visibility}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 uppercase">Temp / Dew</span>
          <span className="text-slate-200">{data.temperature}°C / {data.dewpoint}°C</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 uppercase">Altimeter</span>
          <span className="text-slate-200">{data.altimeter}</span>
        </div>
      </div>
      <div className="mt-4">
        <span className="text-xs text-slate-500 uppercase">Cloud Layers</span>
        <div className="flex gap-2 mt-1">
          {data.clouds.map((c, i) => (
            <span key={i} className="bg-slate-700 px-2 py-1 rounded text-xs text-sky-300">
              {c.cover} @ {c.altitude}ft
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
