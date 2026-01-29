import React, { useState, useEffect, useRef } from 'react';
import { MetarData, NavigationTab, LogEntry, FlightPlan } from './types';
import { fetchMetarData } from './services/geminiService';
import { MetarDisplay } from './components/MetarDisplay';
import { RadarView } from './components/RadarView';
import { XGaugeConfig } from './components/XGaugeConfig';
import { SCENARIOS, FSX_AIRCRAFT } from './constants';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>(NavigationTab.DASHBOARD);
  const [loading, setLoading] = useState(false);
  const [currentMetar, setCurrentMetar] = useState<MetarData | null>(null);
  const [stationQuery, setStationQuery] = useState('KLAX');
  const [isSimConnected, setIsSimConnected] = useState(false);
  const [isBridgeActive, setIsBridgeActive] = useState(false);
  const [persistentLogs, setPersistentLogs] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [flightPlan, setFlightPlan] = useState<FlightPlan>({
    departure: 'KLAX',
    arrival: 'KSFO',
    alternate: 'KSJC',
    aircraft: 'Boeing 737-800',
    cruiseAltitude: 36000,
    fuelWeight: 18500
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  
  const addLog = (message: string, level: LogEntry['level'] = 'INFO') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }),
      message,
      level
    };
    setLogs(prev => [...prev.slice(-12), newLog]);
  };

  useEffect(() => {
    addLog("Avionics core active.", "INFO");
    fetchPersistentLogs();
  }, []);

  const fetchPersistentLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const text = await res.text();
        setPersistentLogs(text);
      }
    } catch (e) {
      console.log("Persistent logs only available when running bridge.js locally.");
    }
  };

  useEffect(() => {
    let reconnectTimer: any;
    const connectBridge = () => {
      try {
        const ws = new WebSocket('ws://localhost:8080');
        ws.onopen = () => {
          setIsBridgeActive(true);
          addLog("LINK: SimConnect Bridge Online", "SUCCESS");
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'STATUS') setIsSimConnected(data.connected);
          } catch (e) {}
        };
        ws.onclose = () => {
          setIsBridgeActive(false);
          setIsSimConnected(false);
          reconnectTimer = setTimeout(connectBridge, 5000);
        };
        ws.onerror = () => ws.close();
        wsRef.current = ws;
      } catch (err) {
        reconnectTimer = setTimeout(connectBridge, 5000);
      }
    };
    connectBridge();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const handleInject = async (icao: string = stationQuery) => {
    if (!icao) return;
    setLoading(true);
    addLog(`TELEMETRY: Querying ${icao}...`, 'INFO');
    try {
      const data = await fetchMetarData(icao);
      setCurrentMetar(data);
      if (isBridgeActive && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'INJECT_WEATHER', icao: data.icao, raw: data.raw }));
        addLog(`SYNC: ${data.icao} injected to simulator`, 'SUCCESS');
      } else {
        addLog(`PREVIEW: Local data for ${data.icao} loaded.`, 'SUCCESS');
      }
    } catch (error: any) {
      addLog(`FAULT: ${error.message}`, 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case NavigationTab.DASHBOARD:
        return (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-slate-900/60 p-8 rounded-[32px] border border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
              <div className="text-center md:text-left">
                <h2 className="text-3xl font-black uppercase tracking-tighter text-white italic">Atmospheric Core</h2>
                <p className="text-slate-500 text-[10px] font-bold tracking-[0.2em] mt-1 uppercase">Direct FSX/P3D SimConnect Uplink</p>
              </div>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  maxLength={4} 
                  value={stationQuery} 
                  onChange={e => setStationQuery(e.target.value.toUpperCase())} 
                  className="w-24 bg-black border border-slate-800 rounded-2xl p-4 text-2xl font-black text-center text-sky-400 outline-none focus:border-sky-500 uppercase transition-colors" 
                />
                <button 
                  onClick={() => handleInject()} 
                  disabled={loading} 
                  className={`px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${loading ? 'bg-slate-800 text-slate-600' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-xl shadow-sky-900/20 active:scale-95'}`}
                >
                  {loading ? 'BUSY' : 'SYNC WEATHER'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600 ml-2">Metar Intelligence</label>
                {currentMetar ? <MetarDisplay data={currentMetar} /> : <div className="h-64 border border-slate-800/50 rounded-[24px] flex items-center justify-center text-slate-800 font-bold uppercase tracking-widest text-[10px] bg-slate-950/20">Standby for Uplink</div>}
              </div>
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600 ml-2">Prognostic Radar</label>
                {currentMetar ? <RadarView metar={currentMetar} /> : <div className="h-64 border border-slate-800/50 rounded-[24px] flex items-center justify-center text-slate-800 font-bold uppercase tracking-widest text-[10px] bg-slate-950/20">Radar Diagnostic Inactive</div>}
              </div>
            </div>
            
            <div className="bg-black/90 p-5 rounded-2xl border border-slate-800/50 font-mono text-[10px]">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800/50 pb-2">
                 <p className="font-black uppercase flex items-center gap-2 text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                    Operational Log Stream
                 </p>
                 <button onClick={fetchPersistentLogs} className="text-[8px] text-sky-500 font-black hover:text-white transition-colors">REFRESH DISK LOGS</button>
              </div>
              <div className="space-y-1 overflow-y-auto max-h-40">
                {logs.map(l => (
                  <div key={l.id} className="flex gap-4">
                    <span className="opacity-20 text-white">[{l.timestamp}]</span>
                    <span className={l.level === 'SUCCESS' ? 'text-green-500' : l.level === 'ERROR' ? 'text-red-500' : l.level === 'WARN' ? 'text-yellow-500' : 'text-sky-400'}>{l.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case NavigationTab.SETTINGS:
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="bg-slate-900 p-10 rounded-[40px] border border-slate-800 shadow-2xl space-y-8">
              <h2 className="text-3xl font-black italic">Persistent Disk Log</h2>
              <div className="bg-black/80 p-6 rounded-3xl border border-slate-800 font-mono text-[11px] h-96 overflow-y-auto whitespace-pre text-slate-500">
                {persistentLogs || 'Connect to bridge.js to view persistent file logs.'}
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                <span>Auto-Purge: 30 Days</span>
                <span>Storage: skyflow_avionics.log</span>
              </div>
            </div>
          </div>
        );

      case NavigationTab.PLANNER:
      case NavigationTab.SCENARIOS:
      case NavigationTab.BRIEFING:
      case NavigationTab.XGAUGE:
      case NavigationTab.SETUP:
        return (
          <div className="max-w-4xl mx-auto p-12 text-center border-2 border-dashed border-slate-800 rounded-[40px] mt-20">
            <p className="text-slate-600 font-black uppercase tracking-[0.4em]">System Module Standby</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#05070a] text-slate-100 font-sans overflow-hidden">
      <header className="h-16 bg-slate-900/40 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-sky-600 rounded-xl flex items-center justify-center text-xl font-black italic">S</div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tighter leading-none">SkyFlow</h1>
            <p className="text-[7px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Avionics Professional</p>
          </div>
        </div>
        <div className="flex gap-4">
          <HeaderBadge active={isBridgeActive} label="Bridge" />
          <HeaderBadge active={isSimConnected} label="Link" color="green" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-[#0a0f17] border-r border-slate-800 p-6 flex flex-col gap-1 shrink-0">
          {Object.values(NavigationTab).map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`w-full text-left px-5 py-3.5 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/20' : 'text-slate-600 hover:bg-slate-800 hover:text-slate-300'}`}
            >
              {tab}
            </button>
          ))}
          <div className="mt-auto p-4 border-t border-slate-800/50 text-center opacity-30">
             <p className="text-[7px] text-slate-400 uppercase font-black tracking-[0.3em]">Build 2.10-FINAL</p>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-12 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900/10 via-transparent to-transparent">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

const HeaderBadge = ({ active, label, color = "sky" }: any) => (
  <div className={`px-4 py-1.5 rounded-xl border flex items-center gap-3 transition-all ${active ? `bg-${color}-500/10 border-${color}-500/30 text-${color}-400` : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}>
    <div className={`w-1.5 h-1.5 rounded-full ${active ? `bg-${color}-400 animate-pulse` : 'bg-slate-700'}`} />
    <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
  </div>
);

export default App;