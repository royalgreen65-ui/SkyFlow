
import React, { useState, useEffect, useRef } from 'react';
import { MetarData, NavigationTab, LogEntry } from './types';
import { fetchMetarData } from './services/geminiService';
import { MetarDisplay } from './components/MetarDisplay';
import { RadarView } from './components/RadarView';
import { XGaugeConfig } from './components/XGaugeConfig';

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
    setLogs(prev => [...prev.slice(-8), newLog]);
  };

  useEffect(() => {
    let reconnectTimer: any;
    const connectBridge = () => {
      try {
        const ws = new WebSocket('ws://localhost:8080');
        ws.onopen = () => {
          setIsBridgeActive(true);
          addLog("SimConnect Bridge Linked", "SUCCESS");
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'STATUS') {
              if (data.connected !== isSimConnected) {
                addLog(data.connected ? "Simulator Active" : "Simulator Disconnected", data.connected ? "SUCCESS" : "WARN");
              }
              setIsSimConnected(data.connected);
            }
          } catch (e) {}
        };
        ws.onclose = () => {
          setIsBridgeActive(false);
          setIsSimConnected(false);
          reconnectTimer = setTimeout(connectBridge, 3000);
        };
        ws.onerror = () => ws.close();
        wsRef.current = ws;
      } catch (err) {
        reconnectTimer = setTimeout(connectBridge, 3000);
      }
    };
    connectBridge();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [isSimConnected]);

  const handleInject = async () => {
    if (!stationQuery) return;
    setLoading(true);
    try {
      const data = await fetchMetarData(stationQuery);
      setCurrentMetar(data);
      if (isBridgeActive && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'INJECT_WEATHER', icao: data.icao, raw: data.raw }));
        addLog(`SYNC: ${data.icao} injected to Sim`, 'SUCCESS');
      } else {
        addLog(`DATA: ${data.icao} fetched (Cloud Preview)`, 'INFO');
      }
    } catch (error) {
      addLog(`API ERROR: Engine Offline`, 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#05070a] text-slate-100 font-sans overflow-hidden">
      <header className="h-20 bg-slate-900/40 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between px-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center text-xl font-black italic shadow-lg shadow-sky-900/20">S</div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tighter leading-none">SkyFlow</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Universal Cockpit Dashboard</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setActiveTab(NavigationTab.SETUP)} className="group">
            <StatusBadge active={isBridgeActive} label="Bridge" activeText="LINKED" idleText="OFFLINE" />
          </button>
          <StatusBadge active={isSimConnected} label="Sim" activeText="READY" idleText="WAITING" color="green" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-[#0a0f17] border-r border-slate-800 p-6 flex flex-col gap-2 shrink-0">
          {Object.values(NavigationTab).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full text-left px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
              {tab}
            </button>
          ))}
          
          <div className="mt-auto space-y-4">
             <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800">
               <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2">Sim Signal</p>
               <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${isSimConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 animate-pulse'}`}></div>
                 <span className="text-[10px] font-bold text-slate-400">{isSimConnected ? 'SimConnect Active' : 'Waiting for FSX...'}</span>
               </div>
             </div>
             <p className="text-[8px] text-slate-700 uppercase tracking-widest text-center">SkyFlow Engine v2.9-PRD</p>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900/10 via-transparent to-transparent">
          {activeTab === NavigationTab.DASHBOARD && (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-900/60 p-10 rounded-[48px] border border-slate-800/50 shadow-2xl flex items-center justify-between gap-10">
                <div className="flex-1">
                  <h2 className="text-4xl font-black uppercase tracking-tighter text-white italic">Weather Injection</h2>
                  <p className="text-slate-500 text-sm mt-2">Generate hyper-realistic weather via AI and sync it instantly to your cockpit.</p>
                </div>
                <div className="flex gap-4">
                  <input type="text" maxLength={4} value={stationQuery} onChange={e => setStationQuery(e.target.value.toUpperCase())} className="w-36 bg-black border-2 border-slate-800 rounded-3xl p-5 text-3xl font-black text-center text-white outline-none focus:border-sky-500 transition-all uppercase placeholder:text-slate-900" placeholder="KLAX" />
                  <button onClick={handleInject} disabled={loading} className={`px-10 rounded-3xl font-black uppercase tracking-widest text-[11px] transition-all ${loading ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-xl shadow-sky-900/30 active:scale-95'}`}>
                    {loading ? 'SYNCING...' : 'FETCH & INJECT'}
                  </button>
                </div>
              </div>

              {!isBridgeActive && (
                <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-[40px] flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div>
                      <p className="text-red-400 font-black uppercase tracking-[0.2em] text-[10px]">Critical Link Missing</p>
                      <h3 className="text-lg font-bold text-white">Bridge.exe is not detected</h3>
                      <p className="text-slate-500 text-sm">Download and start the bridge component to enable weather injection.</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab(NavigationTab.SETUP)} className="px-8 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-2xl text-red-400 font-black text-[11px] uppercase tracking-widest transition-all">Download Bridge</button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 pl-2">Telemetric Data</h3>
                  {currentMetar ? <MetarDisplay data={currentMetar} /> : <div className="h-64 border-2 border-dashed border-slate-900 rounded-[32px] flex items-center justify-center text-slate-800 font-bold uppercase tracking-widest text-[10px]">Awaiting Data...</div>}
                </div>
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 pl-2">Atmospheric Visualization</h3>
                  {currentMetar ? <RadarView metar={currentMetar} /> : <div className="h-64 border-2 border-dashed border-slate-900 rounded-[32px] flex items-center justify-center text-slate-800 font-bold uppercase tracking-widest text-[10px]">Radar Standby</div>}
                </div>
              </div>
              
              <div className="bg-black/60 p-6 rounded-[24px] border border-slate-800/50 font-mono text-[10px] text-slate-600 shadow-2xl">
                <p className="font-black mb-3 uppercase text-slate-500 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                  System Stream
                </p>
                <div className="space-y-1">
                  {logs.length === 0 ? <div className="opacity-30">Listening for engine heartbeats...</div> : logs.map(l => (
                    <div key={l.id} className="py-0.5 border-b border-slate-800/10 last:border-0">
                      <span className="opacity-40">[{l.timestamp}]</span> <span className={l.level === 'SUCCESS' ? 'text-green-500' : l.level === 'ERROR' ? 'text-red-500' : 'text-sky-400'}>{l.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === NavigationTab.SETUP && (
            <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
              <div className="text-center space-y-4">
                <h2 className="text-5xl font-black uppercase tracking-tighter text-white italic">FSX Readiness Center</h2>
                <p className="text-slate-500 max-w-xl mx-auto uppercase tracking-widest text-[10px] font-bold">Follow these steps to link your browser to your Simulator folder</p>
              </div>

              <div className="grid gap-8">
                <SetupStep 
                  number="1" 
                  title="Acquire Bridge Terminal" 
                  desc="To talk to FSX, you need the bridge.exe file from your SkyFlow installation folder."
                  completed={isBridgeActive}
                  action={<button className="bg-sky-600 hover:bg-sky-500 text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg transition-all">Download skyflow-bridge.exe</button>}
                />
                
                <SetupStep 
                  number="2" 
                  title="Move to Simulator Directory" 
                  desc="Drag 'skyflow-bridge.exe' into your main Flight Simulator folder. This is critical so it can access SimConnect.dll."
                  completed={isBridgeActive}
                  status="Location: C:\Program Files (x86)\Microsoft Games\Microsoft Flight Simulator X"
                />

                <SetupStep 
                  number="3" 
                  title="Launch Engine" 
                  desc="Double-click skyflow-bridge.exe. A terminal window will open. If successful, the 'BRIDGE' status above will turn LINKED."
                  completed={isBridgeActive}
                  status={isBridgeActive ? "Engine Operational" : "Waiting for Startup..."}
                />

                <SetupStep 
                  number="4" 
                  title="Connect Simulator" 
                  desc="Launch your Flight Simulator and start a flight. SkyFlow will automatically detect the active SimConnect session."
                  completed={isSimConnected}
                  status={isSimConnected ? "FSX Linked & Synchronized" : "Searching for SimConnect..."}
                />
              </div>

              <div className="bg-slate-900 border border-slate-800 p-10 rounded-[48px] text-center space-y-6">
                <div className="w-16 h-16 bg-sky-600/20 rounded-full flex items-center justify-center text-sky-500 mx-auto">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <p className="text-white font-black uppercase tracking-[0.2em] text-sm">System Verification Complete</p>
                  <p className="text-slate-500 text-sm max-w-lg mx-auto mt-2">The API is active using the pre-configured system key. No manual key entry is required.</p>
                </div>
                <button onClick={() => setActiveTab(NavigationTab.DASHBOARD)} className="px-12 py-5 bg-sky-600 hover:bg-sky-500 text-white font-black rounded-3xl uppercase tracking-widest text-xs transition-all shadow-2xl shadow-sky-900/40">Open Dashboard</button>
              </div>
            </div>
          )}

          {activeTab === NavigationTab.XGAUGE && <XGaugeConfig />}
        </main>
      </div>
    </div>
  );
};

const SetupStep = ({ number, title, desc, completed, action, status }: any) => (
  <div className={`p-10 rounded-[40px] border transition-all flex items-start gap-10 ${completed ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-900/40 border-slate-800 shadow-xl'}`}>
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black shrink-0 text-xl ${completed ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
      {completed ? '✓' : number}
    </div>
    <div className="flex-1 space-y-3">
      <h3 className={`text-xl font-black uppercase tracking-tight ${completed ? 'text-green-400' : 'text-white'}`}>{title}</h3>
      <p className="text-slate-400 text-base leading-relaxed max-w-2xl">{desc}</p>
      {status && <p className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border inline-block ${completed ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-slate-800 border-slate-700 text-slate-600'}`}>{status}</p>}
    </div>
    {action && <div className="shrink-0 pt-2">{action}</div>}
  </div>
);

const StatusBadge = ({ active, label, activeText, idleText, color = "sky" }) => (
  <div className={`px-4 py-2 rounded-xl border flex items-center gap-3 transition-all ${active ? `bg-${color}-500/10 border-${color}-500/30 text-${color}-400` : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}>
    <div className={`w-2.5 h-2.5 rounded-full ${active ? `bg-${color}-400 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]` : 'bg-slate-700'}`} />
    <span className="text-[10px] font-black uppercase tracking-[0.1em] whitespace-nowrap">{label}: {active ? activeText : idleText}</span>
  </div>
);

export default App;
