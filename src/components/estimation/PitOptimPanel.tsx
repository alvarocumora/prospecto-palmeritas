import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useEconomicScenarios } from "@/hooks/useEconomicScenarios";
import { optimizePit } from "@/lib/pitOptim.functions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mountain, Loader2, TrendingUp, Box as BoxIcon } from "lucide-react";
import { toast } from "sonner";
import { SchedulePanel } from "./SchedulePanel";
import { PitShell3DViewer } from "./PitShell3DViewer";

type PitResult = Awaited<ReturnType<typeof optimizePit>>;

function fmtT(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} Mt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)} kt`;
  return `${v.toFixed(0)} t`;
}
function fmtUsd(v: number): string {
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

export function PitOptimPanel({
  modelId,
  commodity,
  writable,
}: {
  modelId: string;
  commodity: string;
  writable: boolean;
}) {
  const { scenarios, loading } = useEconomicScenarios(modelId);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const runPit = useServerFn(optimizePit);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show3d, setShow3d] = useState(false);

  const selected = scenarioId ?? scenarios[0]?.id ?? null;
  const unit =
    commodity === "au" || commodity === "ag"
      ? "g/t"
      : commodity === "fe" || commodity === "li"
        ? "%"
        : "%";

  const handleRun = async () => {
    if (!selected) return;
    setRunning(true);
    setError(null);
    toast.loading("Optimizando pit (floating-cone)…", { id: `pit-${selected}` });
    try {
      const out = await runPit({ data: { scenarioId: selected } });
      setResult(out);
      toast.success(
        `Pit: ${fmtT(out.ore_tonnes)} ore · SR ${out.strip_ratio.toFixed(2)} · ${fmtUsd(out.total_pit_value_usd)}`,
        { id: `pit-${selected}` },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      setError(msg);
      toast.error(msg, { id: `pit-${selected}` });
    } finally {
      setRunning(false);
    }
  };

  return (
    <details className="border border-border rounded">
      <summary className="px-2 py-1.5 text-[10px] font-mono cursor-pointer uppercase text-text-dim hover:text-foreground flex items-center gap-1.5">
        <Mountain className="w-3 h-3" />
        Optimización de Pit (floating-cone)
      </summary>
      <div className="p-2 space-y-2">
        {loading ? (
          <div className="text-[10px] text-text-dim font-mono">Cargando escenarios…</div>
        ) : scenarios.length === 0 ? (
          <div className="text-[10px] text-text-dim font-mono">
            Crea un escenario económico primero (panel Escenarios Económicos).
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Select
                value={selected ?? undefined}
                onValueChange={(v) => {
                  setScenarioId(v);
                  setResult(null);
                }}
              >
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue placeholder="Escenario" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} · slope {s.slope_angle_deg}° · ${s.commodity_price_usd}/
                      {s.price_unit.replace("usd_per_", "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {writable && (
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleRun}
                  disabled={!selected || running}
                >
                  {running ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <TrendingUp className="w-3 h-3 mr-1" />
                  )}
                  Optimizar pit
                </Button>
              )}
            </div>

            {error && (
              <div className="text-[10px] font-mono text-signal-red border border-signal-red/40 rounded p-2">
                {error}
              </div>
            )}

            {result && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px] font-mono pt-2 border-t border-border">
                <Kpi
                  label="Bloques in-pit"
                  value={`${result.blocks_in_pit}/${result.blocks_total}`}
                />
                <Kpi label="Bloques ore" value={String(result.blocks_ore)} />
                <Kpi label="Slope" value={`${Number(result.slope_angle_deg).toFixed(0)}°`} />
                <Kpi label="Ore" value={fmtT(result.ore_tonnes)} highlight />
                <Kpi label="Waste" value={fmtT(result.waste_tonnes)} />
                <Kpi
                  label="Strip ratio"
                  value={result.strip_ratio.toFixed(2)}
                  highlight={result.strip_ratio < 3}
                />
                <Kpi
                  label="Ley media"
                  value={`${result.mean_grade.toFixed(commodity === "au" || commodity === "ag" ? 2 : 3)} ${unit}`}
                />
                <Kpi label="Metal pagable" value={result.metal_payable.toFixed(0)} />
                <Kpi label="NSR bruto" value={fmtUsd(result.gross_revenue_usd)} />
                <div className="col-span-2 md:col-span-3 border-t border-border pt-2 flex items-center justify-between">
                  <span className="text-text-dim uppercase">Valor neto del pit</span>
                  <b
                    className={
                      result.total_pit_value_usd >= 0
                        ? "text-signal-cyan text-sm"
                        : "text-signal-red text-sm"
                    }
                  >
                    {fmtUsd(result.total_pit_value_usd)}
                  </b>
                </div>
                <div className="col-span-2 md:col-span-3 text-[9px] text-text-dim">
                  Persistidos {result.persisted_block_econ} bloques en{" "}
                  <code>resource_block_economics</code> · {result.elapsed_ms} ms
                </div>
                <div className="col-span-2 md:col-span-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setShow3d(true)}
                  >
                    <BoxIcon className="w-3 h-3 mr-1" /> Ver pit shell 3D
                  </Button>
                </div>
              </div>
            )}

            {result && (
              <div className="border-t border-border pt-2">
                <div className="text-[9px] uppercase text-text-dim font-mono mb-1">
                  Scheduling NPV anual
                </div>
                <SchedulePanel scenarioId={selected} disabled={!writable} />
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={show3d} onOpenChange={setShow3d}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b border-border">
            <DialogTitle className="font-mono text-sm flex items-center gap-2">
              <BoxIcon className="w-4 h-4 text-signal-cyan" />
              Pit shell 3D
            </DialogTitle>
          </DialogHeader>
          <div className="p-3">{selected && <PitShell3DViewer scenarioId={selected} />}</div>
        </DialogContent>
      </Dialog>
    </details>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-text-dim uppercase tracking-wide text-[9px]">{label}</span>
      <span className={highlight ? "text-signal-cyan" : "text-foreground"}>{value}</span>
    </div>
  );
}
