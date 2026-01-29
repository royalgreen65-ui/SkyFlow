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
    const key = (window as any).process?.env?.API_KEY || (process as any).env?.API_KEY;
    if (!key) {
      addLog("API CONFIG: System running in limited mode.", "WARN");
    } else {
      addLog("SkyFlow Engine Initialized.", "SUCCESS");
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
        addLog(`DATA: ${data.icao} retrieved (Bridge Offline)`, 'INFO');
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
                <h2 className="text-4xl font-black uppercase tracking-tighter text-white italic">Weather Injection</h2>
                <p className="text-slate-500 text-sm mt-2 font-medium tracking-wide">Generate hyper-realistic weather telemetry via Gemini AI.</p>
              </div>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  maxLength={4} 
                  value={stationQuery} 
                  onChange={e => setStationQuery(e.target.value.toUpperCase())} 
                  className="w-36 bg-black border-2 border-slate-800 rounded-3xl p-5 text-3xl font-black text-center text-sky-400 outline-none focus:border-sky-500 transition-all uppercase" 
                  placeholder="KLAX" 
                />
                <button 
                  onClick={() => handleInject()} 
                  disabled={loading} 
                  className={`px-10 rounded-3xl font-black uppercase tracking-widest text-[11px] transition-all ${loading ? 'bg-slate-800 text-slate-600' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-xl shadow-sky-900/30 active:scale-95'}`}
                >
                  {loading ? 'BUSY...' : 'FETCH & INJECT'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 pl-2">Metar Telemetry</h3>
                {currentMetar ? <MetarDisplay data={currentMetar} /> : <EmptyState text="Awaiting Station Query" />}
              </div>
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 pl-2">Volumetric Visualization</h3>
                {currentMetar ? <RadarView metar={currentMetar} /> : <EmptyState text="Radar Standby" />}
              </div>
            </div>
            
            <SystemStream logs={logs} />
          </div>
        );

      case NavigationTab.PLANNER:
        return (
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900/60 p-12 rounded-[48px] border border-slate-800/50 shadow-2xl space-y-10">
              <h2 className="text-4xl font-black uppercase tracking-tighter text-white italic">Flight Dispatch</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <PlanInput label="Departure" value={flightPlan.departure} onChange={v => setFlightPlan({...flightPlan, departure: v})} />
                <PlanInput label="Arrival" value={flightPlan.arrival} onChange={v => setFlightPlan({...flightPlan, arrival: v})} />
                <PlanInput label="Alternate" value={flightPlan.alternate} onChange={v => setFlightPlan({...flightPlan, alternate: v})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Selected Aircraft</label>
                  <select 
                    value={flightPlan.aircraft} 
                    onChange={e => setFlightPlan({...flightPlan, aircraft: e.target.value})} 
                    className="w-full bg-black border border-slate-800 rounded-2xl p-4 font-black text-lg text-white appearance-none cursor-pointer outline-none focus:border-sky-600"
                  >
                    {FSX_AIRCRAFT.map(ac => <option key={ac} value={ac}>{ac}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <PlanInput label="Cruise (FT)" value={flightPlan.cruiseAltitude.toString()} type="number" onChange={v => setFlightPlan({...flightPlan, cruiseAltitude: parseInt(v) || 0})} />
                  <PlanInput label="Fuel (LB)" value={flightPlan.fuelWeight.toString()} type="number" onChange={v => setFlightPlan({...flightPlan, fuelWeight: parseInt(v) || 0})} />
                </div>
              </div>
              <button 
                onClick={() => { addLog("Flight Plan Finalized", "SUCCESS"); setActiveTab(NavigationTab.BRIEFING); }} 
                className="w-full bg-sky-600 hover:bg-sky-500 py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-sm shadow-2xl transition-all active:scale-95"
              >
                Compile Briefing Package
              </button>
            </div>
          </div>
        );

      case NavigationTab.SCENARIOS:
        return (
          <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="text-center">
              <h2 className="text-5xl font-black uppercase tracking-tighter text-white italic">Historical Scenarios</h2>
              <p className="text-slate-500 text-sm mt-4 font-bold tracking-widest uppercase">Simulate famous aviation challenges</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {SCENARIOS.map(s => (
                <ScenarioCard key={s.id} scenario={s} onInject={() => handleInject(s.icao)} />
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
                  <p className="text-slate-500 font-bold tracking-widest uppercase text-[10px] mt-1">Route: {flightPlan.departure} » {flightPlan.arrival}</p>
                </div>
                <div className="text-right">
                  <span className="bg-green-500/10 text-green-500 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-500/20">Operational Ready</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <StatsCard label="Route Distance" value="382 NM" />
                <StatsCard label="T/O Weight" value="142,500 LB" />
                <StatsCard label="Alternate" value={flightPlan.alternate} />
              </div>
              <div className="p-8 bg-black/40 rounded-[32px] border border-slate-800 space-y-4 font-medium text-slate-400 text-sm leading-relaxed">
                <p>Weather at {flightPlan.departure}: {currentMetar?.raw || 'Pending update.'}</p>
                <p>En-route hazards: Light icing expected above FL240. No significant SIGMETS reported for transit area.</p>
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
              <p className="text-slate-500 max-w-xl mx-auto uppercase tracking-widest text-[10px] font-bold">Follow these steps to link SkyFlow to FSX</p>
            </div>
            <div className="grid gap-6">
              <SetupStep num="1" title="Acquire Bridge" desc="Download skyflow-bridge.exe from your dispatch console." active={isBridgeActive} />
              <SetupStep num="2" title="Installation" desc="Move bridge.exe to your main Flight Simulator folder." active={isBridgeActive} />
              <SetupStep num="3" title="Ignition" desc="Run bridge.exe and verify the 'LINKED' status above." active={isBridgeActive} />
            </div>
          </div>
        );

      case NavigationTab.SETTINGS:
        return (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900/60 p-12 rounded-[48px] border border-slate-800/50 shadow-2xl space-y-12">
              <h2 className="text-4xl font-black uppercase tracking-tighter text-white italic">System Settings</h2>
              <div className="space-y-6">
                <SettingsToggle label="Global AI Enhancement" desc="Uses Gemini Pro for hyper-realistic METAR generation." active />
                <SettingsToggle label="Auto-Bridge Link" desc="Automatically searches for local FSX instances on startup." active />
                <SettingsToggle label="Smooth Pressure Transition" desc="Gradually updates altimeter to prevent FSX crashes." active={false} />
              </div>
            </div>
          </div>
        );

      default:
        return <div className="p-20 text-center text-slate-700 font-black uppercase tracking-widest">Section Under Maintenance</div>;
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
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`w-full text-left px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
            >
              {tab}
            </button>
          ))}
          <div className="mt-auto p-4 bg-slate-900/50 rounded-2xl border border-slate-800/50">
            <p className="text-[8px] text-slate-600 uppercase font-black tracking-widest text-center">Version 2.9-Stable</p>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900/10 via-transparent to-transparent">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="h-64 border-2 border-dashed border-slate-900 rounded-[32px] flex items-center justify-center text-slate-800 font-bold uppercase tracking-widest text-[10px]">
    {text}
  </div>
);

const SystemStream = ({ logs }: { logs: LogEntry[] }) => (
  <div className="bg-black/60 p-6 rounded-[24px] border border-slate-800/50 font-mono text-[10px] text-slate-600 shadow-2xl">
    <p className="font-black mb-3 uppercase text-slate-500 flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
      Engine Log
    </p>
    <div className="space-y-1">
      {logs.length === 0 ? <div className="opacity-30">Monitoring avionics stream...</div> : logs.map(l => (
        <div key={l.id} className="py-0.5"><span className="opacity-40">[{l.timestamp}]</span> <span className={l.level === 'SUCCESS' ? 'text-green-500' : l.level === 'ERROR' ? 'text-red-500' : 'text-sky-400'}>{l.message}</span></div>
      ))}
    </div>
  </div>
);

const PlanInput = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">{label}</label>
    <input 
      type={type} 
      value={value} 
      onChange={e => onChange(e.target.value.toUpperCase())} 
      className="w-full bg-black border border-slate-800 rounded-2xl p-4 font-black text-xl text-sky-400 outline-none focus:border-sky-600" 
    />
  </div>
);

const StatsCard = ({ label, value }: any) => (
  <div className="p-6 bg-slate-800/30 border border-slate-700/50 rounded-3xl text-center">
    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-xl font-black text-white italic">{value}</p>
  </div>
);

const ScenarioCard = ({ scenario, onInject }: any) => (
  <div className="bg-slate-900/40 border border-slate-800 rounded-[40px] overflow-hidden group hover:border-sky-500/50 transition-all shadow-xl">
    <div className="h-48 relative overflow-hidden">
      <img src={scenario.imageUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" alt={scenario.title} />
      <div className="absolute top-4 right-4 bg-red-600 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">{scenario.severity}</div>
    </div>
    <div className="p-8 space-y-4">
      <h3 className="text-xl font-black italic">{scenario.title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed h-20 line-clamp-3">{scenario.description}</p>
      <button onClick={onInject} className="w-full py-3 bg-slate-800 hover:bg-sky-600 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all">Re-Live Scenario</button>
    </div>
  </div>
);

const SetupStep = ({ num, title, desc, active }: any) => (
  <div className={`p-8 rounded-[32px] border transition-all flex items-center gap-8 ${active ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-900/40 border-slate-800'}`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${active ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-600'}`}>{active ? '✓' : num}</div>
    <div>
      <h4 className={`font-black uppercase tracking-tight ${active ? 'text-green-500' : 'text-white'}`}>{title}</h4>
      <p className="text-slate-500 text-sm font-medium">{desc}</p>
    </div>
  </div>
);

const SettingsToggle = ({ label, desc, active }: any) => (
  <div className="flex items-center justify-between p-6 bg-black/40 rounded-3xl border border-slate-800">
    <div>
      <p className="font-black text-sm uppercase tracking-tight">{label}</p>
      <p className="text-slate-500 text-xs font-medium">{desc}</p>
    </div>
    <div className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-all ${active ? 'bg-sky-600' : 'bg-slate-800'}`}>
      <div className={`w-4 h-4 bg-white rounded-full transition-all ${active ? 'translate-x-6' : 'translate-x-0'}`} />
    </div>
  </div>
);

const StatusBadge = ({ active, label, activeText, idleText, color = "sky", onClick }: any) => (
  <button onClick={onClick} className={`px-4 py-2 rounded-xl border flex items-center gap-3 transition-all ${active ? `bg-${color}-500/10 border-${color}-500/30 text-${color}-400` : 'bg-slate-800/50 border-slate-700 text-slate-600'}`}>
    <div className={`w-2 h-2 rounded-full ${active ? `bg-${color}-400 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]` : 'bg-slate-700'}`} />
    <span className="text-[10px] font-black uppercase tracking-[0.1em]">{label}: {active ? activeText : idleText}</span>
  </button>
);

export default App;