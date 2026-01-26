
import React, { useState, useEffect, useRef } from 'react';
import { MetarData, NavigationTab, LogEntry } from './types';
import { fetchMetarData } from './services/geminiService';
import { MetarDisplay } from './components/MetarDisplay';
import { RadarView } from './components/RadarView';

const AUTO_SYNC_INTERVAL = 600; // 10 minutes in seconds

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>(NavigationTab.DASHBOARD);
  const [loading, setLoading] = useState(false);
  const [currentMetar, setCurrentMetar] = useState<MetarData | null>(null);
  const [stationQuery, setStationQuery] = useState('KLAX');
  const [isSimConnected, setIsSimConnected] = useState(false);
  const [isBridgeActive, setIsBridgeActive] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Auto-Sync States
  const [autoSync, setAutoSync] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_SYNC_INTERVAL);
  
  const wsRef = useRef<WebSocket | null>(null);
  
  const addLog = (message: string, level: LogEntry['level'] = 'INFO') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }),
      message,
      level
    };
    setLogs(prev => [...prev.slice(-15), newLog]);
  };

  // Bridge Connection Logic
  useEffect(() => {
    const connectBridge = () => {
      const ws = new WebSocket('ws://localhost:8080');
      ws.onopen = () => {
        setIsBridgeActive(true);
        addLog("SkyFlow Bridge Connected!", "SUCCESS");
      };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'STATUS') {
          setIsSimConnected(data.connected);
          if (data.connected && !isSimConnected) addLog("Flight Sim Linked!", "SUCCESS");
        }
      };
      ws.onclose = () => {
        setIsBridgeActive(false);
        setIsSimConnected(false);
        setTimeout(connectBridge, 3000);
      };
      wsRef.current = ws;
    };
    connectBridge();
    return () => wsRef.current?.close();
  }, [isSimConnected]);

  // Auto-Sync Timer Logic
  useEffect(() => {
    let timer: number;
    if (autoSync && isBridgeActive && isSimConnected) {
      timer = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleInject(true); // Trigger automated inject
            return AUTO_SYNC_INTERVAL;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(AUTO_SYNC_INTERVAL);
    }
    return () => clearInterval(timer);
  }, [autoSync, isBridgeActive, isSimConnected]);

  const handleInject = async (isAuto = false) => {
    if (!stationQuery || stationQuery.length < 3) return;
    if (!isAuto) setLoading(true);
    
    const prefix = isAuto ? "[AUTO] " : "";
    addLog(`${prefix}Updating weather for ${stationQuery}...`);
    
    try {
      const data = await fetchMetarData(stationQuery);
      setCurrentMetar(data);
      if (isBridgeActive && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'INJECT_WEATHER',
          icao: data.icao,
          raw: data.raw,
          isAuto: isAuto
        }));
        addLog(`${prefix}Success: ${data.icao} sync'd!`, 'SUCCESS');
      }
    } catch (error) {
      addLog(`${prefix}Error: Couldn't reach weather station.`, 'ERROR');
      if (isAuto) setAutoSync(false); // Stop auto-sync on failure
    } finally {
      if (!isAuto) setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Status Bar */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shadow-xl z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center font-black italic shadow-lg shadow-sky-500/20">S</div>
          <span className="font-black tracking-tighter text-xl italic">SKYFLOW <span className="text-sky-500 not-italic uppercase tracking-tight">Engine</span></span>
        </div>
        
        <div className="flex gap-4">
          <div className={`flex items-center gap-3 px-4 py-1.5 rounded-full border transition-all ${isBridgeActive ? 'bg-sky-500/10 border-sky-500/50' : 'bg-red-500/10 border-red-500/50'}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${isBridgeActive ? 'bg-sky-400 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-[11px] font-black uppercase tracking-widest">{isBridgeActive ? 'Bridge: OK' : 'Bridge: Off'}</span>
          </div>
          <div className={`flex items-center gap-3 px-4 py-1.5 rounded-full border transition-all ${isSimConnected ? 'bg-green-500/10 border-green-500/50' : 'bg-slate-800 border-slate-700'}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${isSimConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
            <span className="text-[11px] font-black uppercase tracking-widest">{isSimConnected ? 'Sim: Active' : 'Sim: Waiting...'}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <nav className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-6 space-y-3 shadow-2xl">
          <button onClick={() => setActiveTab(NavigationTab.DASHBOARD)} className={`w-full text-left p-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === NavigationTab.DASHBOARD ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/40' : 'hover:bg-slate-800 text-slate-400'}`}>
            🚀 Control Panel
          </button>
          <button onClick={() => setActiveTab(NavigationTab.SETUP)} className={`w-full text-left p-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === NavigationTab.SETUP ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/40' : 'hover:bg-slate-800 text-slate-400'}`}>
            📖 Setup Guide
          </button>
          <button onClick={() => setActiveTab(NavigationTab.SETTINGS)} className={`w-full text-left p-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === NavigationTab.SETTINGS ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/40' : 'hover:bg-slate-800 text-slate-400'}`}>
            🆘 Help / Issues
          </button>

          <div className="mt-auto pt-6 border-t border-slate-800">
             <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-[10px] space-y-1 max-h-48 overflow-y-auto">
               <p className="text-slate-500 mb-2 font-bold uppercase tracking-tighter">Activity Log</p>
               {logs.map(l => (
                 <div key={l.id} className={`${l.level === 'SUCCESS' ? 'text-green-400' : l.level === 'ERROR' ? 'text-red-400' : 'text-sky-400'}`}>
                   [{l.timestamp}] {l.message}
                 </div>
               ))}
             </div>
          </div>
        </nav>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-12 bg-slate-950">
          {activeTab === NavigationTab.DASHBOARD && (
            <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
              
              {!isBridgeActive && (
                <div className="bg-red-500/20 border-2 border-red-500/50 p-8 rounded-[32px] flex items-center gap-8 shadow-2xl">
                  <div className="text-5xl">🛑</div>
                  <div>
                    <h3 className="font-black text-2xl text-white uppercase tracking-tight">Bridge is Closed</h3>
                    <p className="text-red-200 opacity-80 italic">Double-click the shortcut on your desktop to fix this.</p>
                  </div>
                </div>
              )}

              {/* Control Card with Auto-Sync Toggle */}
              <div className="bg-slate-900 p-10 rounded-[40px] border border-slate-800 shadow-2xl flex flex-col gap-8">
                <div className="flex flex-col md:flex-row items-center gap-10">
                  <div className="flex-1">
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Weather Sync</h1>
                    <p className="text-slate-500 text-base mt-2">Enter an ICAO and send it to your plane.</p>
                  </div>
                  <div className="flex gap-4 w-full md:w-auto">
                    <input 
                      type="text" 
                      maxLength={4}
                      value={stationQuery} 
                      onChange={e => setStationQuery(e.target.value.toUpperCase())}
                      className="bg-slate-950 border-2 border-slate-800 rounded-3xl px-8 py-5 font-black text-2xl w-full md:w-44 outline-none focus:border-sky-500 transition-all text-center placeholder:text-slate-800"
                      placeholder="ICAO"
                    />
                    <button 
                      onClick={() => handleInject(false)}
                      disabled={loading || !isBridgeActive}
                      className={`px-12 py-5 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl transition-all ${loading || !isBridgeActive ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-900/60 active:scale-95'}`}
                    >
                      {loading ? 'Thinking...' : 'Sync Now'}
                    </button>
                  </div>
                </div>

                {/* Auto Sync Toggle Bar */}
                <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setAutoSync(!autoSync)}
                      disabled={!isBridgeActive || !isSimConnected}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${autoSync ? 'bg-sky-500' : 'bg-slate-700'} ${(!isBridgeActive || !isSimConnected) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${autoSync ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                    <div>
                      <h4 className="font-black uppercase text-xs tracking-widest text-white">Automated Updates (10m)</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Keeps weather fresh while you fly</p>
                    </div>
                  </div>
                  
                  {autoSync && (
                    <div className="flex items-center gap-3 bg-slate-950 px-6 py-3 rounded-2xl border border-slate-800">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Next Auto-Update in:</span>
                      <span className="font-mono text-xl text-sky-400 font-bold">{formatTime(countdown)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Displays */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-600 pl-4">Metar Observation</h3>
                  {currentMetar ? <MetarDisplay data={currentMetar} /> : <div className="p-24 border-2 border-dashed border-slate-800 rounded-[40px] text-center text-slate-800 font-black uppercase tracking-widest italic">Waiting...</div>}
                </div>
                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-600 pl-4">Live Radar View</h3>
                  {currentMetar ? <RadarView metar={currentMetar} /> : <div className="p-24 border-2 border-dashed border-slate-800 rounded-[40px] text-center text-slate-800 font-black uppercase tracking-widest italic">Offline</div>}
                </div>
              </div>
            </div>
          )}

          {activeTab === NavigationTab.SETUP && (
            <div className="max-w-3xl mx-auto space-y-16 py-12">
               <div className="text-center space-y-4">
                  <h1 className="text-6xl font-black uppercase tracking-tighter text-white">How to fly</h1>
                  <p className="text-slate-400 text-xl">The "Auto-Sync" mode is the easiest way to fly.</p>
               </div>

               <div className="space-y-6">
                  <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex gap-8">
                    <div className="w-16 h-16 bg-sky-600 rounded-2xl flex items-center justify-center font-black text-2xl">1</div>
                    <div>
                      <h3 className="font-black uppercase text-xl text-white">Start the Bridge</h3>
                      <p className="text-slate-400">Open the <strong>SkyFlow</strong> icon on your desktop. This opens the connection to your sim.</p>
                    </div>
                  </div>
                  <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex gap-8">
                    <div className="w-16 h-16 bg-sky-600 rounded-2xl flex items-center justify-center font-black text-2xl">2</div>
                    <div>
                      <h3 className="font-black uppercase text-xl text-white">Set Your Airport</h3>
                      <p className="text-slate-400">Type in where you are (like <code>KPWM</code>) and click <strong>Sync Now</strong> once.</p>
                    </div>
                  </div>
                  <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex gap-8 border-sky-500/50">
                    <div className="w-16 h-16 bg-sky-600 rounded-2xl flex items-center justify-center font-black text-2xl animate-pulse">3</div>
                    <div>
                      <h3 className="font-black uppercase text-xl text-white italic">Turn on "Automated Updates"</h3>
                      <p className="text-slate-400">Flip the switch! Now you can minimize this window and just fly. SkyFlow will update the weather every 10 minutes for you automatically.</p>
                    </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === NavigationTab.SETTINGS && (
            <div className="max-w-2xl mx-auto space-y-8 py-12">
               <h2 className="text-4xl font-black text-white uppercase tracking-tighter text-center">Troubleshooter</h2>
               <div className="space-y-4">
                  <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800">
                    <h4 className="font-bold text-sky-400 mb-2 uppercase tracking-widest text-xs">Sim is not connecting?</h4>
                    <p className="text-sm text-slate-400">Make sure you are actually in the plane! SkyFlow won't link up if you are still at the main menu selecting your aircraft.</p>
                  </div>
                  <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800">
                    <h4 className="font-bold text-sky-400 mb-2 uppercase tracking-widest text-xs">"Automated Updates" won't turn on?</h4>
                    <p className="text-sm text-slate-400">This switch only works once both the <strong>Bridge</strong> and the <strong>Sim</strong> are green at the top. Check your connections!</p>
                  </div>
               </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
