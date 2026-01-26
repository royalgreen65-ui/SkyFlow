
import React, { useState, useEffect, useRef } from 'react';
import { MetarData, NavigationTab, LogEntry } from './types';
import { fetchMetarData } from './services/geminiService';
import { MetarDisplay } from './components/MetarDisplay';
import { RadarView } from './components/RadarView';

const AUTO_SYNC_INTERVAL = 600;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>(NavigationTab.DASHBOARD);
  const [loading, setLoading] = useState(false);
  const [currentMetar, setCurrentMetar] = useState<MetarData | null>(null);
  const [stationQuery, setStationQuery] = useState('KLAX');
  const [isSimConnected, setIsSimConnected] = useState(false);
  const [isBridgeActive, setIsBridgeActive] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoSync, setAutoSync] = useState(false);
  
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
        addLog("Engine Link Established", "SUCCESS");
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
        setTimeout(connectBridge, 3000);
      };
      wsRef.current = ws;
    };
    connectBridge();
    return () => wsRef.current?.close();
  }, []);

  const handleInject = async (isAuto = false) => {
    if (!stationQuery || stationQuery.length < 3) return;
    if (!isAuto) setLoading(true);
    
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
        addLog(`Injected ${data.icao}`, 'SUCCESS');
      }
    } catch (error) {
      addLog(`Failed to fetch ${stationQuery}`, 'ERROR');
    } finally {
      if (!isAuto) setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 shadow-2xl z-30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center font-black italic shadow-lg shadow-sky-600/20">S</div>
          <span className="font-black text-2xl tracking-tighter italic uppercase">SkyFlow <span className="text-sky-500 not-italic tracking-normal text-sm">v2.2</span></span>
        </div>

        <div className="flex gap-4">
           <div className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isBridgeActive ? 'bg-sky-500/10 border-sky-500/50 text-sky-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${isBridgeActive ? 'bg-sky-400 animate-pulse' : 'bg-red-500'}`} />
              {isBridgeActive ? 'Engine: Linked' : 'Engine: Offline'}
           </div>
           <div className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isSimConnected ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
              <div className={`w-2 h-2 rounded-full ${isSimConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
              {isSimConnected ? 'Sim: Active' : 'Sim: Waiting...'}
           </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation */}
        <nav className="w-72 bg-slate-900 border-r border-slate-800 p-8 flex flex-col gap-3">
          {[NavigationTab.DASHBOARD, NavigationTab.SETUP, NavigationTab.SETTINGS].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left p-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-sky-600 text-white shadow-xl shadow-sky-900/40 translate-x-1' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
            >
              {tab === NavigationTab.DASHBOARD ? '🚀 Control Panel' : tab === NavigationTab.SETUP ? '📖 Setup Guide' : '🔧 Troubleshooting'}
            </button>
          ))}
          
          <div className="mt-auto border-t border-slate-800 pt-6">
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-[10px] max-h-40 overflow-y-auto space-y-1">
              <p className="text-slate-600 font-bold mb-2 uppercase">Log Feed</p>
              {logs.map(log => (
                <div key={log.id} className={log.level === 'SUCCESS' ? 'text-green-400' : log.level === 'ERROR' ? 'text-red-400' : 'text-sky-400'}>
                  [{log.timestamp}] {log.message}
                </div>
              ))}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 bg-slate-950 overflow-y-auto p-12">
          {activeTab === NavigationTab.DASHBOARD && (
            <div className="max-w-5xl mx-auto space-y-12">
              
              {!isBridgeActive && (
                <div className="bg-red-500/10 border-2 border-red-500/50 p-10 rounded-[40px] flex flex-col gap-6 animate-pulse">
                  <div className="flex items-center gap-6">
                    <div className="text-6xl">🛠️</div>
                    <div>
                      <h2 className="text-3xl font-black uppercase text-white tracking-tight">System Initialization Required</h2>
                      <p className="text-red-200 opacity-70">The background weather engine is not running.</p>
                    </div>
                  </div>
                  <div className="bg-red-950/40 p-6 rounded-2xl border border-red-500/20 text-sm leading-relaxed text-red-100">
                    <p className="font-bold mb-4">TO START THE ENGINE:</p>
                    <ol className="list-decimal pl-6 space-y-3">
                      <li>Open the folder where you unzipped SkyFlow.</li>
                      <li>Double-click <code className="bg-red-500 text-white px-2 rounded font-bold">LAUNCH_SKYFLOW.bat</code>.</li>
                      <li>A black window will open. **Leave it open** while you play.</li>
                      <li>If Windows asks "What program to use?", restart your computer and try again.</li>
                    </ol>
                  </div>
                </div>
              )}

              <div className="bg-slate-900 p-12 rounded-[50px] border border-slate-800 shadow-2xl space-y-10">
                <div className="flex flex-col lg:flex-row items-center gap-12">
                  <div className="flex-1">
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-white">Weather Injector</h1>
                    <p className="text-slate-500 text-lg mt-2">Update your simulator skies in real-time.</p>
                  </div>
                  <div className="flex gap-4 w-full lg:w-auto">
                    <input 
                      type="text" 
                      maxLength={4}
                      value={stationQuery}
                      onChange={e => setStationQuery(e.target.value.toUpperCase())}
                      className="flex-1 lg:w-48 bg-slate-950 border-2 border-slate-800 rounded-3xl p-6 text-3xl font-black text-center outline-none focus:border-sky-500 transition-all text-white placeholder:text-slate-800"
                      placeholder="ICAO"
                    />
                    <button 
                      onClick={() => handleInject()}
                      disabled={loading || !isBridgeActive}
                      className={`px-12 py-6 rounded-3xl font-black uppercase tracking-widest transition-all ${loading || !isBridgeActive ? 'bg-slate-800 text-slate-600 grayscale cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-2xl shadow-sky-900/50 active:scale-95'}`}
                    >
                      {loading ? 'Processing...' : 'Inject METAR'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                 <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 pl-4">Digital Metar Readout</h3>
                    {currentMetar ? <MetarDisplay data={currentMetar} /> : <div className="h-64 border-2 border-dashed border-slate-800 rounded-[40px] flex items-center justify-center text-slate-800 font-black italic uppercase tracking-widest">Waiting for data...</div>}
                 </div>
                 <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 pl-4">X-Gauge Weather Radar</h3>
                    {currentMetar ? <RadarView metar={currentMetar} /> : <div className="h-64 border-2 border-dashed border-slate-800 rounded-[40px] flex items-center justify-center text-slate-800 font-black italic uppercase tracking-widest">Radar Offline</div>}
                 </div>
              </div>
            </div>
          )}

          {activeTab === NavigationTab.SETUP && (
            <div className="max-w-3xl mx-auto py-12 space-y-12">
              <div className="text-center">
                 <h1 className="text-6xl font-black uppercase tracking-tighter">Getting Started</h1>
                 <p className="text-slate-400 mt-4 text-xl">Avoid common mistakes for a smooth flight.</p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex gap-8">
                   <div className="w-16 h-16 bg-sky-600 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0">1</div>
                   <div className="space-y-2">
                      <h4 className="text-xl font-black uppercase">Install Node.js</h4>
                      <p className="text-slate-400 leading-relaxed text-sm">Download the **LTS** version from nodejs.org. This is required to run the server logic.</p>
                   </div>
                </div>
                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex gap-8">
                   <div className="w-16 h-16 bg-sky-600 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0">2</div>
                   <div className="space-y-2">
                      <h4 className="text-xl font-black uppercase">Run the Batch File</h4>
                      <p className="text-slate-400 leading-relaxed text-sm">Always use <code className="text-sky-400">LAUNCH_SKYFLOW.bat</code>. Do not try to open the .js files manually.</p>
                   </div>
                </div>
                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex gap-8">
                   <div className="w-16 h-16 bg-sky-600 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0">3</div>
                   <div className="space-y-2">
                      <h4 className="text-xl font-black uppercase">Check the Cockpit</h4>
                      <p className="text-slate-400 leading-relaxed text-sm">Make sure you have loaded into the game world. The connection will only turn green once you are sitting in the aircraft.</p>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === NavigationTab.SETTINGS && (
            <div className="max-w-2xl mx-auto py-12 space-y-8">
               <h2 className="text-4xl font-black uppercase text-center italic">Troubleshooting Wizard</h2>
               <div className="space-y-4">
                  <div className="bg-amber-500/10 border border-amber-500/30 p-8 rounded-3xl">
                     <h5 className="text-amber-400 font-black uppercase text-xs mb-2">"Open With..." Dialog appears?</h5>
                     <p className="text-sm text-slate-300 leading-relaxed">This means your Batch file is failing to find Node.js. Try moving the folder to <code className="bg-slate-800 px-1 rounded">C:\SkyFlow</code> and run the launcher again as Administrator.</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl">
                     <h5 className="text-sky-400 font-black uppercase text-xs mb-2">SimConnect Drivers?</h5>
                     <p className="text-sm text-slate-400 leading-relaxed">If the engine is green but the Sim is waiting, ensure you have the SimConnect SDK installed. This usually comes with FSX/P3D but might need a manual install on some Windows versions.</p>
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
