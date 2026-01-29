import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import * as d3 from 'd3';
import { MetarData, NavigationTab, LogEntry } from './types';
import { SCENARIOS, FSX_AIRCRAFT } from './constants';

// --- Services (Inline for reliability) ---
const fetchMetarData = async (icao: string): Promise<MetarData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a hyper-realistic aviation METAR for ${icao}. Include temperature, wind, and complex cloud layers. Return as JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          icao: { type: Type.STRING },
          raw: { type: Type.STRING },
          timestamp: { type: Type.STRING },
          temperature: { type: Type.NUMBER },
          dewpoint: { type: Type.NUMBER },
          windDirection: { type: Type.NUMBER },
          windSpeed: { type: Type.NUMBER },
          visibility: { type: Type.STRING },
          altimeter: { type: Type.STRING },
          clouds: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                cover: { type: Type.STRING },
                altitude: { type: Type.NUMBER }
              }
            }
          }
        },
        required: ["icao", "raw", "temperature", "windSpeed", "clouds"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("COMM_LINK_FAILURE: No data returned from atmospheric core.");
  return JSON.parse(text.trim());
};

// --- Components (Inline for reliability) ---
const MetarDisplay: React.FC<{ data: MetarData }> = ({ data }) => (
  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 font-mono text-sm shadow-xl">
    <div className="flex justify-between items-center mb-4 border-b border-slate-700/50 pb-3">
      <span className="text-sky-400 font-black text-xl italic">{data.icao}</span>
      <span className="text-slate-500 text-[10px] font-bold uppercase">{data.timestamp || 'REAL-TIME'}</span>
    </div>
    <div className="text-sky-100 mb-6 bg-black/40 p-4 rounded-xl border border-slate-700/30 break-all leading-relaxed">
      {data.raw}
    </div>
    <div className="grid grid-cols-2 gap-6">
      <div className="flex flex-col">
        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Wind</span>
        <span className="text-slate-200 font-bold">{data.windDirection}° @ {data.windSpeed}KT</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Visibility</span>
        <span className="text-slate-200 font-bold">{data.visibility}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Temp / Dew</span>
        <span className="text-slate-200 font-bold">{data.temperature}°C / {data.dewpoint}°C</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Altimeter</span>
        <span className="text-slate-200 font-bold">{data.altimeter}</span>
      </div>
    </div>
    <div className="mt-6 pt-4 border-t border-slate-700/30">
      <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2 block">Atmospheric Layers</span>
      <div className="flex flex-wrap gap-2 mt-1">
        {data.clouds.map((c, i) => (
          <span key={i} className="bg-sky-500/10 px-3 py-1.5 rounded-lg text-[10px] font-black text-sky-400 border border-sky-500/20 uppercase">
            {c.cover} @ {c.altitude} FT
          </span>
        ))}
      </div>
    </div>
  </div>
);

const RadarView: React.FC<{ metar: MetarData }> = ({ metar }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const width = 400;
    const height = 400;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${width / 2}, ${height / 2})`);

    const rings = [50, 100, 150];
    g.selectAll(".ring")
      .data(rings)
      .enter()
      .append("circle")
      .attr("r", d => d)
      .attr("fill", "none")
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 1);

    g.append("line").attr("x1", -200).attr("x2", 200).attr("y1", 0).attr("y2", 0).attr("stroke", "#1e293b");
    g.append("line").attr("x1", 0).attr("x2", 0).attr("y1", -200).attr("y2", 200).attr("stroke", "#1e293b");

    const echoCount = (metar.clouds?.length || 0) * 8 + 6;
    const echoes = d3.range(echoCount).map(() => ({
      x: (Math.random() - 0.5) * 280,
      y: (Math.random() - 0.5) * 280,
      r: Math.random() * 25 + 10,
      opacity: Math.random() * 0.4 + 0.1
    }));

    g.selectAll(".echo")
      .data(echoes)
      .enter()
      .append("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", d => d.r)
      .attr("fill", "#22c55e")
      .attr("filter", "blur(10px)")
      .attr("opacity", d => d.opacity);

    const sweep = g.append("line")
      .attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", -200)
      .attr("stroke", "#22c55e").attr("stroke-width", 2).attr("opacity", 0.6);

    let animationFrame: number;
    const animate = (elapsed: number) => {
      sweep.attr("transform", `rotate(${(elapsed / 4000) * 360})`);
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [metar]);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-900/80 border border-slate-800 rounded-[32px] overflow-hidden relative shadow-inner h-full">
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
        <span className="text-[10px] font-mono text-green-500 uppercase tracking-[0.2em] font-black">RADAR_SWEEP_ACTIVE</span>
      </div>
      <svg ref={svgRef} viewBox="0 0 400 400" className="w-full h-auto max-w-[320px]" />
      <div className="mt-6 grid grid-cols-2 gap-8 w-full text-[10px] font-mono text-slate-500 font-bold uppercase tracking-widest">
        <div>RANGE: 40NM</div>
        <div className="text-right">TILT: +1.5°</div>
      </div>
    </div>
  );
};

// --- App Root ---
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>(NavigationTab.DASHBOARD);
  const [loading, setLoading] = useState(false);
  const [currentMetar, setCurrentMetar] = useState<MetarData | null>(null);
  const [stationQuery, setStationQuery] = useState('KLAX');
  const [isSimConnected, setIsSimConnected] = useState(false);
  const [isBridgeActive, setIsBridgeActive] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);

  const addLog = (message: string, level: LogEntry['level'] = 'INFO') => {
    if ((window as any).addLog) (window as any).addLog(message, level);
  };

  useEffect(() => {
    addLog("Initializing Atmospheric Core...", "INFO");
    let reconnectTimer: any;
    const connectBridge = () => {
      try {
        const ws = new WebSocket('ws://localhost:8080');
        ws.onopen = () => {
          setIsBridgeActive(true);
          addLog("LINK: Local Bridge Handshake Successful.", "SUCCESS");
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'STATUS') {
              setIsSimConnected(data.connected);
              if (data.connected) addLog("SIM: FSX/P3D engine heartbeat detected.", "SUCCESS");
            }
          } catch (e) {}
        };
        ws.onclose = () => {
          setIsBridgeActive(false);
          setIsSimConnected(false);
          reconnectTimer = setTimeout(connectBridge, 10000);
        };
        ws.onerror = () => ws.close();
        wsRef.current = ws;
      } catch (err) {
        reconnectTimer = setTimeout(connectBridge, 10000);
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
    addLog(`AI: Querying atmospheric model for ${icao}...`, 'INFO');
    try {
      const data = await fetchMetarData(icao);
      setCurrentMetar(data);
      if (isBridgeActive && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'INJECT_WEATHER', icao: data.icao, raw: data.raw }));
        addLog(`SYNC: METAR pushed to simulator bridge.`, "SUCCESS");
      } else {
        addLog(`PREVIEW: Data generated. Connect bridge to inject.`, "WARN");
      }
    } catch (error: any) {
      addLog(`AI_FAULT: ${error.message}`, 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#05070a] text-slate-100 font-sans overflow-hidden">
      <header className="h-16 bg-slate-900/40 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-sky-600 rounded-xl flex items-center justify-center text-xl font-black italic shadow-lg shadow-sky-500/20">S</div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tighter leading-none">SkyFlow</h1>
            <p className="text-[7px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Avionics Professional</p>
          </div>
        </div>
        <div className="flex gap-4">
          <HeaderBadge active={isBridgeActive} label="Bridge" />
          <HeaderBadge active={isSimConnected} label="Sim Link" color="green" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden pb-[120px]">
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
          {!isBridgeActive && (
              <div className="mt-8 p-4 bg-orange-950/20 border border-orange-900/30 rounded-2xl">
                  <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest mb-2">Bridge Required</p>
                  <p className="text-[7px] text-orange-200/50 uppercase font-bold leading-relaxed">
                    Start 'bridge.js' on your flight simulator PC.
                  </p>
              </div>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto p-12">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="bg-slate-900/60 p-10 rounded-[40px] border border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl backdrop-blur-md">
              <div className="text-center md:text-left">
                <h2 className="text-4xl font-black uppercase tracking-tighter text-white italic leading-tight">Atmospheric<br/>Injection Core</h2>
                <p className="text-slate-500 text-[10px] font-bold tracking-[0.3em] mt-2 uppercase">Direct SimConnect Uplink</p>
              </div>
              <div className="flex gap-4 p-2 bg-black/40 rounded-3xl border border-slate-800/50">
                <input 
                  type="text" 
                  maxLength={4} 
                  value={stationQuery} 
                  onChange={e => setStationQuery(e.target.value.toUpperCase())} 
                  className="w-24 bg-transparent p-4 text-3xl font-black text-center text-sky-400 outline-none uppercase italic" 
                  placeholder="ICAO"
                />
                <button 
                  onClick={() => handleInject()} 
                  disabled={loading} 
                  className={`px-10 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${loading ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-xl shadow-sky-900/40 active:scale-95'}`}
                >
                  {loading ? 'UPLOADING...' : 'SYNC WEATHER'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700 ml-4 flex items-center gap-2">
                   <span className="w-1 h-1 bg-sky-500 rounded-full"></span> Telemetry Display
                </label>
                {currentMetar ? <MetarDisplay data={currentMetar} /> : (
                  <div className="h-full min-h-[300px] border-2 border-dashed border-slate-800/50 rounded-[32px] flex flex-col items-center justify-center text-slate-800 p-8 text-center bg-slate-900/10">
                    <div className="w-12 h-12 border-2 border-slate-800 rounded-full mb-4 opacity-50"></div>
                    <span className="font-black uppercase tracking-[0.2em] text-[10px]">System Standby</span>
                    <p className="text-[9px] text-slate-700 mt-2 uppercase font-bold">Awaiting station telemetry synchronization</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700 ml-4 flex items-center gap-2">
                   <span className="w-1 h-1 bg-green-500 rounded-full"></span> Tactical Radar
                </label>
                <div className="h-full min-h-[400px]">
                  {currentMetar ? <RadarView metar={currentMetar} /> : (
                    <div className="h-full border-2 border-dashed border-slate-800/50 rounded-[32px] flex flex-col items-center justify-center text-slate-800 p-8 text-center bg-slate-900/10">
                      <div className="w-20 h-20 border-2 border-slate-800 rounded-full mb-4 opacity-50 flex items-center justify-center">
                        <div className="w-1 h-10 bg-slate-800 origin-bottom"></div>
                      </div>
                      <span className="font-black uppercase tracking-[0.2em] text-[10px]">Radar Offline</span>
                      <p className="text-[9px] text-slate-700 mt-2 uppercase font-bold">Initialize uplink to activate weather sweep</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const HeaderBadge = ({ active, label, color = "sky" }: any) => {
  const colorClass = active 
    ? color === "green" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-sky-500/10 border-sky-500/30 text-sky-400"
    : "bg-slate-800/50 border-slate-700 text-slate-600";
    
  const dotClass = active 
    ? color === "green" ? "bg-green-400 animate-pulse" : "bg-sky-400 animate-pulse"
    : "bg-slate-700";

  return (
    <div className={`px-5 py-2 rounded-2xl border flex items-center gap-3 transition-all ${colorClass}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </div>
  );
};

// --- Bootstrapper ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
  
  // Fade out splash if it exists
  const splash = document.getElementById('boot-splash');
  if (splash) {
    setTimeout(() => splash.classList.add('fade-out'), 800);
  }
}
