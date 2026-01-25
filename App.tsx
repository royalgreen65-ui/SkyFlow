
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
  const [stationQuery, setStationQuery] = useState('KLAX');
  const [isSimConnected, setIsSimConnected] = useState(false);
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Telemetry & Flight Tracking
  const [distanceToDest, setDistanceToDest] = useState(120); // Nautical Miles
  const [flightPhase, setFlightPhase] = useState<FlightPhase>(FlightPhase.GROUND);
  const [isWeatherLocked, setIsWeatherLocked] = useState(false);
  
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // Flight Planner State
  const [flightPlan, setFlightPlan] = useState<FlightPlan>({
    departure: 'KLAX',
    arrival: 'KSFO',
    alternate: 'KSJC',
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

  // Fix: Added missing loadScenario function to handle historical scenario selection
  const loadScenario = (scenario: Scenario) => {
    addLog(`Loading Historical Scenario: ${scenario.title}`, 'WARN');
    setStationQuery(scenario.icao);
    handleSearchStation(scenario.icao);
    setFlightPlan(prev => ({
      ...prev,
      departure: scenario.icao,
      arrival: scenario.icao
    }));
  };

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Initial load
  useEffect(() => {
    addLog("SkyFlow Engine Initialized");
    addLog("Ready for SimConnect link...");
    handleSearchStation('KLAX');
  }, []);

  // Simulator Telemetry Simulation
  useEffect(() => {
    let interval: any;
    if (isSimConnected && isAutoSyncEnabled) {
      interval = setInterval(() => {
        setDistanceToDest(prev => {
          const next = Math.max(0, prev - 1);
          
          // Logic for Flight Phases
          if (next > 100) setFlightPhase(FlightPhase.DEPARTURE);
          else if (next > 40) setFlightPhase(FlightPhase.ENROUTE);
          else if (next > 0) setFlightPhase(FlightPhase.APPROACH);
          else setFlightPhase(FlightPhase.LANDED);

          // Weather Lock Logic: Do not change weather on approach (< 40nm)
          if (next <= 40 && !isWeatherLocked && next > 0) {
            setIsWeatherLocked(true);
            addLog(`APPROACH LOCK: Weather frozen for ${flightPlan.arrival} arrival`, 'WARN');
          }

          // Dynamic Updates logic (only if not locked)
          if (next > 40 && next % 10 === 0) {
             handleSearchStation(flightPlan.departure === 'KLAX' ? 'KSBA' : 'KLAX'); // Mocking en-route station handoff
             addLog(`EN-ROUTE SYNC: New station hand-off completed.`);
          }

          return next;
        });
      }, 3000); // Fast simulation for demo
    }
    return () => clearInterval(interval);
  }, [isSimConnected, isAutoSyncEnabled, isWeatherLocked, flightPlan]);

  const handleSearchStation = async (icao: string) => {
    if (isWeatherLocked) {
      addLog(`Update blocked: Weather is locked for approach.`, 'WARN');
      return;
    }
    setLoading(true);
    addLog(`Fetching METAR: ${icao}`);
    try {
      const data = await fetchMetarData(icao);
      setCurrentMetar(data);
      addLog(`Station ${icao} active.`, 'SUCCESS');
    } catch (error) {
      addLog(`Station fetch failed.`, 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  const handleBriefing = async () => {
    if (!flightPlan.departure || !flightPlan.arrival) return;
    setLoading(true);
    addLog(`Briefing requested: ${flightPlan.departure} > ${flightPlan.arrival}`);
    try {
      const dep = await fetchMetarData(flightPlan.departure);
      const arr = await fetchMetarData(flightPlan.arrival);
      const text = await generateBriefing(flightPlan, dep, arr);
      setBriefing(text);
      setActiveTab(NavigationTab.BRIEFING);
      addLog("Briefing synthesized.", 'SUCCESS');
    } catch (error) {
      addLog("Briefing engine error.", 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  const injectToSim = () => {
    if (!isSimConnected) {
      alert("SimConnect required.");
      return;
    }
    setLoading(true);
    addLog(`Force injecting ${currentMetar?.icao} to sim...`);
    setTimeout(() => {
      setLoading(false);
      addLog("Injection success.", 'SUCCESS');
    }, 1000);
  };

  const toggleConnection = () => {
    if (isSimConnected) {
      setIsSimConnected(false);
      setIsWeatherLocked(false);
      setDistanceToDest(120);
      setFlightPhase(FlightPhase.GROUND);
      addLog("Simulator link closed.");
    } else {
      setLoading(true);
      addLog("Handshaking with FSX...");
      setTimeout(() => {
        setIsSimConnected(true);
        setLoading(false);
        addLog("SimConnect Linked: FSX Steam Edition", 'SUCCESS');
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden select-none">
      {/* Native Title Bar */}
      <div className="h-8 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-sky-500 rounded-sm flex items-center justify-center font-bold text-[10px] italic">S</div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">SkyFlow Weather Bridge</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-3 text-[9px] font-mono">
             <span className={isWeatherLocked ? "text-amber-500 animate-pulse" : "text-slate-600"}>
               {isWeatherLocked ? "WEATHER LOCKED" : "WEATHER DYNAMIC"}
             </span>
             <span className="text-slate-700">|</span>
             <span className={isSimConnected ? "text-green-500" : "text-red-500"}>
               {isSimConnected ? "FSX: ACTIVE" : "FSX: OFFLINE"}
             </span>
          </div>
          <div className="flex h-8 ml-2">
            <button className="w-8 hover:bg-slate-800 text-slate-600 text-[10px]">✕</button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-lg font-black text-white tracking-tighter">SKYFLOW <span className="text-sky-500">v4.2</span></h1>
          </div>

          <div className="flex-1 py-2">
            {Object.values(NavigationTab).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-6 py-2.5 flex items-center gap-3 transition-all ${
                  activeTab === tab 
                  ? 'bg-sky-600/10 text-sky-400 border-r-2 border-sky-500' 
                  : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-widest">{tab}</span>
              </button>
            ))}
          </div>

          {/* Real-time System Log */}
          <div className="h-40 bg-black/40 border-t border-slate-800 overflow-hidden flex flex-col">
            <div className="bg-slate-900 px-3 py-1 border-b border-slate-800 text-[9px] font-bold text-slate-500 uppercase">System Telemetry</div>
            <div ref={logContainerRef} className="flex-1 p-2 font-mono text-[9px] overflow-y-auto space-y-1">
              {logs.map(log => (
                <div key={log.id} className="flex gap-1.5 opacity-80">
                  <span className="text-slate-600">[{log.timestamp}]</span>
                  <span className={
                    log.level === 'SUCCESS' ? 'text-green-500' :
                    log.level === 'ERROR' ? 'text-red-500' :
                    log.level === 'WARN' ? 'text-amber-500' : 'text-sky-400'
                  }>{log.message}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-slate-900 border-t border-slate-800">
            <button 
              onClick={toggleConnection}
              className={`w-full py-2 rounded text-[10px] font-black uppercase tracking-widest border transition-all ${
                isSimConnected 
                ? 'bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500/20' 
                : 'bg-sky-500/10 border-sky-500/50 text-sky-500 hover:bg-sky-500/20'
              }`}
            >
              {isSimConnected ? 'Disconnect Sim' : 'Initialize SimConnect'}
            </button>
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
          {loading && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
              <div className="w-12 h-1 text-sky-500 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 animate-[loading_1.5s_infinite_linear]" style={{width: '30%'}}></div>
              </div>
              <p className="mt-4 text-[10px] font-mono text-sky-500 uppercase tracking-[0.3em]">Synching Data</p>
            </div>
          )}

          {activeTab === NavigationTab.DASHBOARD && (
            <div className="space-y-6">
              {/* Flight Progress Bar */}
              {isSimConnected && (
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                   <div className="flex justify-between items-center mb-2 text-[10px] font-bold uppercase tracking-widest">
                     <div className="flex items-center gap-2">
                       <span className="text-sky-400">Current Phase:</span>
                       <span className={isWeatherLocked ? "text-amber-500" : "text-green-500"}>{flightPhase}</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="text-slate-500">Distance to Dest:</span>
                        <span className="text-white font-mono">{distanceToDest} NM</span>
                     </div>
                   </div>
                   <div className="h-1 bg-slate-800 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-sky-500 h-full transition-all duration-500" 
                        style={{ width: `${100 - (distanceToDest / 1.2)}%` }}
                      ></div>
                   </div>
                   <div className="mt-2 flex justify-between text-[9px] font-mono text-slate-600">
                      <span>{flightPlan.departure}</span>
                      <div className="flex gap-4">
                        <span className={distanceToDest <= 40 ? "text-amber-500 font-bold" : ""}>APPROACH LOCK POINT (40NM)</span>
                      </div>
                      <span>{flightPlan.arrival}</span>
                   </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                   <div className="flex justify-between items-end bg-slate-900 p-4 border border-slate-800 rounded-lg">
                      <div>
                        <h2 className="text-lg font-bold text-white uppercase tracking-tight">Active Station Data</h2>
                        <p className="text-slate-500 text-[11px]">Real-time injection into aircraft position.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                          <label className="text-[9px] font-bold text-slate-600 uppercase mb-1">Station Sync</label>
                          <button 
                            onClick={() => setIsAutoSyncEnabled(!isAutoSyncEnabled)}
                            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase transition-all ${
                              isAutoSyncEnabled ? 'bg-green-500 text-black' : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {isAutoSyncEnabled ? 'Auto-Sync ON' : 'Manual Mode'}
                          </button>
                        </div>
                        <input 
                          type="text" 
                          value={stationQuery}
                          onChange={(e) => setStationQuery(e.target.value.toUpperCase())}
                          className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-sm w-24 outline-none focus:border-sky-500"
                        />
                        <button 
                          onClick={() => handleSearchStation(stationQuery)}
                          className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-1.5 rounded text-[11px] font-bold uppercase"
                        >
                          Fetch
                        </button>
                      </div>
                   </div>

                   {currentMetar && <MetarDisplay data={currentMetar} />}

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Injection Parameters</h4>
                        <div className="space-y-3">
                           <div className="flex justify-between text-xs">
                             <span className="text-slate-500">Surface Temp</span>
                             <span className="text-sky-400 font-mono">{currentMetar?.temperature}°C</span>
                           </div>
                           <div className="flex justify-between text-xs">
                             <span className="text-slate-500">Altimeter (QNH)</span>
                             <span className="text-sky-400 font-mono">{currentMetar?.altimeter}</span>
                           </div>
                           <div className="flex justify-between text-xs">
                             <span className="text-slate-500">Cloud Layers</span>
                             <span className="text-sky-400 font-mono">{currentMetar?.clouds.length} Active</span>
                           </div>
                        </div>
                        <button 
                          onClick={injectToSim}
                          className={`w-full mt-6 py-3 rounded text-xs font-black uppercase tracking-widest transition-all ${
                            isSimConnected ? 'bg-sky-600 hover:bg-sky-500 shadow-lg shadow-sky-900/20' : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          Push to Simulator
                        </button>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Approach Safety</h4>
                        <div className={`p-4 rounded border transition-all ${
                          isWeatherLocked ? 'bg-amber-500/5 border-amber-500/40 text-amber-200' : 'bg-slate-950 border-slate-800 text-slate-500'
                        }`}>
                          <p className="text-[10px] font-bold uppercase mb-2">
                             Status: {isWeatherLocked ? 'LOCKED' : 'MONITORING'}
                          </p>
                          <p className="text-[10px] leading-relaxed">
                            {isWeatherLocked 
                              ? `Approach detected. Weather updates for ${flightPlan.arrival} have been frozen to ensure stable localizer/glideslope interception.` 
                              : `System is monitoring distance to ${flightPlan.arrival}. Approach lock will trigger at 40NM.`}
                          </p>
                        </div>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Radar Telemetry</h4>
                  {currentMetar && <RadarView metar={currentMetar} />}
                </div>
              </div>
            </div>
          )}

          {activeTab === NavigationTab.PLANNER && (
            <div className="space-y-8">
               <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Flight Planner</h2>
               <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="text-sky-400 text-[11px] font-black uppercase tracking-[0.3em] border-b border-slate-800 pb-2">Route Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Departure ICAO</label>
                        <input className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2 font-mono text-sm" value={flightPlan.departure} onChange={e => setFlightPlan({...flightPlan, departure: e.target.value.toUpperCase()})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Arrival ICAO</label>
                        <input className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2 font-mono text-sm" value={flightPlan.arrival} onChange={e => setFlightPlan({...flightPlan, arrival: e.target.value.toUpperCase()})} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h3 className="text-sky-400 text-[11px] font-black uppercase tracking-[0.3em] border-b border-slate-800 pb-2">Aircraft Configuration</h3>
                    <select className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2 text-sm" value={flightPlan.aircraft} onChange={e => setFlightPlan({...flightPlan, aircraft: e.target.value})}>
                      {FSX_AIRCRAFT.map(a => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                     <button onClick={handleBriefing} className="w-full py-4 bg-sky-600 hover:bg-sky-500 text-white font-black uppercase tracking-[0.2em] rounded">Generate Ops Briefing</button>
                  </div>
               </div>
            </div>
          )}

          {activeTab === NavigationTab.BRIEFING && (
            <div className="space-y-6">
               <div className="bg-slate-900 border border-slate-800 rounded p-8">
                  {briefing ? (
                    <div className="font-mono text-[11px] leading-relaxed space-y-4">
                      {briefing.split('\n').map((l, i) => <p key={i}>{l}</p>)}
                    </div>
                  ) : <p className="text-slate-500 italic text-center py-20">Plan a flight to generate briefing.</p>}
               </div>
            </div>
          )}

          {activeTab === NavigationTab.SCENARIOS && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {SCENARIOS.map(s => (
                  <div key={s.id} className="bg-slate-900 border border-slate-800 rounded overflow-hidden">
                    <img src={s.imageUrl} className="w-full h-32 object-cover opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all" />
                    <div className="p-6">
                       <h3 className="font-bold text-white mb-2">{s.title}</h3>
                       <p className="text-xs text-slate-500 mb-4">{s.description}</p>
                       {/* Fix: Simplified scenario loading to use the new loadScenario function */}
                       <button onClick={() => loadScenario(s)} className="w-full py-2 bg-slate-800 hover:bg-sky-600 text-white text-[10px] font-bold uppercase rounded">Load Parameters</button>
                    </div>
                  </div>
                ))}
             </div>
          )}

          {activeTab === NavigationTab.XGAUGE && <XGaugeConfig />}
          
          {activeTab === NavigationTab.SETTINGS && (
            <div className="bg-slate-900 border border-slate-800 p-8 rounded space-y-6">
               <h3 className="text-sky-400 font-bold uppercase text-xs">Bridge Settings</h3>
               <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-slate-950 rounded border border-slate-800">
                    <span className="text-xs">Dynamic Station Handoff</span>
                    <div className="w-10 h-5 bg-sky-600 rounded-full flex items-center px-1"><div className="w-3 h-3 bg-white rounded-full ml-auto" /></div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-950 rounded border border-slate-800">
                    <span className="text-xs">Approach Lock (40NM Buffer)</span>
                    <div className="w-10 h-5 bg-sky-600 rounded-full flex items-center px-1"><div className="w-3 h-3 bg-white rounded-full ml-auto" /></div>
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
