// TonnageGradePanel — curva tonnage-grade en vivo con slider de cut-off CuEq.
// Se alimenta del block model conceptual (ENU metros, cu_eq_pct, tamaño bloque).
import { useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { X, TrendingUp } from "lucide-react";
import type { SyntheticBlock } from "@/lib/conceptualModel.functions";

type Props = {
  blocks: SyntheticBlock[];
  cutoff: number;
  onCutoffChange: (v: number) => void;
  onClose?: () => void;
  /** t/m³ — densidad por defecto roca alterada Cu pórfido */
  density?: number;
};

type CurvePoint = {
  cutoff: number;
  tonnesMt: number;
  gradeAvg: number;
  metalKt: number;
  blocks: number;
};

const N_STEPS = 60;

export function TonnageGradePanel({
  blocks,
  cutoff,
  onCutoffChange,
  onClose,
  density = 2.7,
}: Props) {
  const maxCuEq = useMemo(
    () => Math.max(0.1, ...blocks.map((b) => b.cuEq)),
    [blocks],
  );

  const curve = useMemo<CurvePoint[]>(() => {
    if (blocks.length === 0) return [];
    const pts: CurvePoint[] = [];
    const upper = Math.min(maxCuEq, 2.0);
    for (let i = 0; i <= N_STEPS; i++) {
      const co = (upper * i) / N_STEPS;
      let tonnes = 0;
      let gradeWeighted = 0;
      let count = 0;
      for (const b of blocks) {
        if (b.cuEq < co) continue;
        const vol = b.sx * b.sy * b.sz;
        const t = vol * density;
        tonnes += t;
        gradeWeighted += b.cuEq * t;
        count++;
      }
      pts.push({
        cutoff: co,
        tonnesMt: tonnes / 1e6,
        gradeAvg: tonnes > 0 ? gradeWeighted / tonnes : 0,
        metalKt: gradeWeighted / 1e8, // (t * %) / 100 / 1000
        blocks: count,
      });
    }
    return pts;
  }, [blocks, maxCuEq, density]);

  const current = useMemo<CurvePoint>(() => {
    if (blocks.length === 0)
      return { cutoff, tonnesMt: 0, gradeAvg: 0, metalKt: 0, blocks: 0 };
    let tonnes = 0;
    let gradeWeighted = 0;
    let count = 0;
    for (const b of blocks) {
      if (b.cuEq < cutoff) continue;
      const vol = b.sx * b.sy * b.sz;
      const t = vol * density;
      tonnes += t;
      gradeWeighted += b.cuEq * t;
      count++;
    }
    return {
      cutoff,
      tonnesMt: tonnes / 1e6,
      gradeAvg: tonnes > 0 ? gradeWeighted / tonnes : 0,
      metalKt: gradeWeighted / 1e8,
      blocks: count,
    };
  }, [blocks, cutoff, density]);

  // SVG chart
  const W = 360;
  const H = 180;
  const PAD = { l: 36, r: 36, t: 12, b: 24 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const maxTonnes = Math.max(1, ...curve.map((c) => c.tonnesMt));
  const maxGrade = Math.max(0.5, ...curve.map((c) => c.gradeAvg));
  const xScale = (co: number) => PAD.l + (co / Math.max(0.01, curve[curve.length - 1]?.cutoff ?? 1)) * innerW;
  const yT = (t: number) => PAD.t + innerH - (t / maxTonnes) * innerH;
  const yG = (g: number) => PAD.t + innerH - (g / maxGrade) * innerH;

  const pathT = curve
    .map((c, i) => `${i === 0 ? "M" : "L"} ${xScale(c.cutoff).toFixed(1)} ${yT(c.tonnesMt).toFixed(1)}`)
    .join(" ");
  const pathG = curve
    .map((c, i) => `${i === 0 ? "M" : "L"} ${xScale(c.cutoff).toFixed(1)} ${yG(c.gradeAvg).toFixed(1)}`)
    .join(" ");
  const cursorX = xScale(cutoff);

  return (
    <div className="absolute bottom-2 right-2 z-30 w-[400px] bg-black/90 backdrop-blur rounded-lg border border-cyan-500/40 shadow-xl text-foreground">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-cyan-300">
          <TrendingUp className="w-3.5 h-3.5" />
          Tonnage-grade · CONCEPTUAL
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <div className="px-3 py-2 space-y-2">
        {blocks.length === 0 ? (
          <div className="text-[11px] text-muted-foreground py-6 text-center">
            No hay block model conceptual. Genera el modelo primero.
          </div>
        ) : (
          <>
            <svg width={W} height={H} className="w-full h-auto block">
              {/* axes */}
              <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + innerH} stroke="#3b82f6" strokeWidth={1} opacity={0.6} />
              <line x1={W - PAD.r} y1={PAD.t} x2={W - PAD.r} y2={PAD.t + innerH} stroke="#f59e0b" strokeWidth={1} opacity={0.6} />
              <line x1={PAD.l} y1={PAD.t + innerH} x2={W - PAD.r} y2={PAD.t + innerH} stroke="#475569" strokeWidth={1} />

              {/* grid */}
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + innerH * f} y2={PAD.t + innerH * f} stroke="#1e293b" strokeDasharray="2 3" />
              ))}

              {/* curves */}
              <path d={pathT} stroke="#3b82f6" strokeWidth={2} fill="none" />
              <path d={pathG} stroke="#f59e0b" strokeWidth={2} fill="none" />

              {/* cursor */}
              <line x1={cursorX} x2={cursorX} y1={PAD.t} y2={PAD.t + innerH} stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="3 3" />
              <circle cx={cursorX} cy={yT(current.tonnesMt)} r={3.5} fill="#3b82f6" stroke="#fff" strokeWidth={1} />
              <circle cx={cursorX} cy={yG(current.gradeAvg)} r={3.5} fill="#f59e0b" stroke="#fff" strokeWidth={1} />

              {/* labels */}
              <text x={PAD.l - 4} y={PAD.t + 8} fill="#3b82f6" fontSize={9} textAnchor="end" fontFamily="monospace">
                {maxTonnes.toFixed(0)} Mt
              </text>
              <text x={W - PAD.r + 4} y={PAD.t + 8} fill="#f59e0b" fontSize={9} fontFamily="monospace">
                {maxGrade.toFixed(2)}%
              </text>
              <text x={PAD.l} y={H - 6} fill="#94a3b8" fontSize={9} fontFamily="monospace">
                0
              </text>
              <text x={W - PAD.r} y={H - 6} fill="#94a3b8" fontSize={9} textAnchor="end" fontFamily="monospace">
                cut-off CuEq %
              </text>
            </svg>

            <div className="px-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>cut-off</span>
                <span className="font-mono text-cyan-300">{cutoff.toFixed(2)}% CuEq</span>
              </div>
              <Slider
                value={[cutoff]}
                min={0}
                max={Math.min(maxCuEq, 2.0)}
                step={0.01}
                onValueChange={(v) => onCutoffChange(v[0])}
              />
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1">
              <Metric label="Tonnage" value={`${current.tonnesMt.toFixed(1)}`} unit="Mt" color="text-blue-300" />
              <Metric label="Grade" value={`${current.gradeAvg.toFixed(2)}`} unit="% CuEq" color="text-amber-300" />
              <Metric label="Metal" value={`${current.metalKt.toFixed(1)}`} unit="kt CuEq" color="text-emerald-300" />
              <Metric label="Blocks" value={`${current.blocks}`} unit="" color="text-foreground" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="bg-black/40 rounded px-2 py-1 border border-border/60">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-[13px] font-mono leading-tight ${color}`}>{value}</div>
      <div className="text-[9px] text-muted-foreground">{unit}</div>
    </div>
  );
}
