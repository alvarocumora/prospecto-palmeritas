import { useEffect, useState } from "react";
import {
  useEconomicScenarios,
  type EconomicScenario,
  type ScheduleRow,
} from "@/hooks/useEconomicScenarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Plus,
  Play,
  Trash2,
  Loader2,
  TrendingUp,
  Calendar,
  Layers,
  Activity,
  GitCompare,
} from "lucide-react";
import { SensitivityTornadoPanel } from "./SensitivityTornadoPanel";
import { ScenarioCompareDialog } from "./ScenarioCompareDialog";
import { Ni43101ExportButton } from "./Ni43101ExportButton";
import { useProjects } from "@/hooks/useProjects";

type Props = {
  modelId: string;
  modelName: string;
  commodity: string;
  writable: boolean;
  model?: React.ComponentProps<typeof Ni43101ExportButton>["model"];
};

const PRICE_UNITS: { v: string; l: string; defaultPrice: number }[] = [
  { v: "usd_per_oz", l: "USD/oz (Au, Ag)", defaultPrice: 2400 },
  { v: "usd_per_lb", l: "USD/lb (Cu, Mo, Pb, Zn)", defaultPrice: 4.2 },
  { v: "usd_per_t", l: "USD/t (Fe, Li)", defaultPrice: 120 },
];

function fmtUsd(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}
function fmtT(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} Mt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)} kt`;
  return `${v.toFixed(0)} t`;
}

export function EconomicScenariosPanel({ modelId, modelName, commodity, writable, model }: Props) {
  const { scenarios, loading, create, remove, compute, getSchedule } =
    useEconomicScenarios(modelId);
  const { active } = useProjects();
  const [dialog, setDialog] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<EconomicScenario | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [tornadoFor, setTornadoFor] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    if (scheduleFor) {
      getSchedule(scheduleFor.id)
        .then(setSchedule)
        .catch(() => setSchedule([]));
    } else setSchedule([]);
  }, [scheduleFor, getSchedule]);

  const defaultPrice =
    commodity === "au" || commodity === "ag"
      ? "usd_per_oz"
      : commodity === "cu" || commodity === "mo" || commodity === "pb" || commodity === "zn"
        ? "usd_per_lb"
        : "usd_per_t";

  const handleRun = async (id: string) => {
    setRunning(id);
    try {
      await compute(id);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-dim uppercase">
          <DollarSign className="w-3 h-3" /> Análisis económico
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {scenarios.filter((s) => s.status === "complete").length >= 2 && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2"
              onClick={() => setCompareOpen(true)}
            >
              <GitCompare className="w-3 h-3 mr-1" /> Comparar
            </Button>
          )}
          {model && scenarios.length > 0 && (
            <Ni43101ExportButton
              model={model}
              scenarios={scenarios}
              projectName={active?.name ?? "proyecto"}
            />
          )}
          {writable && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2"
              onClick={() => setDialog(true)}
            >
              <Plus className="w-3 h-3 mr-1" /> Escenario
            </Button>
          )}
        </div>
      </div>

      {tornadoFor && <SensitivityTornadoPanel scenarioId={tornadoFor} />}

      <ScenarioCompareDialog
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        scenarios={scenarios}
      />

      {loading ? (
        <div className="text-text-dim text-[10px] font-mono">Cargando…</div>
      ) : scenarios.length === 0 ? (
        <div className="text-text-dim text-[10px] font-mono italic">
          Sin escenarios. Crea uno para calcular NPV/IRR.
        </div>
      ) : (
        <div className="space-y-1.5">
          {scenarios.map((s) => (
            <ScenarioRow
              key={s.id}
              scenario={s}
              writable={writable}
              running={running === s.id}
              onRun={() => handleRun(s.id)}
              onDelete={() => {
                if (confirm(`Eliminar "${s.name}"?`)) remove(s.id);
              }}
              onViewSchedule={() => setScheduleFor(s)}
              onTornado={
                s.status === "complete"
                  ? () => setTornadoFor(tornadoFor === s.id ? null : s.id)
                  : undefined
              }
              tornadoActive={tornadoFor === s.id}
            />
          ))}
        </div>
      )}

      <CreateScenarioDialog
        open={dialog}
        modelId={modelId}
        modelName={modelName}
        defaultUnit={defaultPrice}
        onClose={() => setDialog(false)}
        onSave={async (data) => {
          await create(data);
          setDialog(false);
        }}
      />

      <Dialog open={!!scheduleFor} onOpenChange={(o) => !o && setScheduleFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-signal-cyan" />
              Schedule anual — {scheduleFor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh] border border-border rounded">
            <table className="w-full text-[10px] font-mono">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr className="text-text-dim">
                  <th className="px-2 py-1 text-left">Año</th>
                  <th className="px-2 py-1 text-right">Mineral</th>
                  <th className="px-2 py-1 text-right">Estéril</th>
                  <th className="px-2 py-1 text-right">Ingresos</th>
                  <th className="px-2 py-1 text-right">OPEX</th>
                  <th className="px-2 py-1 text-right">Cashflow</th>
                  <th className="px-2 py-1 text-right">Acum.</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="px-2 py-1">Y{r.year}</td>
                    <td className="px-2 py-1 text-right">{fmtT(r.ore_tonnes)}</td>
                    <td className="px-2 py-1 text-right">{fmtT(r.waste_tonnes)}</td>
                    <td className="px-2 py-1 text-right">{fmtUsd(r.revenue_usd)}</td>
                    <td className="px-2 py-1 text-right text-signal-red/80">
                      -{fmtUsd(r.opex_usd)}
                    </td>
                    <td
                      className={`px-2 py-1 text-right ${r.cashflow_usd >= 0 ? "text-signal-cyan" : "text-signal-red"}`}
                    >
                      {fmtUsd(r.cashflow_usd)}
                    </td>
                    <td className="px-2 py-1 text-right">{fmtUsd(r.cumulative_cashflow_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScenarioRow({
  scenario,
  writable,
  running,
  onRun,
  onDelete,
  onViewSchedule,
  onTornado,
  tornadoActive,
}: {
  scenario: EconomicScenario;
  writable: boolean;
  running: boolean;
  onRun: () => void;
  onDelete: () => void;
  onViewSchedule: () => void;
  onTornado?: () => void;
  tornadoActive?: boolean;
}) {
  const statusColor =
    {
      draft: "border-border text-text-dim",
      running: "border-signal-amber/50 text-signal-amber",
      complete: "border-signal-cyan/50 text-signal-cyan",
      failed: "border-signal-red/50 text-signal-red",
    }[scenario.status] ?? "border-border text-text-dim";

  return (
    <div className="border border-border/60 rounded p-2 bg-background/40 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-xs truncate">{scenario.name}</div>
        <Badge variant="outline" className={`text-[9px] ${statusColor}`}>
          {scenario.status}
        </Badge>
      </div>
      {scenario.status === "complete" && (
        <div className="grid grid-cols-4 gap-2 text-[10px] font-mono">
          <Mini
            label="NPV"
            value={fmtUsd(scenario.npv_usd)}
            highlight={(scenario.npv_usd ?? 0) > 0}
          />
          <Mini
            label="IRR"
            value={scenario.irr_pct != null ? `${scenario.irr_pct.toFixed(1)}%` : "—"}
          />
          <Mini label="Mineral" value={fmtT(scenario.ore_tonnes)} />
          <Mini label="Vida" value={`${scenario.mine_life_years ?? "—"} a`} />
          <Mini
            label="Strip"
            value={scenario.strip_ratio != null ? scenario.strip_ratio.toFixed(2) : "—"}
          />
          <Mini
            label="Cutoff"
            value={
              scenario.nsr_cutoff_usd_t != null ? `$${scenario.nsr_cutoff_usd_t.toFixed(1)}/t` : "—"
            }
          />
          <Mini
            label="Payback"
            value={scenario.payback_years != null ? `${scenario.payback_years} a` : "—"}
          />
          <Mini label="EBITDA" value={fmtUsd(scenario.ebitda_usd)} />
        </div>
      )}
      <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
        {scenario.status === "complete" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2"
            onClick={onViewSchedule}
          >
            <Calendar className="w-3 h-3 mr-1" /> Schedule
          </Button>
        )}
        {onTornado && (
          <Button
            size="sm"
            variant="ghost"
            className={`h-6 text-[10px] px-2 ${tornadoActive ? "text-signal-cyan" : ""}`}
            onClick={onTornado}
          >
            <Activity className="w-3 h-3 mr-1" /> Tornado
          </Button>
        )}
        {writable && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2"
              disabled={running}
              onClick={onRun}
            >
              {running ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Play className="w-3 h-3 mr-1" />
              )}
              {scenario.status === "complete" ? "Recalcular" : "Calcular"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 text-signal-red ml-auto"
              onClick={onDelete}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-text-dim text-[9px] uppercase">{label}</span>
      <b className={highlight ? "text-signal-cyan" : "text-foreground"}>{value}</b>
    </div>
  );
}

function CreateScenarioDialog({
  open,
  modelId,
  modelName,
  defaultUnit,
  onClose,
  onSave,
}: {
  open: boolean;
  modelId: string;
  modelName: string;
  defaultUnit: string;
  onClose: () => void;
  onSave: (data: Parameters<ReturnType<typeof useEconomicScenarios>["create"]>[0]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [priceUnit, setPriceUnit] = useState(defaultUnit);
  const [price, setPrice] = useState(
    PRICE_UNITS.find((p) => p.v === defaultUnit)?.defaultPrice ?? 2400,
  );
  const [recovery, setRecovery] = useState(90);
  const [miningCost, setMiningCost] = useState(3.5);
  const [procCost, setProcCost] = useState(18);
  const [gaCost, setGaCost] = useState(2.5);
  const [royalty, setRoyalty] = useState(3);
  const [throughput, setThroughput] = useState(1_000_000);
  const [discount, setDiscount] = useState(8);
  const [capex, setCapex] = useState(50_000_000);
  const [slope, setSlope] = useState(45);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPriceUnit(defaultUnit);
    setPrice(PRICE_UNITS.find((p) => p.v === defaultUnit)?.defaultPrice ?? 2400);
  }, [defaultUnit, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        model_id: modelId,
        name: name.trim(),
        commodity_price_usd: price,
        price_unit: priceUnit,
        recovery_pct: recovery,
        mining_cost_usd_t: miningCost,
        processing_cost_usd_t: procCost,
        ga_cost_usd_t: gaCost,
        royalty_pct: royalty,
        annual_throughput_t: throughput,
        discount_rate_pct: discount,
        capex_usd: capex,
        slope_angle_deg: slope,
      });
      setName("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-signal-cyan" />
            Nuevo escenario económico — {modelName}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label className="text-xs font-mono">Nombre del escenario</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Base · Au $2400/oz"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label className="text-xs font-mono">Unidad de precio</Label>
              <Select value={priceUnit} onValueChange={setPriceUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_UNITS.map((p) => (
                    <SelectItem key={p.v} value={p.v}>
                      {p.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-mono">Precio</Label>
              <Input
                type="number"
                step={0.1}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Recovery %" value={recovery} setValue={setRecovery} step={1} />
            <Field label="Royalty %" value={royalty} setValue={setRoyalty} step={0.5} />
            <Field label="Slope °" value={slope} setValue={setSlope} step={1} />
            <Field label="Discount %" value={discount} setValue={setDiscount} step={0.5} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Mining $/t" value={miningCost} setValue={setMiningCost} step={0.5} />
            <Field label="Process $/t" value={procCost} setValue={setProcCost} step={0.5} />
            <Field label="G&A $/t" value={gaCost} setValue={setGaCost} step={0.5} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Capex (USD)" value={capex} setValue={setCapex} step={1_000_000} />
            <Field
              label="Throughput (t/año)"
              value={throughput}
              setValue={setThroughput}
              step={100_000}
            />
          </div>
          <div className="text-[10px] text-text-dim font-mono flex items-center gap-1">
            <Layers className="w-3 h-3" /> El motor usa pit-shell heurístico (cono flotante) + NSR.
            Para PEA/PFS contrastar con software dedicado.
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Crear escenario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  setValue,
  step,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  step?: number;
}) {
  return (
    <div>
      <Label className="text-xs font-mono">{label}</Label>
      <Input
        type="number"
        step={step ?? 0.1}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
    </div>
  );
}
