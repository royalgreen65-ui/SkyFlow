
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MetarData } from '../types';

interface RadarViewProps {
  metar: MetarData;
}

export const RadarView: React.FC<RadarViewProps> = ({ metar }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

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
    const echoCount = metar.clouds.length * 10 + 5;
    const echoes = d3.range(echoCount).map(() => ({
      x: (Math.random() - 0.5) * 300,
      y: (Math.random() - 0.5) * 300,
      r: Math.random() * 20 + 5,
      opacity: Math.random() * 0.5 + 0.1
    }));

    g.selectAll(".echo")
      .data(echoes)
      .enter()
      .append("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", d => d.r)
      .attr("fill", "#22c55e")
      .attr("filter", "blur(8px)")
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

    const animate = () => {
      sweep.transition()
        .duration(4000)
        .ease(d3.easeLinear)
        .attrTween("transform", () => {
          return (t) => `rotate(${t * 360})`;
        })
        .on("end", animate);
    };
    animate();

  }, [metar]);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden relative">
      <div className="absolute top-4 left-4 text-xs font-mono text-green-500 uppercase tracking-widest z-10">
        Radar Sweep: Active
      </div>
      <svg ref={svgRef} width="400" height="400" className="max-w-full h-auto" />
      <div className="mt-4 grid grid-cols-2 gap-4 w-full text-[10px] font-mono text-slate-500">
        <div>RANGE: 40NM</div>
        <div className="text-right">TILT: +1.5°</div>
      </div>
    </div>
  );
};
