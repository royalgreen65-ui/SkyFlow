import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MetarData } from '../types';

interface RadarViewProps {
  metar: MetarData;
}

export const RadarView: React.FC<RadarViewProps> = ({ metar }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = 400;
    const height = 400;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Draw grid rings
    const rings = [50, 100, 150];
    g.selectAll(".ring")
      .data(rings)
      .enter()
      .append("circle")
      .attr("r", d => d)
      .attr("fill", "none")
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 1);

    // Draw crosshair
    g.append("line").attr("x1", -200).attr("x2", 200).attr("y1", 0).attr("y2", 0).attr("stroke", "#1e293b");
    g.append("line").attr("x1", 0).attr("x2", 0).attr("y1", -200).attr("y2", 200).attr("stroke", "#1e293b");

    // Simulate weather echoes based on clouds
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

    // Radar sweep animation
    const sweep = g.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", -200)
      .attr("stroke", "#22c55e")
      .attr("stroke-width", 2)
      .attr("opacity", 0.6);

    let animationFrame: number;
    const animate = (elapsed: number) => {
      const rotation = (elapsed / 4000) * 360;
      sweep.attr("transform", `rotate(${rotation})`);
      animationFrame = requestAnimationFrame(animate);
    };
    
    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [metar]);

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center p-6 bg-slate-900/80 border border-slate-800 rounded-[32px] overflow-hidden relative shadow-inner">
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
        <span className="text-[10px] font-mono text-green-500 uppercase tracking-[0.2em] font-black">
          RADAR_SWEEP_ACTIVE
        </span>
      </div>
      <svg ref={svgRef} viewBox="0 0 400 400" className="w-full h-auto max-w-[320px]" />
      <div className="mt-6 grid grid-cols-2 gap-8 w-full text-[10px] font-mono text-slate-500 font-bold uppercase tracking-widest">
        <div>RANGE: 40NM</div>
        <div className="text-right">TILT: +1.5°</div>
      </div>
    </div>
  );
};