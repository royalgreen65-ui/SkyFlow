
import React, { useState, useEffect, useRef } from 'react';
import { MetarData, NavigationTab, LogEntry } from './types';
import { fetchMetarData } from './services/geminiService';
import { MetarDisplay } from './components/MetarDisplay';
import { RadarView } from './components/RadarView';
import { XGaugeConfig } from './components/XGaugeConfig';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('SKYFLOW_KEY') || '');
  const [showKeyInput, setShowKeyInput] = useState(!apiKey);
  const [activeTab, setActiveTab] = useState<NavigationTab>(NavigationTab.DASHBOARD);
  const [loading, setLoading] = useState(false);
  const [currentMetar, setCurrentMetar] = useState<MetarData | null>(null);
  const [stationQuery, setStationQuery] = useState('KLAX');
  const [isSimConnected, setIsSimConnected] = useState(false);
  const [isBridgeActive, setIsBridgeActive] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  
  const addLog = (message: string, level: LogEntry['level'] = 'INFO') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }),
      message,
      level
    };
    setLogs(prev => [...prev.slice(-10), newLog]);
  };

  useEffect(() => {
    if (apiKey) {
      (window as any).SKYFLOW_API_KEY = apiKey;
    }
  }, [apiKey]);

  useEffect(() => {
    const connectBridge = () => {
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') return;

      try {
        const ws = new WebSocket('ws://localhost:8080');
        ws.onopen = () => {
          setIsBridgeActive(true);
          addLog("Engine Link established", "SUCCESS");
        };
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'STATUS') setIsSimConnected(data.connected);
        };
        ws.onclose = () => {
          setIsBridgeActive(false);
          setIsSimConnected(false);
          setTimeout(connectBridge, 3000);
        };
        wsRef.current = ws;
      } catch (err) {
        console.warn("WebSocket bridge not available.");
      }
    };
    
    connectBridge();
    return () => wsRef.current?.close();
  }, []);

  const handleKeySave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKey.trim();
    if (cleanKey.length > 10) {
      localStorage.setItem('SKYFLOW_KEY', cleanKey);
      setApiKey(cleanKey);
      setShowKeyInput(false);
      addLog("API Key Configured", "SUCCESS");
    }
  };

  const handleInject = async () => {
    if (!stationQuery || stationQuery.length < 3) return;
    setLoading(true);
    try {
      const data = await fetchMetarData(stationQuery);
      setCurrentMetar(data);
      if (isBridgeActive && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'INJECT_WEATHER', icao: data.icao, raw: data.raw }));
        addLog(`Injected ${data.icao}`, 'SUCCESS');
      } else {
        addLog(`Fetched ${data.icao}`, 'INFO');
      }
    } catch (error) {
      addLog(`Fetch Error: Check API Key`, 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  if (showKeyInput) {
    return (
      <div className="h-screen bg-[#05070a] flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-[#0a0f17] border border-slate-800 p-12 rounded-[48px] shadow-2xl space-y-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-sky-600"></div>
          
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-sky-600 rounded-3xl flex items-center justify-center text-4xl font-black italic mx-auto shadow-2xl shadow-sky-900/40">S</div>
            <div className="pt-2">
              <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Initial Setup</h1>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Avionics System Config</p>
            </div>
          </div>
          
          <form onSubmit={handleKeySave} className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-1">Gemini AI API Key</label>
              <input 
                type="password"
                required
                placeholder="Paste key here..."
                className="w-full bg-black border border-slate-800 rounded-2xl p-5 text-sm font-mono text-sky-400 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                className="text-[9px] text-sky-500 font-bold uppercase tracking-widest hover:text-sky-400 inline-block pl-1"
              >
                Get a free key here →
              </a>
            </div>
            
            <button className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs transition-all shadow-xl shadow-sky-900/20 active:scale-95">
              Initialize Engine
            </button>
          </form>
          
          <p className="text-[9px] text-center text-slate-700 font-bold uppercase tracking-widest">SkyFlow v2.6 Core</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#05070a] text-slate-100 font-sans overflow-hidden">
      <header className="h-20 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-10">
        <div className="flex items-center gap-6">
          <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center text-xl font-black italic">S</div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter leading-none">SkyFlow</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Avionics v2.6</p>
          </div>
        </div>

        <div className="flex gap-4">
           <div className={`px-4 py-2 rounded-xl border flex items-center gap-3 transition-all ${isBridgeActive ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${isBridgeActive ? 'bg-sky-400 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">{isBridgeActive ? 'LINK: ON' : 'LINK: OFF'}</span>
           </div>
           <div className={`px-4 py-2 rounded-xl border flex items-center gap-3 transition-all ${isSimConnected ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
              <div className={`w-2 h-2 rounded-full ${isSimConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">{isSimConnected ? 'SIM: CONNECTED' : 'SIM: OFFLINE'}</span>
           </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-64 bg-[#0a0f17] border-r border-slate-800 p-6 flex flex-col gap-2">
          {Object.values(NavigationTab).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
            >
              {tab}
            </button>
          ))}
          <button 
            onClick={() => { localStorage.removeItem('SKYFLOW_KEY'); window.location.reload(); }}
            className="mt-auto text-[9px] font-bold text-slate-600 uppercase tracking-widest hover:text-red-400 text-left px-4 mb-4"
          >
            Reset Engine Key
          </button>
        </nav>

        <main className="flex-1 bg-gradient-to-br from-[#05070a] to-[#0a0f17] overflow-y-auto p-10">
          {activeTab === NavigationTab.DASHBOARD && (
            <div className="max-w-5xl mx-auto space-y-10">
              <div className="bg-[#0f172a] p-10 rounded-[48px] border border-slate-800/50 shadow-2xl flex items-center justify-between gap-10">
                <div className="flex-1">
                  <h2 className="text-4xl font-black uppercase tracking-tighter text-white">SkySync Cockpit</h2>
                  <p className="text-slate-500 text-sm mt-2">Enter an ICAO station to inject real-time weather observation.</p>
                </div>
                <div className="flex gap-4">
                  <input 
                    type="text" 
                    maxLength={4}
                    value={stationQuery}
                    onChange={e => setStationQuery(e.target.value.toUpperCase())}
                    className="w-32 bg-black border-2 border-slate-800 rounded-3xl p-5 text-3xl font-black text-center text-white outline-none focus:border-sky-500 transition-all"
                    placeholder="KLAX"
                  />
                  <button 
                    onClick={handleInject}
                    disabled={loading}
                    className={`px-10 rounded-3xl font-black uppercase tracking-widest text-[11px] transition-all ${loading ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-xl shadow-sky-900/30'}`}
                  >
                    {loading ? 'SYNCING...' : 'SYNC TO SIM'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                 <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 pl-2">Station Telemetry</h3>
                    {currentMetar ? <MetarDisplay data={currentMetar} /> : <div className="h-64 border-2 border-dashed border-slate-900 rounded-[30px] flex items-center justify-center text-slate-800 font-bold uppercase tracking-widest text-xs">Waiting for Data</div>}
                 </div>
                 <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 pl-2">X-Gauge Radar View</h3>
                    {currentMetar ? <RadarView metar={currentMetar} /> : <div className="h-64 border-2 border-dashed border-slate-900 rounded-[30px] flex items-center justify-center text-slate-800 font-bold uppercase tracking-widest text-xs">Radar Standby</div>}
                 </div>
              </div>
              
              <div className="bg-black/40 p-8 rounded-[32px] border border-slate-800 font-mono text-[10px]">
                <p className="text-slate-600 font-black mb-4 uppercase border-b border-slate-800 pb-2">Telemetry Console</p>
                {logs.length === 0 && <div className="text-slate-800 italic py-1">System ready. No activity yet.</div>}
                {logs.map(l => (
                  <div key={l.id} className="py-1">
                    <span className="text-slate-700">[{l.timestamp}]</span> <span className={l.level === 'SUCCESS' ? 'text-green-500' : l.level === 'ERROR' ? 'text-red-500' : 'text-sky-500'}>{l.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === NavigationTab.XGAUGE && (
            <div className="max-w-5xl mx-auto">
               <XGaugeConfig />
            </div>
          )}
          
          {activeTab !== NavigationTab.DASHBOARD && activeTab !== NavigationTab.XGAUGE && (
            <div className="flex items-center justify-center h-96 border-2 border-dashed border-slate-800/50 rounded-[48px]">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-700">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <p className="text-slate-600 uppercase font-black tracking-[0.4em] text-xs">{tabName(activeTab)} LOCKED</p>
                <p className="text-slate-700 text-[10px] font-bold">This module requires an active SimConnect session.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// Simple helper to fix capitalization in UI
const tabName = (tab: NavigationTab) => tab.toString().toUpperCase();

export default App;
