
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
    const splash = document.getElementById('boot-splash');
    if (splash) splash.classList.add('fade-out');
    const key = process.env.API_KEY;
    if (!key) addLog("API_KEY_UNDEFINED: Injection disabled.", "ERROR");
    else addLog("SkyFlow Intelligence Online", "SUCCESS");
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
    setLoading(true);
    try {
      const data = await fetchMetarData(icao);
      setCurrentMetar(data);
      if (isBridgeActive && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'INJECT_WEATHER', icao: data.icao, raw: data.raw }));
        addLog(`SYNC: ${data.icao} injected to Sim`, 'SUCCESS');
      } else {
        addLog(`DATA: ${data.icao} fetched (Preview Mode)`, 'INFO');
      }
    } catch (error: any) {
      addLog(`API ERROR: ${error.message}`, 'ERROR');
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
          <StatusBadge active={isBridgeActive} label="Bridge" activeText="LINKED" idleText="OFFLINE" onClick={() => setActiveTab(NavigationTab.SETUP)} />
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
                 <span className="text-[10px] font-bold text-slate-400">{isSimConnected ? 'SimConnect Active' : 'Waiting...'}</span>
               </div>
             </div>
             <p className="text-[8px] text-slate-700 uppercase tracking-widest text-center">Engine v2.9-PRD</p>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900/10 via-transparent to-transparent">
          {activeTab === NavigationTab.DASHBOARD && (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-900/60 p-10 rounded-[48px] border border-slate-800/50 shadow-2xl flex items-center justify-between gap-10">
                <div className="flex-1">
                  <h2 className="text-4xl font-black uppercase tracking-tighter text-white italic">Weather Injection</h2>
                  <p className="text-slate-500 text-sm mt-2">Generate hyper-realistic weather and sync it instantly.</p>
                </div>
                <div className="flex gap-4">
                  <input type="text" maxLength={4} value={stationQuery} onChange={e => setStationQuery(e.target.value.toUpperCase())} className="w-36 bg-black border-2 border-slate-800 rounded-3xl p-5 text-3xl font-black text-center text-white outline-none focus:border-sky-500 transition-all uppercase" placeholder="KLAX" />
                  <button onClick={() => handleInject()} disabled={loading} className={`px-10 rounded-3xl font-black uppercase tracking-widest text-[11px] transition-all ${loading ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-xl shadow-sky-900/30'}`}>
                    {loading ? 'SYNCING...' : 'FETCH & INJECT'}
                  </button>
                </div>
              </div>

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
                  {logs.length === 0 ? <div className="opacity-30">Listening for heartbeats...</div> : logs.map(l => (
                    <div key={l.id} className="py-0.5"><span className="opacity-40">[{l.timestamp}]</span> <span className={l.level === 'SUCCESS' ? 'text-green-500' : l.level === 'ERROR' ? 'text-red-500' : 'text-sky-400'}>{l.message}</span></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === NavigationTab.PLANNER && (
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
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Aircraft Frame</label>
                      <select value={flightPlan.aircraft} onChange={e => setFlightPlan({...flightPlan, aircraft: e.target.value})} className="w-full bg-black border border-slate-800 rounded-2xl p-4 font-black text-lg text-white appearance-none cursor-pointer outline-none focus:border-sky-600">
                        {FSX_AIRCRAFT.map(ac => <option key={ac} value={ac}>{ac}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Cruise (FL)</label>
                        <input type="number" value={flightPlan.cruiseAltitude} onChange={e => setFlightPlan({...flightPlan, cruiseAltitude: parseInt(e.target.value)})} className="w-full bg-black border border-slate-800 rounded-2xl p-4 font-black text-lg text-white outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Fuel (LB)</label>
                        <input type="number" value={flightPlan.fuelWeight} onChange={e => setFlightPlan({...flightPlan, fuelWeight: parseInt(e.target.value)})} className="w-full bg-black border border-slate-800 rounded-2xl p-4 font-black text-lg text-white outline-none" />
                      </div>
                    </div>
                 </div>
                 <button onClick={() => { addLog("Flight Plan Compiled", "SUCCESS"); setActiveTab(NavigationTab.BRIEFING); }} className="w-full bg-sky-600 hover:bg-sky-500 py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-sm shadow-2xl transition-all active:scale-95">Generate Flight Briefing</button>
               </div>
            </div>
          )}

          {activeTab === NavigationTab.SCENARIOS && (
             <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center">
                  <h2 className="text-5xl font-black uppercase tracking-tighter text-white italic">Historical Scenarios</h2>
                  <p className="text-slate-500 text-sm mt-4 font-bold tracking-widest uppercase">Experience real-world aviation challenges in your simulator</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {SCENARIOS.map(s => (
                    <div key={s.id} className="bg-slate-900/40 border border-slate-800 rounded-[40px] overflow-hidden group hover:border-sky-500/50 transition-all shadow-xl">
                      <div className="h-48 relative">
                        <img src={s.imageUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700" alt={s.title} />
                        <div className="absolute top-4 right-4 bg-red-600 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{s.severity}</div>
                      </div>
                      <div className="p-8 space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xl font-black italic">{s.title}</h3>
                          <span className="text-sky-500 font-bold text-xs">{s.icao}</span>
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed h-20 overflow-hidden line-clamp-3">{s.description}</p>
                        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">{s.date}</span>
                          <button onClick={() => handleInject(s.icao)} className="px-6 py-2 bg-slate-800 hover:bg-sky-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Re-live Weather</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          )}

          {activeTab === NavigationTab.BRIEFING && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="bg-slate-900 border border-slate-800 p-12 rounded-[48px] space-y-8">
                 <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-4xl font-black italic">Mission Briefing</h2>
                      <p className="text-slate-500 font-bold tracking-widest uppercase text-[10px] mt-1">Operational Summary for {flightPlan.departure} » {flightPlan.arrival}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sky-400 font-black text-2xl uppercase tracking-tighter">Clear for Takeoff</p>
                      <p className="text-slate-600 text-[9px] font-bold uppercase">Status Updated: Just Now</p>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-3 gap-6">
                    <BriefItem label="Route Risk" value="MODERATE" color="yellow" />
                    <BriefItem label="Fuel Req" value={`${flightPlan.fuelWeight} LBS`} color="sky" />
                    <BriefItem label="ETA (Est)" value="01:45 HRS" color="slate" />
                 </div>

                 <div className="space-y-4 pt-8 border-t border-slate-800">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Meteorological Advisory</h3>
                    <div className="bg-black/40 p-6 rounded-3xl border border-slate-800/50 space-y-4">
                      <p className="text-slate-400 text-sm leading-relaxed">
                        Expected cruise at FL{flightPlan.cruiseAltitude / 100} with light turbulence over the Rockies. {currentMetar ? `Current conditions at ${currentMetar.icao} report ${currentMetar.windSpeed}KT winds.` : 'Departure weather is currently clear.'}
                      </p>
                      <div className="flex gap-3">
                         <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[9px] font-black rounded-lg border border-green-500/20">NO ICING RISK</span>
                         <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 text-[9px] font-black rounded-lg border border-yellow-500/20">WIND SHEAR ALERT</span>
                      </div>
                    </div>
                 </div>
               </div>
            </div>
          )}

          {activeTab === NavigationTab.XGAUGE && <XGaugeConfig />}

          {activeTab === NavigationTab.SETUP && (
            <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
              <div className="text-center space-y-4">
                <h2 className="text-5xl font-black uppercase tracking-tighter text-white italic">FSX Readiness Center</h2>
                <p className="text-slate-500 max-w-xl mx-auto uppercase tracking-widest text-[10px] font-bold">Follow these steps to link your simulator</p>
              </div>
              <div className="grid gap-8">
                <SetupStep number="1" title="Acquire Bridge Terminal" desc="Download the bridge.exe file from your installation source." completed={isBridgeActive} action={<button className="bg-sky-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest">Download Bridge</button>} />
                <SetupStep number="2" title="Directory Placement" desc="Place bridge.exe into your Flight Simulator root folder." completed={isBridgeActive} />
                <SetupStep number="3" title="Engine Start" desc="Run bridge.exe and start your simulator session." completed={isSimConnected} />
              </div>
              <div className="bg-slate-900 border border-slate-800 p-10 rounded-[48px] text-center">
                <button onClick={() => setActiveTab(NavigationTab.DASHBOARD)} className="px-12 py-5 bg-sky-600 hover:bg-sky-500 text-white font-black rounded-3xl uppercase tracking-widest text-xs transition-all shadow-2xl shadow-sky-900/40">Open Dashboard</button>
              </div>
            </div>
          )}

          {activeTab === NavigationTab.SETTINGS && (
             <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="bg-slate-900/60 p-12 rounded-[48px] border border-slate-800/50 shadow-2xl space-y-12">
                 <h2 className="text-4xl font-black uppercase tracking-tighter text-white italic">Engine Config</h2>
                 <div className="grid gap-10">
                    <SettingsToggle label="Global Weather Smoothing" desc="Prevents sudden pressure jumps in FSX during new injections." active />
                    <SettingsToggle label="Dynamic Thermal Generation" desc="Simulates AI-driven updrafts based on local terrain data." active />
                    <div className="flex items-center justify-between p-6 bg-black/40 rounded-3xl border border-slate-800">
                       <div>
                         <p className="font-black text-sm uppercase tracking-tight">Barometric Units</p>
                         <p className="text-slate-500 text-xs">Choose between Mercury (InHg) or Hectopascals (hPa).</p>
                       </div>
                       <div className="flex gap-2 bg-slate-800 p-1 rounded-xl">
                          <button className="px-4 py-2 bg-sky-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest">InHg</button>
                          <button className="px-4 py-2 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-widest">hPa</button>
                       </div>
                    </div>
                 </div>
               </div>
             </div>
          )}
        </main>
      </div>
    </div>
  );
};

const StatusBadge = ({ active, label, activeText, idleText, color = "sky", onClick }: any) => (
  <button onClick={onClick} className={`px-4 py-2 rounded-xl border flex items-center gap-3 transition-all ${active ? `bg-${color}-500/10 border-${color}-500/30 text-${color}-400` : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}>
    <div className={`w-2.5 h-2.5 rounded-full ${active ? `bg-${color}-400 animate-pulse` : 'bg-slate-700'}`} />
    <span className="text-[10px] font-black uppercase tracking-[0.1em]">{label}: {active ? activeText : idleText}</span>
  </button>
);

const SetupStep = ({ number, title, desc, completed, action }: any) => (
  <div className={`p-8 rounded-[40px] border flex gap-10 ${completed ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-900/40 border-slate-800'}`}>
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black shrink-0 text-xl ${completed ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-500'}`}>{completed ? '✓' : number}</div>
    <div className="flex-1 space-y-2">
      <h3 className={`text-xl font-black uppercase tracking-tight ${completed ? 'text-green-400' : 'text-white'}`}>{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
    {action}
  </div>
);

const BriefItem = ({ label, value, color }: any) => (
  <div className={`p-6 bg-slate-800/30 border border-slate-700/50 rounded-3xl text-center`}>
    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-xl font-black text-${color}-400 italic`}>{value}</p>
  </div>
);

const SettingsToggle = ({ label, desc, active }: any) => (
  <div className="flex items-center justify-between p-6 bg-black/40 rounded-3xl border border-slate-800">
    <div>
      <p className="font-black text-sm uppercase tracking-tight">{label}</p>
      <p className="text-slate-500 text-xs">{desc}</p>
    </div>
    <div className={`w-14 h-8 rounded-full p-1 transition-all ${active ? 'bg-sky-600' : 'bg-slate-800'}`}>
      <div className={`w-6 h-6 bg-white rounded-full transition-all ${active ? 'translate-x-6' : 'translate-x-0'}`} />
    </div>
  </div>
);

export default App;
