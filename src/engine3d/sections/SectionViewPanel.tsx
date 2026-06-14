// SectionViewPanel: vista 2D vertical (u,v) de un corte geológico.
// SVG nativo con grilla, escala, terreno, isosuperficie, sondajes (+labels),
// muestras y leyenda. Soporta export PNG/CSV.
import { useMemo, useRef } from "react";
import { Download, FileSpreadsheet, X, Loader2, Image as ImageIcon } from "lucide-react";
import type { SectionResult } from "@/engine3d/sections/sectionEngine";
import { Button } from "@/components/ui/button";
import { exportSectionCSV, exportSectionPNG } from "@/engine3d/export/sectionExport";

type Props = {
  result: SectionResult | null;
  busy: boolean;
  onClose: () => void;
  onFollowHole?: (holeId: string) => void;
  followHoleId?: string | null;
  height?: number;
};

const SVG_W = 760;
const SVG_H = 420;
const PAD = { l: 56, r: 16, t: 36, b: 40 };

function niceStep(range: number, target = 6): number {
  if (range <= 0) return 1;
  const raw = range / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const nice = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  return nice * pow;
}

export function SectionViewPanel({
  result,
  busy,
  onClose,
  onFollowHole,
  followHoleId,
  height = 460,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const layout = useMemo(() => {
    if (!result) return null;
    const { uMin, uMax, vMin, vMax } = result.bounds;
    const padU = Math.max(20, (uMax - uMin) * 0.05);
    const padV = Math.max(20, (vMax - vMin) * 0.1);
    const u0 = uMin - padU,
      u1 = uMax + padU;
    const v0 = vMin - padV,
      v1 = vMax + padV;
    const innerW = SVG_W - PAD.l - PAD.r;
    const innerH = SVG_H - PAD.t - PAD.b;
    const sx = innerW / Math.max(1e-3, u1 - u0);
    const sy = innerH / Math.max(1e-3, v1 - v0);
    const s = Math.min(sx, sy); // mantener aspecto 1:1
    const x0 = PAD.l + (innerW - s * (u1 - u0)) / 2;
    const y1 = PAD.t + (innerH - s * (v1 - v0)) / 2;
    const toX = (u: number) => x0 + (u - u0) * s;
    const toY = (v: number) => y1 + (v1 - v) * s;
    return { u0, u1, v0, v1, s, toX, toY, innerW, innerH };
  }, [result]);

  const handlePNG = async () => {
    if (!svgRef.current) return;
    await exportSectionPNG(svgRef.current, "section.png");
  };

  const handleCSV = () => {
    if (result) exportSectionCSV(result, "section.csv");
  };

  return (
    <div
      className="absolute right-2 bottom-2 z-20 bg-black/90 backdrop-blur border border-cyan-700/60 rounded-md shadow-2xl flex flex-col"
      style={{ width: SVG_W + 24, height }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-cyan-800/50">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-cyan-300">
          <span>Section View</span>
          {result && (
            <span className="text-muted-foreground normal-case tracking-normal">
              · {result.frame.kind === "vertical" ? "vertical" : "plan"} · ±
              {(result.width / 2).toFixed(0)} m · {result.stats.holesIntersected} sondajes ·{" "}
              {result.stats.samplesInSlab} muestras · {result.stats.elapsedMs.toFixed(0)} ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            onClick={handlePNG}
            disabled={!result}
          >
            <ImageIcon className="w-3 h-3 mr-1" /> PNG
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            onClick={handleCSV}
            disabled={!result}
          >
            <FileSpreadsheet className="w-3 h-3 mr-1" /> CSV
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 text-cyan-300 text-[11px] font-mono">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> calculando sección…
          </div>
        )}
        {!result || !layout ? (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-mono text-muted-foreground">
            <Download className="w-3 h-3 mr-2" /> presiona “Generate Section”
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            width="100%"
            height="100%"
            style={{ background: "#08090c" }}
          >
            {/* Grid + axes */}
            <SectionGrid layout={layout} kind={result.frame.kind} />

            {/* Terrain profile */}
            {result.terrainProfile.map((s, i) => (
              <line
                key={`t-${i}`}
                x1={layout.toX(s.a.u)}
                y1={layout.toY(s.a.v)}
                x2={layout.toX(s.b.u)}
                y2={layout.toY(s.b.v)}
                stroke="#94a374"
                strokeWidth={1.2}
                strokeLinecap="round"
              />
            ))}

            {/* Anomaly isosurface intersection */}
            {result.anomalySegments.map((s, i) => (
              <line
                key={`a-${i}`}
                x1={layout.toX(s.a.u)}
                y1={layout.toY(s.a.v)}
                x2={layout.toX(s.b.u)}
                y2={layout.toY(s.b.v)}
                stroke="#ff8a3d"
                strokeWidth={1.4}
                strokeLinecap="round"
                opacity={0.85}
              />
            ))}

            {/* Samples in slab */}
            {result.samples.map((p, i) => (
              <circle
                key={`s-${i}`}
                cx={layout.toX(p.u)}
                cy={layout.toY(p.v)}
                r={2.4}
                fill={p.kind === "geophysics" ? "#facc15" : "#22d3ee"}
                opacity={0.7}
              />
            ))}

            {/* Drillholes */}
            {result.drillholes.map((h) => {
              const c = { x: layout.toX(h.collar2D.u), y: layout.toY(h.collar2D.v) };
              const t = { x: layout.toX(h.toe2D.u), y: layout.toY(h.toe2D.v) };
              const color = h.isAi
                ? "#67e8f9"
                : (h.status ?? "").toLowerCase().includes("complet")
                  ? "#fbbf24"
                  : (h.status ?? "").toLowerCase().includes("plan")
                    ? "#9ca3af"
                    : "#fb923c";
              const focused = followHoleId && h.holeId === followHoleId;
              const handleClick = () => onFollowHole?.(h.holeId);
              const ipt = h.intersect
                ? { x: layout.toX(h.intersect.u), y: layout.toY(h.intersect.v) }
                : null;
              return (
                <g key={`h-${h.holeId}`} style={{ cursor: "pointer" }} onClick={handleClick}>
                  <line
                    x1={c.x}
                    y1={c.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={color}
                    strokeWidth={focused ? 2.8 : 1.6}
                    strokeLinecap="round"
                    opacity={focused ? 1 : 0.92}
                  />
                  <circle cx={c.x} cy={c.y} r={2.5} fill={color} />
                  {ipt && (
                    <circle
                      cx={ipt.x}
                      cy={ipt.y}
                      r={4}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.4}
                    />
                  )}
                  {(ipt || focused) && (
                    <g transform={`translate(${(ipt?.x ?? c.x) + 6}, ${(ipt?.y ?? c.y) - 6})`}>
                      <rect
                        x={0}
                        y={-10}
                        width={Math.max(60, h.holeId.length * 6 + 8)}
                        height={26}
                        rx={3}
                        ry={3}
                        fill="rgba(8,9,12,0.85)"
                        stroke={color}
                        strokeWidth={0.5}
                      />
                      <text x={4} y={2} fontFamily="monospace" fontSize="9" fill={color}>
                        {h.holeId}
                      </text>
                      <text x={4} y={12} fontFamily="monospace" fontSize="8" fill="#cbd5e1">
                        {h.depth.toFixed(0)}m · {h.status ?? "—"}
                        {h.isAi ? " · AI" : ""}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Plane center marker */}
            <line
              x1={layout.toX(0)}
              y1={PAD.t}
              x2={layout.toX(0)}
              y2={SVG_H - PAD.b}
              stroke="#475569"
              strokeWidth={0.5}
              strokeDasharray="3 3"
            />
            <line
              x1={PAD.l}
              y1={layout.toY(0)}
              x2={SVG_W - PAD.r}
              y2={layout.toY(0)}
              stroke="#475569"
              strokeWidth={0.5}
              strokeDasharray="3 3"
            />

            {/* Legend */}
            <g transform={`translate(${SVG_W - PAD.r - 130}, ${PAD.t + 4})`}>
              <rect width="126" height="58" fill="rgba(0,0,0,0.55)" stroke="#1f2937" />
              <LegendRow y={12} color="#94a374" label="terreno" />
              <LegendRow y={24} color="#ff8a3d" label="anomalía" />
              <LegendRow y={36} color="#fbbf24" label="sondaje" />
              <LegendRow y={48} color="#22d3ee" label="muestra sat." />
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}

function LegendRow({ y, color, label }: { y: number; color: string; label: string }) {
  return (
    <g transform={`translate(8, ${y})`}>
      <rect x={0} y={-4} width={10} height={3} fill={color} />
      <text x={16} y={0} fontFamily="monospace" fontSize="9" fill="#e5e7eb">
        {label}
      </text>
    </g>
  );
}

type LayoutCtx = {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  s: number;
  innerW: number;
  innerH: number;
  toX: (u: number) => number;
  toY: (v: number) => number;
};

function SectionGrid({ layout, kind }: { layout: LayoutCtx; kind: "vertical" | "plan" }) {
  const stepU = niceStep(layout.u1 - layout.u0);
  const stepV = niceStep(layout.v1 - layout.v0);
  const uTicks: number[] = [];
  const vTicks: number[] = [];
  const u0 = Math.ceil(layout.u0 / stepU) * stepU;
  for (let u = u0; u <= layout.u1; u += stepU) uTicks.push(u);
  const v0 = Math.ceil(layout.v0 / stepV) * stepV;
  for (let v = v0; v <= layout.v1; v += stepV) vTicks.push(v);

  return (
    <g>
      {uTicks.map((u, i) => (
        <line
          key={`gu-${i}`}
          x1={layout.toX(u)}
          y1={PAD.t}
          x2={layout.toX(u)}
          y2={SVG_H - PAD.b}
          stroke="#1f2937"
          strokeWidth={0.5}
        />
      ))}
      {vTicks.map((v, i) => (
        <line
          key={`gv-${i}`}
          x1={PAD.l}
          y1={layout.toY(v)}
          x2={SVG_W - PAD.r}
          y2={layout.toY(v)}
          stroke="#1f2937"
          strokeWidth={0.5}
        />
      ))}
      <line
        x1={PAD.l}
        y1={SVG_H - PAD.b}
        x2={SVG_W - PAD.r}
        y2={SVG_H - PAD.b}
        stroke="#475569"
        strokeWidth={0.8}
      />
      <line
        x1={PAD.l}
        y1={PAD.t}
        x2={PAD.l}
        y2={SVG_H - PAD.b}
        stroke="#475569"
        strokeWidth={0.8}
      />
      {uTicks.map((u, i) => (
        <text
          key={`tu-${i}`}
          x={layout.toX(u)}
          y={SVG_H - PAD.b + 12}
          fontFamily="monospace"
          fontSize="9"
          fill="#94a3b8"
          textAnchor="middle"
        >
          {Math.round(u)}
        </text>
      ))}
      {vTicks.map((v, i) => (
        <text
          key={`tv-${i}`}
          x={PAD.l - 6}
          y={layout.toY(v) + 3}
          fontFamily="monospace"
          fontSize="9"
          fill="#94a3b8"
          textAnchor="end"
        >
          {Math.round(v)}
        </text>
      ))}
      <text
        x={(PAD.l + SVG_W - PAD.r) / 2}
        y={SVG_H - 6}
        fontFamily="monospace"
        fontSize="10"
        fill="#cbd5e1"
        textAnchor="middle"
      >
        u · {kind === "vertical" ? "distancia horizontal (m)" : "este (m)"}
      </text>
      <text
        transform={`translate(14, ${(PAD.t + SVG_H - PAD.b) / 2}) rotate(-90)`}
        fontFamily="monospace"
        fontSize="10"
        fill="#cbd5e1"
        textAnchor="middle"
      >
        v · {kind === "vertical" ? "elevación (m)" : "norte (m)"}
      </text>
    </g>
  );
}
