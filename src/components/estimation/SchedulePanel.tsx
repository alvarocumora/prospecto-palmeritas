// Sub-sprint Scheduling — panel UI con KPIs NPV/IRR/payback y mini chart anual.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { scheduleScenario } from "@/lib/schedule.functions";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

type SchedResult = Awaited<ReturnType<typeof scheduleScenario>>;

function fmtUsd(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}k`;
  return `${s}$${a.toFixed(0)}`;
}
function fmtT(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} Mt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)} kt`;
  return `${v.toFixed(0)} t`;
}

export function SchedulePanel({
  scenarioId,
  disabled,
}: {
  scenarioId: string | null;
  disabled?: boolean;
}) {
  const run = useServerFn(scheduleScenario);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SchedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    if (!scenarioId) return;
    setRunning(true);
    setError(null);
    toast.loading("Programando producción anual…", { id: `sch-${scenarioId}` });
    try {
      const out = await run({ data: { scenarioId } });
      setResult(out);
      toast.success(
        `NPV ${fmtUsd(out.npv_usd)} · IRR ${out.irr_pct == null ? "—" : out.irr_pct.toFixed(1) + "%"}`,
        { id: `sch-${scenarioId}` },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      setError(msg);
      toast.error(msg, { id: `sch-${scenarioId}` });
    } finally {
      setRunning(false);
    }
  };

  const prodYears = result?.years.filter((y) => y.year > 0) ?? [];
  const maxCf =
    prodYears.length > 0 ? Math.max(...prodYears.map((y) => Math.abs(y.cashflow_usd))) : 1;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handle}
          disabled={!scenarioId || running || disabled}
        >
          {running ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Calendar className="w-3 h-3 mr-1" />
          )}
          Programar producción NPV
        </Button>
        {!scenarioId && (
          <span className="text-[10px] text-text-dim font-mono">
            Selecciona escenario y optimiza pit primero
          </span>
        )}
      </div>

      {error && (
        <div className="text-[10px] font-mono text-signal-red border border-signal-red/40 rounded p-2">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono pt-2 border-t border-border">
            <Kpi label="NPV" value={fmtUsd(result.npv_usd)} highlight />
            <Kpi
              label="IRR"
              value={result.irr_pct == null ? "—" : `${result.irr_pct.toFixed(1)}%`}
              highlight={(result.irr_pct ?? 0) > 15}
            />
            <Kpi
              label="Payback"
              value={result.payback_years ? `${result.payback_years} a` : "—"}
            />
            <Kpi label="Mine life" value={`${result.mine_life_years} a`} />
            <Kpi label="Revenue tot." value={fmtUsd(result.total_revenue_usd)} />
            <Kpi label="OPEX tot." value={fmtUsd(result.total_opex_usd)} />
            <Kpi label="CAPEX tot." value={fmtUsd(result.total_capex_usd)} />
            <Kpi
              label="EBITDA"
              value={fmtUsd(result.total_revenue_usd - result.total_opex_usd)}
              highlight
            />
          </div>

          <div className="border-t border-border pt-2">
            <div className="text-[9px] uppercase text-text-dim font-mono mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Cashflow anual (descontado)
            </div>
            <div className="flex items-end gap-0.5 h-16">
              {result.years.map((y) => {
                const h = Math.max(2, (Math.abs(y.cashflow_usd) / maxCf) * 60);
                const pos = y.cashflow_usd >= 0;
                return (
                  <div
                    key={y.year}
                    className="flex flex-col items-center flex-1 group relative"
                    title={`Año ${y.year}: CF ${fmtUsd(y.cashflow_usd)} · NPV ${fmtUsd(y.discounted_cashflow_usd)} · Ore ${fmtT(y.ore_tonnes)}`}
                  >
                    <div
                      className={
                        pos ? "w-full bg-signal-cyan/70" : "w-full bg-signal-red/70"
                      }
                      style={{ height: `${h}px` }}
                    />
                    <div className="text-[8px] text-text-dim mt-0.5">{y.year}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border pt-2 max-h-40 overflow-auto">
            <table className="w-full text-[10px] font-mono">
              <thead className="text-text-dim text-[9px] uppercase">
                <tr>
                  <th className="text-left py-0.5">Año</th>
                  <th className="text-right">Ore</th>
                  <th className="text-right">Waste</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">CF</th>
                  <th className="text-right">CF acum.</th>
                </tr>
              </thead>
              <tbody>
                {result.years.map((y) => (
                  <tr key={y.year} className="border-t border-border/40">
                    <td className="py-0.5">{y.year}</td>
                    <td className="text-right">{y.ore_tonnes > 0 ? fmtT(y.ore_tonnes) : "—"}</td>
                    <td className="text-right">
                      {y.waste_tonnes > 0 ? fmtT(y.waste_tonnes) : "—"}
                    </td>
                    <td className="text-right">
                      {y.revenue_usd > 0 ? fmtUsd(y.revenue_usd) : "—"}
                    </td>
                    <td
                      className={
                        "text-right " +
                        (y.cashflow_usd >= 0 ? "text-signal-cyan" : "text-signal-red")
                      }
                    >
                      {fmtUsd(y.cashflow_usd)}
                    </td>
                    <td className="text-right">{fmtUsd(y.cumulative_cashflow_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-text-dim uppercase tracking-wide text-[9px]">{label}</span>
      <span className={highlight ? "text-signal-cyan" : "text-foreground"}>{value}</span>
    </div>
  );
}
