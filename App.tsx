
import React, { useState, useEffect, useRef } from 'react';
import { MetarData, Scenario, FlightPlan, NavigationTab, LogEntry, FlightPhase } from './types';
import { SCENARIOS, FSX_AIRCRAFT } from './constants';
import { fetchMetarData, generateBriefing } from './services/geminiService';
import { MetarDisplay } from './components/MetarDisplay';
import { RadarView } from './components/RadarView';
import { XGaugeConfig } from './components/XGaugeConfig';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>(NavigationTab.DASHBOARD);
  const [loading, setLoading] = useState(false);
  const [currentMetar, setCurrentMetar] = useState<MetarData | null>(null);
  const [stationQuery, setStationQuery] = useState('KPWM');
  const [simPosition, setSimPosition] = useState('KPWM');
  const [isSimConnected, setIsSimConnected] = useState(false);
  const [isBridgeActive, setIsBridgeActive] = useState(false);
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  const [flightPlan, setFlightPlan] = useState<FlightPlan>({
    departure: 'KPWM',
    arrival: 'KJFK',
    alternate: 'KBOS',
    aircraft: FSX_AIRCRAFT[0],
    cruiseAltitude: 34000,
    fuelWeight: 12500
  });

  const [briefing, setBriefing] = useState<string>('');

  const addLog = (message: string, level: LogEntry['level'] = 'INFO') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message,
      level
    };
    setLogs(prev => [...prev.slice(-49), newLog]);
  };

  useEffect(() => {
    const connectBridge = () => {
      const ws = new WebSocket('ws://localhost:8080');
      
      ws.onopen = () => {
        setIsBridgeActive(true);
        addLog("Bridge CLI: Connected.", "SUCCESS");
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'STATUS') {
          setIsSimConnected(data.connected);
          if (data.connected) addLog("Simulator Link: ACTIVE", "SUCCESS");
        }
      };

      ws.onclose = () => {
        setIsBridgeActive(false);
        setIsSimConnected(false);
        setTimeout(connectBridge, 5000);
      };

      wsRef.current = ws;
    };

    connectBridge();
    return () => wsRef.current?.close();
  }, []);

  const handleSearchStation = async (icao: string) => {
    setLoading(true);
    addLog(`Syncing Station: ${icao}`);
    try {
      const data = await fetchMetarData(icao);
      setCurrentMetar(data);
      if (isBridgeActive && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'INJECT_WEATHER',
          icao: data.icao,
          raw: data.raw
        }));
        addLog(`Pushed METAR to FSX.`, 'SUCCESS');
      }
    } catch (error) {
      addLog(`Sync failed.`, 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  const toggleConnection = () => {
    if (!isBridgeActive) {
      setActiveTab(NavigationTab.SETUP);
      return;
    }
    wsRef.current?.send(JSON.stringify({ type: 'CONNECT_SIM' }));
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden select-none font-sans">
      <div className="h-8 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-sky-500 rounded-sm flex items-center justify-center font-bold text-[10px] italic">S</div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SkyFlow Weather Engine v4.2.0</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-3 text-[9px] font-mono">
             <span className={isBridgeActive ? "text-sky-400" : "text-red-500"}>BRIDGE: {isBridgeActive ? "OK" : "MISSING"}</span>
             <span className="text-slate-700">|</span>
             <span className={isSimConnected ? "text-green-500" : "text-slate-500"}>FSX: {isSimConnected ? "LINKED" : "OFFLINE"}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shadow-xl">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-lg font-black text-white tracking-tighter italic">SKYFLOW <span className="text-sky-500 not-italic">ENGINE</span></h1>
          </div>
          <div className="flex-1 py-2 overflow-y-auto">
            {Object.values(NavigationTab).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full text-left px-6 py-3 flex items-center gap-3 transition-all ${activeTab === tab ? 'bg-sky-600/10 text-sky-400 border-r-2 border-sky-500' : 'text-slate-500 hover:text-slate-300'}`}>
                <span className="text-xs font-bold uppercase tracking-widest">{tab}</span>
              </button>
            ))}
          </div>
          <div className="h-44 bg-black/40 border-t border-slate-800 flex flex-col font-mono text-[9px]">
            <div className="bg-slate-900 px-3 py-1 border-b border-slate-800 text-slate-500 uppercase font-bold">Log Console</div>
            <div ref={logContainerRef} className="flex-1 p-2 overflow-y-auto space-y-1">
              {logs.map(log => (
                <div key={log.id} className="flex gap-2">
                  <span className="text-slate-600">[{log.timestamp}]</span>
                  <span className={log.level === 'SUCCESS' ? 'text-green-500' : log.level === 'ERROR' ? 'text-red-500' : 'text-sky-400'}>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 bg-slate-900 border-t border-slate-800">
            <button onClick={toggleConnection} className={`w-full py-2.5 rounded text-[10px] font-black uppercase tracking-widest border transition-all ${isSimConnected ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-green-500/10 border-green-500/50 text-green-500'}`}>
              {isSimConnected ? 'Disconnect' : 'Connect Sim'}
            </button>
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto bg-slate-950 p-10 relative">
          {loading && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {activeTab === NavigationTab.DASHBOARD && (
            <div className="max-w-5xl mx-auto space-y-8">
               {!isBridgeActive && (
                 <div className="bg-sky-600/10 border border-sky-600/30 p-8 rounded-2xl flex items-center gap-8 shadow-2xl">
                    <div className="w-20 h-20 bg-sky-600 rounded-2xl flex items-center justify-center text-4xl shadow-lg shadow-sky-900/40">✈️</div>
                    <div>
                       <h2 className="text-2xl font-black text-white uppercase tracking-tight">Bridge Required</h2>
                       <p className="text-slate-400 mt-2 max-w-xl leading-relaxed">FSX cannot talk to the browser directly. You need to run the <strong>SkyFlow Bridge Executable</strong> on your Windows PC to enable weather injection.</p>
                       <button onClick={() => setActiveTab(NavigationTab.SETUP)} className="mt-4 px-6 py-2 bg-sky-600 text-white font-black text-[10px] uppercase rounded-full shadow-lg shadow-sky-900/40 hover:bg-sky-500 transition-all">Go to Setup Guide</button>
                    </div>
                 </div>
               )}

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-2 space-y-8">
                    <div className="bg-slate-900 p-8 border border-slate-800 rounded-2xl shadow-xl flex justify-between items-center">
                      <div className="space-y-1">
                        <h2 className="text-lg font-black text-white uppercase tracking-tighter">METAR Injection Hub</h2>
                        <p className="text-slate-500 text-[10px] font-mono uppercase">Station: {currentMetar?.icao || 'READY'}</p>
                      </div>
                      <div className="flex gap-4">
                         <input type="text" value={stationQuery} onChange={e => setStationQuery(e.target.value.toUpperCase())} className="bg-slate-950 border border-slate-800 rounded-xl px-6 py-3 font-mono text-sm w-40 outline-none focus:border-sky-500 transition-all" />
                         <button onClick={() => handleSearchStation(stationQuery)} className="bg-sky-600 hover:bg-sky-500 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl">Inject</button>
                      </div>
                    </div>
                    {currentMetar && <MetarDisplay data={currentMetar} />}
                 </div>
                 <div className="space-y-6">
                   <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Live Weather Echo</h4>
                   {currentMetar && <RadarView metar={currentMetar} />}
                 </div>
               </div>
            </div>
          )}

          {activeTab === NavigationTab.SETUP && (
            <div className="max-w-4xl mx-auto space-y-12">
               <div className="text-center space-y-4">
                  <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Windows Setup Guide</h2>
                  <p className="text-slate-500 text-lg">Follow these steps to generate your <code>skyflow-bridge.exe</code></p>
               </div>

               <div className="grid grid-cols-1 gap-8">
                  <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl relative overflow-hidden group">
                     <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500"></div>
                     <span className="text-sky-500 font-black text-6xl opacity-10 absolute top-4 right-8">01</span>
                     <h3 className="text-xl font-bold text-white mb-4">Install Node.js</h3>
                     <p className="text-slate-400 text-sm leading-relaxed mb-6">The bridge uses Node.js to communicate with SimConnect. If you don't have it, download the <strong>LTS Version</strong> from the official site.</p>
                     <a href="https://nodejs.org/" target="_blank" className="inline-block px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all">Download Node.js ↗</a>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500"></div>
                     <span className="text-sky-500 font-black text-6xl opacity-10 absolute top-4 right-8">02</span>
                     <h3 className="text-xl font-bold text-white mb-4">Create the Executable</h3>
                     <p className="text-slate-400 text-sm leading-relaxed mb-6">Open your project folder on your computer and run the provided batch file. It will automatically compile everything into a single Windows EXE.</p>
                     <div className="bg-black/50 p-4 rounded-xl font-mono text-xs text-green-400 border border-slate-800 mb-4">
                        1. Save the <strong>bridge.js</strong>, <strong>package.json</strong>, and <strong>create-exe.bat</strong> files.<br/>
                        2. Double-click <strong>create-exe.bat</strong>.<br/>
                        3. Wait for the terminal to close.
                     </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500"></div>
                     <span className="text-sky-500 font-black text-6xl opacity-10 absolute top-4 right-8">03</span>
                     <h3 className="text-xl font-bold text-white mb-4">Run & Connect</h3>
                     <p className="text-slate-400 text-sm leading-relaxed">Once you have <strong>skyflow-bridge.exe</strong>, follow this order:</p>
                     <ul className="mt-4 space-y-3 text-sm text-slate-400">
                        <li className="flex gap-3">
                           <span className="w-5 h-5 bg-sky-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">1</span>
                           <span>Start <strong>Microsoft FSX / P3D</strong> and load your aircraft onto the runway.</span>
                        </li>
                        <li className="flex gap-3">
                           <span className="w-5 h-5 bg-sky-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">2</span>
                           <span>Run <strong>skyflow-bridge.exe</strong> as Administrator.</span>
                        </li>
                        <li className="flex gap-3">
                           <span className="w-5 h-5 bg-sky-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">3</span>
                           <span>Return to this Dashboard and click <strong>"Connect Sim"</strong>.</span>
                        </li>
                     </ul>
                  </div>
               </div>
            </div>
          )}

          {activeTab === NavigationTab.PLANNER && <div className="text-center py-20 text-slate-600 font-mono">Flight Planner Interface Offline</div>}
          {activeTab === NavigationTab.XGAUGE && <XGaugeConfig />}
        </main>
      </div>
    </div>
  );
};

export default App;