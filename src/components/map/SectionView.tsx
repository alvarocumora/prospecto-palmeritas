import { useMemo, useState } from "react";
import { X, Download, Sparkles, Loader2 } from "lucide-react";
import type { ProjectedHole, SectionLine } from "@/lib/section/projection";
import { auGradeColor, lithoColor } from "@/lib/section/projection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  line: SectionLine;
  holes: ProjectedHole[];
  maxOffsetM: number;
  projectName?: string;
  onClose: () => void;
}

const MARGIN = { top: 50, right: 30, bottom: 60, left: 60 };
const W = 980;
const H = 480;

export function SectionView({ line, holes, maxOffsetM, projectName, onClose }: Props) {
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [interpreting, setInterpreting] = useState(false);

  const interpret = async () => {
    if (interpreting) return;
    setInterpreting(true);
    try {
      const payload = {
        line: { lengthM: line.lengthM, bearingDeg: line.bearingDeg, start: line.start, end: line.end },
        maxOffsetM,
        projectName,
        holes: holes.map((ph) => ({
          hole_id: ph.hole.hole_id,
          alongM: ph.alongM,
          signedOffsetM: ph.signedOffsetM,
          azimuth: ph.hole.azimuth,
          dip: ph.hole.dip,
          depth: ph.hole.actual_depth ?? ph.hole.planned_depth,
          intercepts: ph.logs.map((l) => ({
            from: l.depth_from,
            to: l.depth_to,
            au: l.au_gpt,
            cu: l.cu_pct,
            lithology: l.lithology,
            alteration: l.alteration,
          })),
        })),
      };
      const { data, error } = await supabase.functions.invoke("section-interpret", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInterpretation(data.interpretation as string);
      toast.success("Interpretación IA generada");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Error generando interpretación");
    } finally {
      setInterpreting(false);
    }
  };

  const { maxDepth, scaleX, scaleY } = useMemo(() => {
    const maxD = Math.max(
      120,
      ...holes.map((h) => (h.hole.actual_depth ?? h.hole.planned_depth ?? 0)),
    );
    const padTop = 30; // surface buffer
    const innerW = W - MARGIN.left - MARGIN.right;
    const innerH = H - MARGIN.top - MARGIN.bottom;
    const sx = (m: number) => MARGIN.left + (m / line.lengthM) * innerW;
    const sy = (depth: number) => MARGIN.top + padTop + (depth / maxD) * (innerH - padTop);
    return { maxDepth: maxD, scaleX: sx, scaleY: sy };
  }, [line.lengthM, holes]);

  const surfaceY = MARGIN.top + 30;
  const exportSvg = () => {
    const svg = document.getElementById("section-svg")?.outerHTML;
    if (!svg) return;
    const blob = new Blob([`<?xml version="1.0"?>\n${svg}`], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seccion-${new Date().toISOString().slice(0, 10)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background border border-border rounded-lg max-w-[1040px] w-full max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Sección 2D</div>
            <div className="text-sm font-mono font-semibold">
              {line.lengthM.toFixed(0)} m · azimut {line.bearingDeg.toFixed(0)}° · {holes.length} sondajes proyectados (±{maxOffsetM} m)
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportSvg} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-xs font-mono hover:bg-accent">
              <Download className="w-3.5 h-3.5" /> SVG
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-4 overflow-x-auto bg-bg-secondary">
          <svg id="section-svg" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ background: "#FAF7F2", maxWidth: 1000 }} xmlns="http://www.w3.org/2000/svg">
            {/* Sky / surface */}
            <defs>
              <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#e0f2fe" />
                <stop offset="100%" stopColor="#fef3c7" />
              </linearGradient>
            </defs>
            <rect x={MARGIN.left} y={MARGIN.top} width={W - MARGIN.left - MARGIN.right} height={surfaceY - MARGIN.top} fill="url(#sky)" />
            <line x1={MARGIN.left} y1={surfaceY} x2={W - MARGIN.right} y2={surfaceY} stroke="#92400e" strokeWidth={2} />
            <rect x={MARGIN.left} y={surfaceY} width={W - MARGIN.left - MARGIN.right} height={H - MARGIN.bottom - surfaceY} fill="#fef3c7" opacity={0.3} />

            {/* End labels */}
            <text x={MARGIN.left} y={MARGIN.top - 12} fontSize={11} fontFamily="monospace" fill="#52525b">A · {line.start[0].toFixed(4)}, {line.start[1].toFixed(4)}</text>
            <text x={W - MARGIN.right} y={MARGIN.top - 12} fontSize={11} fontFamily="monospace" fill="#52525b" textAnchor="end">A' · {line.end[0].toFixed(4)}, {line.end[1].toFixed(4)}</text>

            {/* Depth grid + axis */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const d = f * maxDepth;
              const y = scaleY(d);
              return (
                <g key={f}>
                  <line x1={MARGIN.left} y1={y} x2={W - MARGIN.right} y2={y} stroke="#e7e5e4" strokeDasharray="3,3" />
                  <text x={MARGIN.left - 6} y={y + 3} fontSize={9} fontFamily="monospace" fill="#78716c" textAnchor="end">{d.toFixed(0)} m</text>
                </g>
              );
            })}

            {/* Distance axis */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const m = f * line.lengthM;
              const x = scaleX(m);
              return (
                <g key={`x${f}`}>
                  <line x1={x} y1={H - MARGIN.bottom} x2={x} y2={H - MARGIN.bottom + 4} stroke="#78716c" />
                  <text x={x} y={H - MARGIN.bottom + 16} fontSize={9} fontFamily="monospace" fill="#78716c" textAnchor="middle">{m.toFixed(0)} m</text>
                </g>
              );
            })}

            {/* Holes */}
            {holes.map((ph) => {
              const x0 = scaleX(ph.alongM);
              const dip = Math.abs(ph.hole.dip ?? 90);
              const dipRad = (dip * Math.PI) / 180;
              const totalDepth = ph.hole.actual_depth ?? ph.hole.planned_depth ?? 100;
              // Direction in section: + or − along x depending on azimuth vs section bearing
              const az = ph.hole.azimuth ?? 0;
              const sign = Math.cos(((az - line.bearingDeg) * Math.PI) / 180) >= 0 ? 1 : -1;
              const horizPerM = Math.sin(dipRad) === 0 ? 0 : Math.cos(dipRad) / Math.sin(dipRad === 0 ? 1e-6 : dipRad);
              const dxPerDepth = sign * horizPerM;

              return (
                <g key={ph.hole.id}>
                  {/* Hole trace as filled segments by litho/grade */}
                  {ph.logs.length > 0
                    ? ph.logs.map((log, i) => {
                        const yFrom = scaleY(log.depth_from);
                        const yTo = scaleY(log.depth_to);
                        const xFrom = x0 + (log.depth_from) * (dxPerDepth) * ((scaleX(line.lengthM) - scaleX(0)) / line.lengthM);
                        const xTo = x0 + (log.depth_to) * (dxPerDepth) * ((scaleX(line.lengthM) - scaleX(0)) / line.lengthM);
                        const grade = log.au_gpt;
                        const col = grade != null && grade >= 0.3 ? auGradeColor(grade) : lithoColor(log.lithology);
                        return (
                          <line
                            key={i}
                            x1={xFrom}
                            y1={yFrom}
                            x2={xTo}
                            y2={yTo}
                            stroke={col}
                            strokeWidth={grade != null && grade >= 0.3 ? 6 : 4}
                            strokeLinecap="butt"
                          >
                            <title>{`${ph.hole.hole_id} · ${log.depth_from}-${log.depth_to}m\n${log.lithology ?? ""}${grade != null ? ` · Au ${grade} g/t` : ""}`}</title>
                          </line>
                        );
                      })
                    : (() => {
                        const yEnd = scaleY(totalDepth);
                        const xEnd = x0 + totalDepth * dxPerDepth * ((scaleX(line.lengthM) - scaleX(0)) / line.lengthM);
                        return <line x1={x0} y1={surfaceY} x2={xEnd} y2={yEnd} stroke="#a8a29e" strokeWidth={2} strokeDasharray="3,2" />;
                      })()}

                  {/* Collar marker */}
                  <circle cx={x0} cy={surfaceY} r={5} fill="#0b0d10" stroke="#fff" strokeWidth={1.5} />
                  <text x={x0} y={surfaceY - 10} fontSize={9} fontFamily="monospace" fill="#0b0d10" textAnchor="middle" fontWeight={700}>
                    {ph.hole.hole_id}
                  </text>
                  <text x={x0} y={surfaceY - 22} fontSize={8} fontFamily="monospace" fill="#78716c" textAnchor="middle">
                    {ph.signedOffsetM >= 0 ? "+" : ""}{ph.signedOffsetM.toFixed(0)}m
                  </text>
                </g>
              );
            })}

            {/* Title */}
            <text x={W / 2} y={H - 18} fontSize={11} fontFamily="monospace" fill="#0b0d10" textAnchor="middle" fontWeight={600}>
              SECCIÓN A — A'  ·  proyección ±{maxOffsetM} m
            </text>

            {/* Legend */}
            <g transform={`translate(${W - MARGIN.right - 200}, ${MARGIN.top + 8})`}>
              <rect x={0} y={0} width={195} height={88} fill="#fff" stroke="#e7e5e4" rx={4} />
              <text x={8} y={14} fontSize={9} fontFamily="monospace" fontWeight={700} fill="#0b0d10">Au g/t</text>
              {[
                { c: "#dc2626", l: "≥5" },
                { c: "#f97316", l: "1–5" },
                { c: "#facc15", l: "0.3–1" },
                { c: "#bef264", l: "0.1–0.3" },
                { c: "#475569", l: "<0.1 / lito" },
              ].map((row, i) => (
                <g key={i} transform={`translate(8, ${24 + i * 12})`}>
                  <rect width={14} height={6} fill={row.c} />
                  <text x={20} y={6} fontSize={9} fontFamily="monospace" fill="#0b0d10">{row.l}</text>
                </g>
              ))}
            </g>
          </svg>

          {holes.length === 0 && (
            <div className="mt-4 text-center text-xs font-mono text-muted-foreground">
              Ningún sondaje cae dentro de ±{maxOffsetM} m de la línea. Dibuja otra sección o sube los datos de coordenadas (easting/northing) de los holes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
