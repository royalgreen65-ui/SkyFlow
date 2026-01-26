
import React, { useState, useEffect, useRef } from 'react';
import { MetarData, NavigationTab, LogEntry } from './types';
import { fetchMetarData } from './services/geminiService';
import { MetarDisplay } from './components/MetarDisplay';
import { RadarView } from './components/RadarView';

const App: React.FC = () => {
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
    setLogs(prev => [...prev.slice(-15), newLog]);
  };

  useEffect(() => {
    const connectBridge = () => {
      const ws = new WebSocket('ws://localhost:8080');
      ws.onopen = () => {
        setIsBridgeActive(true);
        addLog("Engine Link established", "SUCCESS");
      };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'STATUS') {
          setIsSimConnected(data.connected);
        }
      };
      ws.onclose = () => {
        setIsBridgeActive(false);
        setIsSimConnected(false);
        setTimeout(connectBridge, 2000);
      };
      wsRef.current = ws;
    };
    connectBridge();
    return () => wsRef.current?.close();
  }, []);

  const handleInject = async () => {
    if (!stationQuery || stationQuery.length < 3) return;
    setLoading(true);
    
    try {
      const data = await fetchMetarData(stationQuery);
      setCurrentMetar(data);
      if (isBridgeActive && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'INJECT_WEATHER',
          icao: data.icao,
          raw: data.raw
        }));
        addLog(`Successfully injected ${data.icao} into Sim`, 'SUCCESS');
      }
    } catch (error) {
      addLog(`Failed to fetch ${stationQuery}`, 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#05070a] text-slate-100 font-sans overflow-hidden">
      {/* Dynamic Status Header */}
      <header className="h-20 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-10">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center text-2xl font-black italic shadow-2xl shadow-sky-600/30">S</div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">SkyFlow</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Professional Weather Engine v2.3</p>
          </div>
        </div>

        <div className="flex gap-6">
           <div className={`px-5 py-3 rounded-2xl border flex items-center gap-3 transition-all duration-500 ${isBridgeActive ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
              <div className={`w-3 h-3 rounded-full ${isBridgeActive ? 'bg-sky-400 animate-ping' : 'bg-red-500'}`} />
              <span className="text-xs font-black uppercase tracking-widest">{isBridgeActive ? 'Engine: Linked' : 'Engine: Offline'}</span>
           </div>
           <div className={`px-5 py-3 rounded-2xl border flex items-center gap-3 transition-all duration-500 ${isSimConnected ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
              <div className={`w-3 h-3 rounded-full ${isSimConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-xs font-black uppercase tracking-widest">{isSimConnected ? 'Sim: Connected' : 'Sim: Searching...'}</span>
           </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <nav className="w-80 bg-[#0a0f17] border-r border-slate-800 p-8 flex flex-col gap-3">
          {[NavigationTab.DASHBOARD, NavigationTab.SETUP, NavigationTab.SETTINGS].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left p-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-sky-600 text-white shadow-2xl shadow-sky-900/40 translate-x-1' : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'}`}
            >
              {tab === NavigationTab.DASHBOARD ? '🎮 Cockpit Controls' : tab === NavigationTab.SETUP ? '📖 Manual & Setup' : '🔧 Troubleshooting'}
            </button>
          ))}
          
          <div className="mt-auto">
            <div className="p-5 bg-black/40 rounded-3xl border border-slate-800 font-mono text-[10px] h-56 overflow-y-auto space-y-2">
              <p className="text-slate-600 font-black mb-2 border-b border-slate-800 pb-2 uppercase tracking-tighter">Live System Logs</p>
              {logs.map(log => (
                <div key={log.id} className={`${log.level === 'SUCCESS' ? 'text-green-400' : log.level === 'ERROR' ? 'text-red-400' : 'text-sky-400'} opacity-80`}>
                  [{log.timestamp}] {log.message}
                </div>
              ))}
              {logs.length === 0 && <div className="text-slate-800 italic">No logs recorded yet...</div>}
            </div>
          </div>
        </nav>

        {/* Main Interface */}
        <main className="flex-1 bg-gradient-to-br from-[#05070a] to-[#0a0f17] overflow-y-auto p-12">
          {activeTab === NavigationTab.DASHBOARD && (
            <div className="max-w-6xl mx-auto space-y-12">
              
              {!isBridgeActive && (
                <div className="bg-red-500/5 border border-red-500/20 p-12 rounded-[50px] flex items-center gap-10 animate-in fade-in slide-in-from-top-4 duration-700">
                  <div className="text-7xl">🛠️</div>
                  <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Critical: Engine Offline</h2>
                    <p className="text-slate-400 text-lg mt-2 mb-6">You must run the background server to inject weather into your game.</p>
                    <div className="bg-black/40 p-6 rounded-3xl border border-red-500/10 text-xs font-mono text-red-200/60 leading-relaxed">
                      1. Locate your SkyFlow folder.<br/>
                      2. Double-click <span className="text-red-400 font-bold underline">LAUNCH_SKYFLOW.bat</span>.<br/>
                      3. DO NOT click the .js files (they open in Notepad/VS Code).
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-[#0f172a] p-12 rounded-[60px] border border-slate-800/50 shadow-3xl space-y-10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-sky-600/5 blur-[120px] rounded-full pointer-events-none group-hover:bg-sky-600/10 transition-all duration-1000" />
                
                <div className="flex flex-col lg:flex-row items-center gap-16 relative z-10">
                  <div className="flex-1">
                    <h2 className="text-5xl font-black uppercase tracking-tighter text-white leading-none">Weather<br/><span className="text-sky-500 italic">Injection</span></h2>
                    <p className="text-slate-500 text-xl mt-4 max-w-md">Fetch high-fidelity METAR data and force it into your flight simulator instantly.</p>
                  </div>
                  <div className="flex flex-col gap-4 w-full lg:w-auto">
                    <div className="flex gap-4">
                      <input 
                        type="text" 
                        maxLength={4}
                        value={stationQuery}
                        onChange={e => setStationQuery(e.target.value.toUpperCase())}
                        className="w-40 lg:w-56 bg-black/60 border-2 border-slate-800 rounded-3xl p-8 text-4xl font-black text-center outline-none focus:border-sky-500 transition-all text-white placeholder:text-slate-800 shadow-inner"
                        placeholder="ICAO"
                      />
                      <button 
                        onClick={() => handleInject()}
                        disabled={loading || !isBridgeActive}
                        className={`px-16 py-8 rounded-3xl font-black uppercase tracking-[0.2em] text-xs transition-all ${loading || !isBridgeActive ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-2xl shadow-sky-900/40 active:scale-95'}`}
                      >
                        {loading ? 'Processing...' : 'SYNC TO SIM'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                 <div className="space-y-6">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-700 pl-4">Digital Telemetry</h3>
                    {currentMetar ? <MetarDisplay data={currentMetar} /> : <div className="h-72 border-2 border-dashed border-slate-900 rounded-[50px] flex items-center justify-center text-slate-800 font-black italic uppercase tracking-widest">Waiting for Data...</div>}
                 </div>
                 <div className="space-y-6">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-700 pl-4">X-Gauge Weather Radar</h3>
                    {currentMetar ? <RadarView metar={currentMetar} /> : <div className="h-72 border-2 border-dashed border-slate-900 rounded-[50px] flex items-center justify-center text-slate-800 font-black italic uppercase tracking-widest">Radar Standby</div>}
                 </div>
              </div>
            </div>
          )}

          {activeTab === NavigationTab.SETUP && (
            <div className="max-w-4xl mx-auto py-12 space-y-12">
              <div className="text-center space-y-4">
                 <h1 className="text-7xl font-black uppercase tracking-tighter italic">One-Click Setup</h1>
                 <p className="text-slate-500 text-2xl">Follow these 3 steps to unlock professional weather.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-slate-900/40 p-10 rounded-[40px] border border-slate-800 space-y-6 hover:border-sky-500/50 transition-all group">
                   <div className="w-16 h-16 bg-sky-600 rounded-3xl flex items-center justify-center text-2xl font-black group-hover:scale-110 transition-transform">1</div>
                   <h4 className="text-xl font-black uppercase tracking-tight">Extract ZIP</h4>
                   <p className="text-slate-500 text-sm leading-relaxed font-medium">Do not run the program from inside the ZIP file. Extract everything to your Desktop first.</p>
                </div>
                <div className="bg-slate-900/40 p-10 rounded-[40px] border border-slate-800 space-y-6 hover:border-sky-500/50 transition-all group">
                   <div className="w-16 h-16 bg-sky-600 rounded-3xl flex items-center justify-center text-2xl font-black group-hover:scale-110 transition-transform">2</div>
                   <h4 className="text-xl font-black uppercase tracking-tight">Install Node.js</h4>
                   <p className="text-slate-500 text-sm leading-relaxed font-medium">Download the <b>LTS</b> version from nodejs.org. It is the engine that powers our weather simulation.</p>
                </div>
                <div className="bg-slate-900/40 p-10 rounded-[40px] border border-slate-800 space-y-6 hover:border-sky-500/50 transition-all group">
                   <div className="w-16 h-16 bg-sky-600 rounded-3xl flex items-center justify-center text-2xl font-black group-hover:scale-110 transition-transform">3</div>
                   <h4 className="text-xl font-black uppercase tracking-tight">Run Launcher</h4>
                   <p className="text-slate-500 text-sm leading-relaxed font-medium">Click <b>LAUNCH_SKYFLOW.bat</b>. This forces Node to run the script and bypasses Windows Notepad.</p>
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
