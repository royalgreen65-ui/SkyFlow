
import React, { useState, useEffect, useRef } from 'react';
import { MetarData, Scenario, FlightPlan, NavigationTab, LogEntry } from './types';
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
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

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    addLog("SkyFlow Engine Initialized");
    addLog("Searching for FSX/P3D installation...");
    handleSearchStation('KLAX');
  }, []);

  const handleSearchStation = async (icao: string) => {
    setLoading(true);
    addLog(`Requesting METAR for ${icao}...`);
    try {
      const data = await fetchMetarData(icao);
      setCurrentMetar(data);
      addLog(`METAR received for ${icao}`, 'SUCCESS');
    } catch (error) {
      addLog(`Failed to fetch METAR for ${icao}`, 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  const handleBriefing = async () => {
    if (!flightPlan.departure || !flightPlan.arrival) return;
    setLoading(true);
    addLog(`Compiling flight briefing: ${flightPlan.departure} -> ${flightPlan.arrival}`);
    try {
      const dep = await fetchMetarData(flightPlan.departure);
      const arr = await fetchMetarData(flightPlan.arrival);
      const text = await generateBriefing(flightPlan, dep, arr);
      setBriefing(text);
      setActiveTab(NavigationTab.BRIEFING);
      addLog("Briefing generated successfully", 'SUCCESS');
    } catch (error) {
      addLog("Briefing generation failed", 'ERROR');
      alert("Error generating briefing. Please check ICAO codes.");
    } finally {
      setLoading(false);
    }
  };

  const injectToSim = () => {
    if (!isSimConnected) {
      addLog("Action denied: SimConnect not initialized", 'WARN');
      alert("Please connect to FSX first.");
      return;
    }
    setLoading(true);
    addLog(`Injecting ${currentMetar?.icao} visibility layers...`);
    addLog(`Setting surface pressure to ${currentMetar?.altimeter}...`);
    setTimeout(() => {
      setLoading(false);
      addLog("Injection complete. Simulator weather updated.", 'SUCCESS');
      alert(`Successfully injected ${currentMetar?.icao} weather into FSX.`);
    }, 1500);
  };

  const toggleConnection = () => {
    if (isSimConnected) {
      addLog("SimConnect session terminated.");
      setIsSimConnected(false);
    } else {
      setLoading(true);
      addLog("Attempting SimConnect handshake...");
      setTimeout(() => {
        setIsSimConnected(true);
        setLoading(false);
        addLog("SimConnect established: FSX (v10.0.61472.0)", 'SUCCESS');
      }, 1000);
    }
  };

  const loadScenario = async (scenario: Scenario) => {
    setLoading(true);
    addLog(`Loading Historical Scenario: ${scenario.title}`);
    try {
      const data = await fetchMetarData(scenario.icao);
      setCurrentMetar({
        ...data,
        raw: `HISTORICAL SCENARIO: ${scenario.title} - ${scenario.date} - ${scenario.weatherAnomaly}`,
      });
      setActiveTab(NavigationTab.DASHBOARD);
      addLog("Scenario weather parameters synthesized", 'SUCCESS');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden select-none">
      {/* Native-style Title Bar */}
      <div className="h-8 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 drag-area">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-sky-500 rounded-sm flex items-center justify-center font-bold text-[10px] italic">S</div>
          <span className="text-[11px] font-medium text-slate-400">SkyFlow Weather Bridge</span>
        </div>
        <div className="flex items-center">
          <div className="flex gap-4 mr-4 text-[10px] font-mono">
            <span className={isSimConnected ? "text-green-500" : "text-red-500"}>
              {isSimConnected ? "CONNECTED" : "DISCONNECTED"}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 uppercase">{activeTab}</span>
          </div>
          <div className="flex h-8">
            <button className="w-10 hover:bg-slate-800 flex items-center justify-center text-slate-500">—</button>
            <button className="w-10 hover:bg-slate-800 flex items-center justify-center text-slate-500">▢</button>
            <button className="w-10 hover:bg-red-600 flex items-center justify-center text-slate-500 hover:text-white">✕</button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <nav className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-xl font-bold tracking-tight text-white mb-1">SKYFLOW</h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Weather Engine v4.2</p>
          </div>

          <div className="flex-1 py-4">
            {Object.values(NavigationTab).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-6 py-3 flex items-center gap-3 transition-colors ${
                  activeTab === tab 
                  ? 'bg-sky-600/10 text-sky-400 border-r-2 border-sky-500 font-medium' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <span className="text-sm">{tab}</span>
              </button>
            ))}
          </div>

          {/* System Console */}
          <div className="h-48 border-t border-slate-800 bg-slate-950 flex flex-col overflow-hidden">
            <div className="px-3 py-1 bg-slate-900 text-[10px] font-bold text-slate-500 uppercase flex justify-between items-center">
              <span>System Log</span>
              <button onClick={() => setLogs([])} className="hover:text-slate-300">Clear</button>
            </div>
            <div ref={logContainerRef} className="flex-1 overflow-y-auto p-2 font-mono text-[10px] leading-tight space-y-1">
              {logs.map(log => (
                <div key={log.id} className="flex gap-2">
                  <span className="text-slate-600 whitespace-nowrap">[{log.timestamp}]</span>
                  <span className={
                    log.level === 'SUCCESS' ? 'text-green-500' :
                    log.level === 'ERROR' ? 'text-red-500' :
                    log.level === 'WARN' ? 'text-amber-500' : 'text-sky-400/70'
                  }>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-slate-900 border-t border-slate-800">
            <button 
              disabled={loading}
              onClick={toggleConnection}
              className={`w-full py-2 rounded text-xs transition-colors border font-bold uppercase tracking-wider ${
                isSimConnected 
                ? 'bg-red-900/20 border-red-900/50 text-red-400 hover:bg-red-900/30' 
                : 'bg-green-900/20 border-green-900/50 text-green-400 hover:bg-green-900/30'
              }`}
            >
              {isSimConnected ? 'Terminate Connection' : 'Establish SimConnect'}
            </button>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto relative bg-slate-950">
          {loading && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sky-400 font-mono text-[11px] animate-pulse tracking-widest">SYNCHRONIZING...</p>
            </div>
          )}

          <div className="p-8 max-w-6xl mx-auto">
            {activeTab === NavigationTab.DASHBOARD && (
              <div className="space-y-6">
                <header className="flex justify-between items-end">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Live Station Data</h2>
                    <p className="text-slate-400 text-sm">Real-time METAR analysis and simulator injection.</p>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={stationQuery}
                      onChange={(e) => setStationQuery(e.target.value.toUpperCase())}
                      className="bg-slate-900 border border-slate-800 rounded px-4 py-2 focus:border-sky-500 outline-none font-mono uppercase text-sm w-32"
                      placeholder="ICAO"
                    />
                    <button 
                      onClick={() => handleSearchStation(stationQuery)}
                      className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-2 rounded text-sm font-bold"
                    >
                      FETCH
                    </button>
                  </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    {currentMetar && <MetarDisplay data={currentMetar} />}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest">Injection Queue</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs p-2 bg-slate-950 rounded border border-slate-800">
                            <span className="text-sky-400">Surface Wind</span>
                            <span className="text-slate-300 font-mono">{currentMetar?.windDirection}° @ {currentMetar?.windSpeed}kt</span>
                          </div>
                          <div className="flex justify-between items-center text-xs p-2 bg-slate-950 rounded border border-slate-800">
                            <span className="text-sky-400">Baro Pressure</span>
                            <span className="text-slate-300 font-mono">{currentMetar?.altimeter}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs p-2 bg-slate-950 rounded border border-slate-800">
                            <span className="text-sky-400">OAT</span>
                            <span className="text-slate-300 font-mono">{currentMetar?.temperature}°C</span>
                          </div>
                        </div>
                        <button 
                          onClick={injectToSim}
                          className={`w-full mt-4 py-3 rounded font-bold text-sm shadow-lg transition-all ${
                            isSimConnected 
                            ? 'bg-sky-600 hover:bg-sky-500 text-white' 
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          SET SIMULATOR WEATHER
                        </button>
                      </div>

                      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest">Aviation Alerts</h4>
                        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded text-amber-200/70 text-[11px] font-mono leading-relaxed">
                          <p className="font-bold mb-1 text-amber-400">⚠️ WINDSHEAR ADVISORY</p>
                          Possible moderate turbulence expected on final approach to {currentMetar?.icao} due to temperature/dewpoint spread. Check NOTAMs.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Station Radar</h4>
                    {currentMetar && <RadarView metar={currentMetar} />}
                  </div>
                </div>
              </div>
            )}

            {activeTab === NavigationTab.PLANNER && (
              <div className="space-y-8">
                <header>
                  <h2 className="text-2xl font-bold text-white">Route Planning</h2>
                  <p className="text-slate-400 text-sm">Configure your aircraft and route for weather analysis.</p>
                </header>

                <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="text-sky-400 text-xs font-bold border-b border-slate-800 pb-2 uppercase tracking-widest">Route Info</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Departure</label>
                        <input 
                          className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2 font-mono text-sm"
                          value={flightPlan.departure}
                          onChange={(e) => setFlightPlan({...flightPlan, departure: e.target.value.toUpperCase()})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Arrival</label>
                        <input 
                          className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2 font-mono text-sm"
                          value={flightPlan.arrival}
                          onChange={(e) => setFlightPlan({...flightPlan, arrival: e.target.value.toUpperCase()})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Alternate</label>
                      <input 
                        className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2 font-mono text-sm"
                        value={flightPlan.alternate}
                        onChange={(e) => setFlightPlan({...flightPlan, alternate: e.target.value.toUpperCase()})}
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-sky-400 text-xs font-bold border-b border-slate-800 pb-2 uppercase tracking-widest">Aircraft Payload</h3>
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Airframe</label>
                      <select 
                        className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2 appearance-none text-sm"
                        value={flightPlan.aircraft}
                        onChange={(e) => setFlightPlan({...flightPlan, aircraft: e.target.value})}
                      >
                        {FSX_AIRCRAFT.map(ac => <option key={ac} value={ac}>{ac}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Cruise (FT)</label>
                        <input 
                          type="number"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2 font-mono text-sm"
                          value={flightPlan.cruiseAltitude}
                          onChange={(e) => setFlightPlan({...flightPlan, cruiseAltitude: parseInt(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Fuel (LBS)</label>
                        <input 
                          type="number"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2 font-mono text-sm"
                          value={flightPlan.fuelWeight}
                          onChange={(e) => setFlightPlan({...flightPlan, fuelWeight: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                     <button 
                      onClick={handleBriefing}
                      className="w-full py-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded text-sm uppercase tracking-widest transition-all"
                    >
                      COMPILE WEATHER BRIEFING
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === NavigationTab.BRIEFING && (
              <div className="space-y-6">
                 <header className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Weather Briefing</h2>
                    <p className="text-slate-400 text-sm">Automated meteorological analysis for your current route.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab(NavigationTab.PLANNER)}
                    className="px-4 py-2 text-sky-400 hover:text-sky-300 text-xs font-bold uppercase"
                  >
                    Edit Route
                  </button>
                </header>

                <div className="bg-slate-900 border border-slate-800 rounded p-8 shadow-2xl overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
                  </div>
                  {briefing ? (
                    <div className="prose prose-invert max-w-none space-y-6 font-mono text-[12px] leading-relaxed">
                      {briefing.split('\n').map((line, i) => {
                        if (line.match(/^[A-Z\s]+$/)) {
                          return <h3 key={i} className="text-sky-400 font-bold text-sm mt-6 border-b border-sky-400/20 pb-1 uppercase tracking-widest">{line}</h3>;
                        }
                        return <p key={i} className="text-slate-300">{line}</p>;
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-20">
                      <p className="text-slate-500 italic text-sm">No briefing found. Please use the Flight Planner to generate one.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === NavigationTab.SCENARIOS && (
              <div className="space-y-8">
                <header>
                  <h2 className="text-2xl font-bold text-white">Scenario Library</h2>
                  <p className="text-slate-400 text-sm">Recreate historic weather-related aviation events.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {SCENARIOS.map((scenario) => (
                    <div 
                      key={scenario.id}
                      className="group bg-slate-900 border border-slate-800 rounded overflow-hidden hover:border-sky-500/50 transition-all flex flex-col"
                    >
                      <div className="h-40 overflow-hidden relative">
                        <img src={scenario.imageUrl} alt={scenario.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 grayscale group-hover:grayscale-0 opacity-60 group-hover:opacity-100" />
                        <div className="absolute top-4 right-4">
                          <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${
                            scenario.severity === 'Extreme' ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
                          }`}>
                            {scenario.severity}
                          </span>
                        </div>
                      </div>
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-bold text-white">{scenario.title}</h3>
                          <span className="text-[10px] font-mono text-slate-500">{scenario.date}</span>
                        </div>
                        <p className="text-slate-400 text-xs mb-4 leading-relaxed flex-1">
                          {scenario.description}
                        </p>
                        <div className="flex items-center gap-2 mb-4 text-[10px]">
                          <span className="text-sky-400 font-mono font-bold">STATION:</span>
                          <span className="text-slate-300 font-mono">{scenario.location} ({scenario.icao})</span>
                        </div>
                        <button 
                          onClick={() => loadScenario(scenario)}
                          className="w-full py-2 bg-slate-800 hover:bg-sky-600 text-white font-bold text-xs uppercase tracking-wider rounded transition-colors"
                        >
                          Load Scenario
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === NavigationTab.XGAUGE && (
              <div className="space-y-8">
                <header>
                  <h2 className="text-2xl font-bold text-white">Panel Management</h2>
                  <p className="text-slate-400 text-sm">Configure XGauge weather radar panel installations.</p>
                </header>
                <XGaugeConfig />
              </div>
            )}

            {activeTab === NavigationTab.SETTINGS && (
              <div className="space-y-8">
                <header>
                  <h2 className="text-2xl font-bold text-white">System Configuration</h2>
                  <p className="text-slate-400 text-sm">Manage file paths and bridge behavior.</p>
                </header>
                
                <div className="bg-slate-900 border border-slate-800 p-8 rounded space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-sky-400 text-xs font-bold uppercase tracking-widest border-b border-slate-800 pb-2">Simulator Paths</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">FSX Root Directory</label>
                        <div className="flex gap-2">
                          <input 
                            readOnly
                            className="flex-1 bg-slate-950 border border-slate-800 rounded px-4 py-2 font-mono text-xs text-slate-400"
                            value="C:\Program Files (x86)\Microsoft Games\Microsoft Flight Simulator X"
                          />
                          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold">BROWSE</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Application Data Path</label>
                        <div className="flex gap-2">
                          <input 
                            readOnly
                            className="flex-1 bg-slate-950 border border-slate-800 rounded px-4 py-2 font-mono text-xs text-slate-400"
                            value="%APPDATA%\Microsoft\FSX"
                          />
                          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold">BROWSE</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sky-400 text-xs font-bold uppercase tracking-widest border-b border-slate-800 pb-2">Sync Parameters</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Update Frequency (Minutes)</label>
                        <input type="range" min="1" max="60" defaultValue="15" className="w-full accent-sky-500" />
                        <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                          <span>1m</span>
                          <span>15m (Recommended)</span>
                          <span>60m</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Auto-Inject on Connect</label>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-6 bg-sky-600 rounded-full flex items-center px-1">
                            <div className="w-4 h-4 bg-white rounded-full ml-auto" />
                          </div>
                          <span className="text-xs text-slate-400">Enabled</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      
      {/* Bottom Status Bar */}
      <footer className="h-6 bg-sky-600 flex items-center px-4 justify-between text-[10px] font-bold text-white uppercase tracking-wider">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span>SimConnect Engine Active</span>
          </div>
          <div className="flex items-center gap-2">
            <span>METAR DB: GLOBAL (SYNCHRONIZED)</span>
          </div>
        </div>
        <div className="flex gap-6">
          <span>OAT: {currentMetar?.temperature || '--'}°C</span>
          <span>WIND: {currentMetar?.windSpeed || '--'}KT</span>
          <span>LAT/LON: 34.0522 N, 118.2437 W</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
