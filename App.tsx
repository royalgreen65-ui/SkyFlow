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
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }),
      message,
      level
    };
    setLogs(prev => [...prev.slice(-8), newLog]);
  };

  useEffect(() => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      addLog("API CONFIG: Key not detected. Weather injection disabled.", "ERROR");
    } else {
      addLog("SkyFlow Intelligence Online", "SUCCESS");
    }
  }, []);

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

  const handleInject = async (icao: string = stationQuery) => {
    if (!icao) return;
    setLoading(true);
    try {
      const data = await fetchMetarData(icao);
      setCurrentMetar(data);
      if (isBridgeActive && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'INJECT_WEATHER', icao: data.icao, raw: data.raw }));
        addLog(`SYNC: ${data.icao} weather pushed to FSX`, 'SUCCESS');
      } else {
        addLog(`DATA: ${data.icao} retrieved (Local Preview)`, 'INFO');
      }
    } catch (error: any) {
      addLog(`API ERROR: ${error.message}`, 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case NavigationTab.DASHBOARD:
        return (
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900/60 p-10 rounded-[48px] border border-slate-800/50 shadow-2xl flex items-center justify-between gap-10">
              <div className="flex-1">
                <h2 className="text-4xl font-black uppercase tracking-tighter text-white italic leading-tight">SkyFlow Weather<br/>Injection</h2>
                <p className="text-slate-500 text-sm mt-3 font-medium tracking-wide">Sync hyper-realistic METAR data to FSX in real-time.</p>
              </div>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  maxLength={4} 
                  value={stationQuery} 
                  onChange={e => setStationQuery(e.target.value.toUpperCase())} 
                  className="w-36 bg-black border-2 border-slate-800 rounded-3xl p-5 text-3xl font-black text-center text-sky-400 outline-none focus:border-sky-500 transition-all uppercase placeholder:text-slate-800" 
                  placeholder="KLAX" 
                />
                <button 
                  onClick={() => handleInject()} 
                  disabled={loading} 
                  className={`px-10 rounded-3xl font-black uppercase tracking-widest text-[11px] transition-all ${loading ? 'bg-slate-800 text-slate-600' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-xl shadow-sky-900/30 active:scale-95'}`}
                >
                  {loading ? 'BUSY...' : 'SYNC ENGINE'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 pl-2">Atmospheric Telemetry</h3>
                {currentMetar ? <MetarDisplay data={currentMetar} /> : <div className="h-64 border-2 border-dashed border-slate-900/50 rounded-[32px] flex items-center justify-center text-slate-800 font-bold uppercase tracking-widest text-[10px]">Awaiting Uplink...</div>}
              </div>
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 pl-2">Radar Echo Projection</h3>
                {currentMetar ? <RadarView metar={currentMetar} /> : <div className="h-64 border-2 border-dashed border-slate-900/50 rounded-[32px] flex items-center justify-center text-slate-800 font-bold uppercase tracking-widest text-[10px]">Radar Standby</div>}
              </div>
            </div>
            
            <div className="bg-black/60 p-6 rounded-[24px] border border-slate-800/50 font-mono text-[10px] text-slate-600 shadow-2xl">
              <p className="font-black mb-3 uppercase text-slate-500 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                System Log Stream
              </p>
              <div className="space-y-1">
                {logs.length === 0 ? <div className="opacity-30">Monitoring avionics bus...</div> : logs.map(l => (
                  <div key={l.id} className="py-0.5"><span className="opacity-40">[{l.timestamp}]</span> <span className={l.level === 'SUCCESS' ? 'text-green-500' : l.level === 'ERROR' ? 'text-red-500' : 'text-sky-400'}>{l.message}</span></div>
                ))}
              </div>
            </div>
          </div>
        );

      case NavigationTab.PLANNER:
        return (
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-slate-900/60 p-12 rounded-[48px] border border-slate-800/50 shadow-2xl space-y-10">
               <h2 className="text-4xl font-black uppercase tracking-tighter text-white italic">Flight Dispatch</h2>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Departure</label>
                    <input type="text" value={flightPlan.departure} onChange={e => setFlightPlan({...flightPlan, departure: e.target.value.toUpperCase()})} className="w-full bg-black border border-slate-800 rounded-2xl p-4 font-black text-xl text-sky-400 outline-none focus:border-sky-600" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Arrival</label>
                    <input type="text" value={flightPlan.arrival} onChange={e => setFlightPlan({...flightPlan, arrival: e.target.value.toUpperCase()})} className="w-full bg-black border border-slate-800 rounded-2xl p-4 font-black text-xl text-sky-400 outline-none focus:border-sky-600" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Alternate</label>
                    <input type="text" value={flightPlan.alternate} onChange={e => setFlightPlan({...flightPlan, alternate: e.target.value.toUpperCase()})} className="w-full bg-black border border-slate-800 rounded-2xl p-4 font-black text-xl text-slate-400 outline-none focus:border-sky-600" />
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Aircraft Registry</label>
                    <select value={flightPlan.aircraft} onChange={e => setFlightPlan({...flightPlan, aircraft: e.target.value})} className="w-full bg-black border border-slate-800 rounded-2xl p-4 font-black text-lg text-white appearance-none cursor-pointer outline-none focus:border-sky-600">
                      {FSX_AIRCRAFT.map(ac => <option key={ac} value={ac}>{ac}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Cruise (FT)</label>
                      <input type="number" value={flightPlan.cruiseAltitude} onChange={e => setFlightPlan({...flightPlan, cruiseAltitude: parseInt(e.target.value) || 0})} className="w-full bg-black border border-slate-800 rounded-2xl p-4 font-black text-lg text-white outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Fuel (LB)</label>
                      <input type="number" value={flightPlan.fuelWeight} onChange={e => setFlightPlan({...flightPlan, fuelWeight: parseInt(e.target.value) || 0})} className="w-full bg-black border border-slate-800 rounded-2xl p-4 font-black text-lg text-white outline-none" />
                    </div>
                  </div>
               </div>
               <button onClick={() => { addLog("Mission Compiled Successfully", "SUCCESS"); setActiveTab(NavigationTab.BRIEFING); }} className="w-full bg-sky-600 hover:bg-sky-500 py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-sm shadow-2xl transition-all active:scale-95">Compile Briefing Package</button>
             </div>
          </div>
        );

      case NavigationTab.SCENARIOS:
        return (
          <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="text-center">
              <h2 className="text-5xl font-black uppercase tracking-tighter text-white italic">Historical Scenarios</h2>
              <p className="text-slate-500 text-sm mt-4 font-bold tracking-widest uppercase">Experience famous weather incidents in FSX</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {SCENARIOS.map(s => (
                <div key={s.id} className="bg-slate-900/40 border border-slate-800 rounded-[40px] overflow-hidden group hover:border-sky-500/50 transition-all shadow-xl">
                  <div className="h-48 relative overflow-hidden">
                    <img src={s.imageUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" alt={s.title} />
                    <div className="absolute top-4 right-4 bg-red-600 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">{s.severity}</div>
                  </div>
                  <div className="p-8 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-black italic">{s.title}</h3>
                      <span className="text-sky-500 font-bold text-xs">{s.icao}</span>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed h-20 line-clamp-3">{s.description}</p>
                    <button onClick={() => handleInject(s.icao)} className="w-full py-4 bg-slate-800 hover:bg-sky-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] transition-all">Re-Live Conditions</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case NavigationTab.BRIEFING:
        return (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-slate-900 border border-slate-800 p-12 rounded-[48px] space-y-8">
               <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-4xl font-black italic">Mission Briefing</h2>
                    <p className="text-slate-500 font-bold tracking-widest uppercase text-[10px] mt-1">Operational Summary: {flightPlan.departure} » {flightPlan.arrival}</p>
                  </div>
                  <div className="text-right">
                    <span className="bg-green-500/10 text-green-500 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-500/20">Operational Clear</span>
                  </div>
               </div>
               
               <div className="grid grid-cols-3 gap-6">
                  <div className="p-6 bg-slate-800/30 border border-slate-700/50 rounded-3xl text-center">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Risk Profile</p>
                    <p className="text-xl font-black text-yellow-400 italic">MODERATE</p>
                  </div>
                  <div className="p-6 bg-slate-800/30 border border-slate-700/50 rounded-3xl text-center">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Fuel Weight</p>
                    <p className="text-xl font-black text-sky-400 italic">{flightPlan.fuelWeight} LB</p>
                  </div>
                  <div className="p-6 bg-slate-800/30 border border-slate-700/50 rounded-3xl text-center">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Alternate</p>
                    <p className="text-xl font-black text-slate-400 italic">{flightPlan.alternate}</p>
                  </div>
               </div>

               <div className="space-y-4 pt-8 border-t border-slate-800">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Weather Advisory</h3>
                  <div className="bg-black/40 p-8 rounded-3xl border border-slate-800/50 space-y-4 font-medium text-slate-400 text-sm leading-relaxed">
                    <p>Expected cruise altitude FL{Math.round(flightPlan.cruiseAltitude / 100)}. Current METAR for {flightPlan.departure}: {currentMetar?.raw || 'N/A'}. Warning: Potential turbulence over mountain areas.</p>
                  </div>
               </div>
             </div>
          </div>
        );

      case NavigationTab.XGAUGE:
        return <XGaugeConfig />;

      case NavigationTab.SETUP:
        return (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="text-center space-y-4">
              <h2 className="text-5xl font-black uppercase tracking-tighter text-white italic">Setup Center</h2>
              <p className="text-slate-500 max-w-xl mx-auto uppercase tracking-widest text-[10px] font-bold">Bridge installation guide for FSX and Prepar3D</p>
            </div>
            <div className="grid gap-8">
              <div className={`p-8 rounded-[40px] border flex gap-10 bg-slate-900/40 border-slate-800`}>
                <div className="w-14 h-14 rounded-2xl bg-sky-600 flex items-center justify-center font-black text-xl text-white">1</div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tight text-white">Acquire Bridge</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">Locate 'skyflow-bridge.exe' in your downloaded package. This is the link between your simulator and this dashboard.</p>
                </div>
              </div>
              <div className={`p-8 rounded-[40px] border flex gap-10 bg-slate-900/40 border-slate-800`}>
                <div className="w-14 h-14 rounded-2xl bg-sky-600 flex items-center justify-center font-black text-xl text-white">2</div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tight text-white">Simulation Directory</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">Move the bridge executable to your main Flight Simulator installation folder (where FSX.exe lives).</p>
                </div>
              </div>
              <div className={`p-8 rounded-[40px] border flex gap-10 bg-slate-900/40 border-slate-800`}>
                <div className="w-14 h-14 rounded-2xl bg-sky-600 flex items-center justify-center font-black text-xl text-white">3</div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tight text-white">Verification</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">Run the bridge and refresh this page. The 'Bridge' status indicator in the header will turn green.</p>
                </div>
              </div>
            </div>
          </div>
        );

      case NavigationTab.SETTINGS:
        return (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-slate-900/60 p-12 rounded-[48px] border border-slate-800/50 shadow-2xl space-y-12">
               <h2 className="text-4xl font-black uppercase tracking-tighter text-white italic">Engine Config</h2>
               <div className="grid gap-10">
                  <div className="flex items-center justify-between p-6 bg-black/40 rounded-3xl border border-slate-800">
                    <div>
                      <p className="font-black text-sm uppercase tracking-tight">Weather Smoothing</p>
                      <p className="text-slate-500 text-xs">Prevents sudden pressure jumps during injection.</p>
                    </div>
                    <div className="w-14 h-8 bg-sky-600 rounded-full p-1"><div className="w-6 h-6 bg-white rounded-full translate-x-6" /></div>
                  </div>
                  <div className="flex items-center justify-between p-6 bg-black/40 rounded-3xl border border-slate-800">
                    <div>
                      <p className="font-black text-sm uppercase tracking-tight">Auto-Sync On Load</p>
                      <p className="text-slate-500 text-xs">Injects departure weather as soon as the sim is detected.</p>
                    </div>
                    <div className="w-14 h-8 bg-slate-800 rounded-full p-1"><div className="w-6 h-6 bg-white rounded-full" /></div>
                  </div>
               </div>
             </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#05070a] text-slate-100 font-sans overflow-hidden">
      <header className="h-20 bg-slate-900/40 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between px-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center text-xl font-black italic shadow-lg shadow-sky-900/20">S</div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tighter leading-none">SkyFlow</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Universal Avionics Dashboard</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className={`px-4 py-2 rounded-xl border flex items-center gap-3 transition-all ${isBridgeActive ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}>
            <div className={`w-2 h-2 rounded-full ${isBridgeActive ? 'bg-sky-400 animate-pulse' : 'bg-slate-700'}`} />
            <span className="text-[10px] font-black uppercase tracking-[0.1em]">Bridge: {isBridgeActive ? 'LINKED' : 'OFFLINE'}</span>
          </div>
          <div className={`px-4 py-2 rounded-xl border flex items-center gap-3 transition-all ${isSimConnected ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}>
            <div className={`w-2 h-2 rounded-full ${isSimConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-700'}`} />
            <span className="text-[10px] font-black uppercase tracking-[0.1em]">Sim: {isSimConnected ? 'READY' : 'WAITING'}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-[#0a0f17] border-r border-slate-800 p-6 flex flex-col gap-2 shrink-0">
          {Object.values(NavigationTab).map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`w-full text-left px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
            >
              {tab}
            </button>
          ))}
          <div className="mt-auto p-4 bg-slate-900/50 rounded-2xl border border-slate-800/50 text-center">
            <p className="text-[8px] text-slate-600 uppercase font-black tracking-widest mb-1">Engine v2.9-STABLE</p>
            <div className="flex justify-center gap-1">
              <div className="w-1 h-1 rounded-full bg-green-500"></div>
              <div className="w-1 h-1 rounded-full bg-green-500"></div>
              <div className="w-1 h-1 rounded-full bg-slate-700"></div>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900/10 via-transparent to-transparent">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;