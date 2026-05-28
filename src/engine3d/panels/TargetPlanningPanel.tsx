// TargetPlanningPanel — Sprint 5
// Tabla de targets ranqueados con filtros, exportación CSV y resumen para inversionistas.
import { useMemo, useState } from "react";
import { Crosshair, X, Download, FileText, Plus, Minus } from "lucide-react";
import type { DrillTarget, DrillTargetOutput } from "@/engine3d/ai/drillTarget.worker";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

type Props = {
  output: DrillTargetOutput | null;
  busy: boolean;
  scenarioIds: Set<string>;
  onToggleScenario: (id: string) => void;
  onExportCsv: (targets: DrillTarget[]) => void;
  onGenerateInvestorSummary: (targets: DrillTarget[]) => void;
  onClose: () => void;
};

const PRIORITY_BG: Record<DrillTarget["priority"], string> = {
  A: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  B: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  C: "bg-red-500/20 text-red-200 border-red-500/40",
};

export function TargetPlanningPanel({
  output,
  busy,
  scenarioIds,
  onToggleScenario,
  onExportCsv,
  onGenerateInvestorSummary,
  onClose,
}: Props) {
  const [priorityFilter, setPriorityFilter] = useState<Record<DrillTarget["priority"], boolean>>({
    A: true,
    B: true,
    C: true,
  });
  const [maxDepth, setMaxDepth] = useState(600);
  const [maxCost, setMaxCost] = useState(2_000_000);
  const [minConfidence, setMinConfidence] = useState(0);

  const filtered = useMemo(() => {
    if (!output) return [];
    return output.targets.filter(
      (t) =>
        priorityFilter[t.priority] &&
        t.depth <= maxDepth &&
        t.estimatedCost <= maxCost &&
        t.confidence >= minConfidence,
    );
  }, [output, priorityFilter, maxDepth, maxCost, minConfidence]);

  const scenarioTargets = useMemo(
    () => filtered.filter((t) => scenarioIds.has(t.targetId)),
    [filtered, scenarioIds],
  );

  const scenarioMeters = scenarioTargets.reduce((s, t) => s + t.depth, 0);
  const scenarioCost = scenarioTargets.reduce((s, t) => s + t.estimatedCost, 0);
  const avgConfidence =
    scenarioTargets.length > 0
      ? scenarioTargets.reduce((s, t) => s + t.confidence, 0) / scenarioTargets.length
      : 0;

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 w-[min(880px,94%)] max-h-[90%] overflow-hidden bg-black/90 backdrop-blur rounded-lg border border-cyan-500/40 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-cyan-500/10">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-cyan-300" />
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-200">
            Drill Target Planning
          </span>
          {output && (
            <span className="text-[10px] text-muted-foreground ml-2">
              {output.stats.selected}/{output.stats.candidates} · A:{output.stats.aPriority} B:{output.stats.bPriority} C:{output.stats.cPriority}
            </span>
          )}
        </div>
        <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 p-3 border-b border-border bg-black/40">
        <div>
          <Label className="text-[9px] uppercase">Prioridad</Label>
          <div className="grid grid-cols-3 gap-1 mt-1">
            {(["A", "B", "C"] as const).map((p) => (
              <button
                key={p}
                className={`h-6 text-[10px] rounded border ${
                  priorityFilter[p] ? PRIORITY_BG[p] : "border-border/40 text-muted-foreground opacity-50"
                }`}
                onClick={() => setPriorityFilter((s) => ({ ...s, [p]: !s[p] }))}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[9px] uppercase">Max depth · {maxDepth} m</Label>
          <Slider min={100} max={800} step={50} value={[maxDepth]} onValueChange={([v]) => setMaxDepth(v)} className="mt-2" />
        </div>
        <div>
          <Label className="text-[9px] uppercase">Max cost · ${(maxCost / 1000).toFixed(0)}k</Label>
          <Slider min={50_000} max={5_000_000} step={50_000} value={[maxCost]} onValueChange={([v]) => setMaxCost(v)} className="mt-2" />
        </div>
        <div>
          <Label className="text-[9px] uppercase">Min confianza · {(minConfidence * 100).toFixed(0)}%</Label>
          <Slider min={0} max={1} step={0.05} value={[minConfidence]} onValueChange={([v]) => setMinConfidence(v)} className="mt-2" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {busy && (
          <div className="text-center text-[10px] text-amber-300 font-mono py-2">Calculando targets…</div>
        )}
        {!busy && filtered.length === 0 && (
          <div className="text-center text-[10px] text-muted-foreground font-mono py-6">
            Sin targets que cumplan los filtros.
          </div>
        )}
        <table className="w-full text-[10px] font-mono">
          <thead className="text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="text-left px-2 py-1">ID</th>
              <th className="text-left px-2 py-1">Prio</th>
              <th className="text-right px-2 py-1">Score</th>
              <th className="text-right px-2 py-1">Conf</th>
              <th className="text-right px-2 py-1">Depth</th>
              <th className="text-right px-2 py-1">Az/Dip</th>
              <th className="text-right px-2 py-1">Zone</th>
              <th className="text-right px-2 py-1">Cost</th>
              <th className="text-right px-2 py-1">Gap</th>
              <th className="text-center px-2 py-1">+</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const inScenario = scenarioIds.has(t.targetId);
              return (
                <tr key={t.targetId} className="border-b border-border/40 hover:bg-white/5">
                  <td className="px-2 py-1 text-foreground">{t.targetId}</td>
                  <td className="px-2 py-1">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] border ${PRIORITY_BG[t.priority]}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="text-right px-2 py-1">{(t.score * 100).toFixed(0)}</td>
                  <td className="text-right px-2 py-1">{(t.confidence * 100).toFixed(0)}%</td>
                  <td className="text-right px-2 py-1">{t.depth.toFixed(0)} m</td>
                  <td className="text-right px-2 py-1">{t.azimuth.toFixed(0)}/{t.dip.toFixed(0)}</td>
                  <td className="text-right px-2 py-1 text-muted-foreground">{t.expectedZone}</td>
                  <td className="text-right px-2 py-1">${(t.estimatedCost / 1000).toFixed(0)}k</td>
                  <td className="text-right px-2 py-1 text-muted-foreground">{t.spacingGap.toFixed(0)}m</td>
                  <td className="text-center px-2 py-1">
                    <button
                      onClick={() => onToggleScenario(t.targetId)}
                      className={`p-0.5 rounded ${
                        inScenario ? "text-red-300 hover:bg-red-500/20" : "text-emerald-300 hover:bg-emerald-500/20"
                      }`}
                      title={inScenario ? "Remove from scenario" : "Add to scenario"}
                    >
                      {inScenario ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border p-3 bg-black/40 text-[10px] font-mono space-y-2">
        <div className="grid grid-cols-4 gap-2">
          <ScenarioKpi label="Targets" value={scenarioTargets.length.toString()} />
          <ScenarioKpi label="Metros totales" value={`${scenarioMeters.toFixed(0)} m`} />
          <ScenarioKpi label="Costo estimado" value={`$${(scenarioCost / 1000).toFixed(0)}k`} />
          <ScenarioKpi label="Confianza media" value={`${(avgConfidence * 100).toFixed(0)}%`} />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-[10px]"
            disabled={filtered.length === 0}
            onClick={() => onExportCsv(filtered)}
          >
            <Download className="w-3 h-3 mr-1" /> Export drill plan CSV
          </Button>
          <Button
            size="sm"
            className="flex-1 h-7 text-[10px]"
            disabled={scenarioTargets.length === 0}
            onClick={() => onGenerateInvestorSummary(scenarioTargets)}
          >
            <FileText className="w-3 h-3 mr-1" /> Generate investor summary
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScenarioKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-black/40 px-2 py-1">
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
      <div className="text-foreground text-sm font-semibold">{value}</div>
    </div>
  );
}
