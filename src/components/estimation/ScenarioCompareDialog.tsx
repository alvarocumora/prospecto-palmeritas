import { useState } from "react";
import type { EconomicScenario } from "@/hooks/useEconomicScenarios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GitCompare } from "lucide-react";

function fmtUsd(v: number | null): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}
function fmtT(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} Mt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)} kt`;
  return `${v.toFixed(0)} t`;
}

export function ScenarioCompareDialog({
  open,
  onClose,
  scenarios,
}: {
  open: boolean;
  onClose: () => void;
  scenarios: EconomicScenario[];
}) {
  const completed = scenarios.filter((s) => s.status === "complete");
  const [selected, setSelected] = useState<string[]>(completed.slice(0, 3).map((s) => s.id));

  const chosen = completed.filter((s) => selected.includes(s.id));
  const bestNpv = Math.max(...chosen.map((s) => s.npv_usd ?? -Infinity));

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 5),
    );

  const rows: Array<[string, (s: EconomicScenario) => string, (s: EconomicScenario) => number | null]> = [
    ["NPV", (s) => fmtUsd(s.npv_usd), (s) => s.npv_usd],
    ["IRR", (s) => (s.irr_pct != null ? `${s.irr_pct.toFixed(1)}%` : "—"), (s) => s.irr_pct],
    ["EBITDA", (s) => fmtUsd(s.ebitda_usd), (s) => s.ebitda_usd],
    ["Mineral", (s) => fmtT(s.ore_tonnes), (s) => s.ore_tonnes],
    ["Estéril", (s) => fmtT(s.waste_tonnes), () => null],
    ["Strip", (s) => (s.strip_ratio != null ? s.strip_ratio.toFixed(2) : "—"), () => null],
    ["Vida (a)", (s) => `${s.mine_life_years ?? "—"}`, () => null],
    ["Payback (a)", (s) => `${s.payback_years ?? "—"}`, () => null],
    ["Cutoff", (s) => (s.nsr_cutoff_usd_t != null ? `$${s.nsr_cutoff_usd_t.toFixed(1)}/t` : "—"), () => null],
    ["Precio", (s) => `$${s.commodity_price_usd.toFixed(2)}`, () => null],
    ["Recovery", (s) => `${s.recovery_pct}%`, () => null],
    ["Capex", (s) => fmtUsd(s.capex_usd), () => null],
    ["Descuento", (s) => `${s.discount_rate_pct}%`, () => null],
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-signal-cyan" />
            Comparar escenarios económicos
          </DialogTitle>
        </DialogHeader>

        {completed.length === 0 ? (
          <div className="text-text-dim text-xs font-mono py-6 text-center">
            No hay escenarios completados para comparar.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 pb-2 border-b border-border">
              {completed.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-1.5 text-[10px] font-mono cursor-pointer border border-border/60 rounded px-2 py-1 hover:bg-background/60"
                >
                  <Checkbox
                    checked={selected.includes(s.id)}
                    onCheckedChange={() => toggle(s.id)}
                  />
                  {s.name}
                </label>
              ))}
              <div className="text-[9px] text-text-dim self-center ml-2">Máx 5</div>
            </div>

            {chosen.length === 0 ? (
              <div className="text-text-dim text-xs font-mono py-6 text-center">
                Selecciona escenarios arriba.
              </div>
            ) : (
              <div className="overflow-auto max-h-[60vh] border border-border rounded">
                <table className="w-full text-[10px] font-mono">
                  <thead className="sticky top-0 bg-card border-b border-border">
                    <tr>
                      <th className="px-2 py-1 text-left text-text-dim">Métrica</th>
                      {chosen.map((s) => (
                        <th key={s.id} className="px-2 py-1 text-right">
                          {s.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([label, fmt, num]) => (
                      <tr key={label} className="border-b border-border/40">
                        <td className="px-2 py-1 text-text-dim">{label}</td>
                        {chosen.map((s) => {
                          const n = num(s);
                          const isBest =
                            label === "NPV" && n != null && n === bestNpv && chosen.length > 1;
                          return (
                            <td
                              key={s.id}
                              className={`px-2 py-1 text-right ${isBest ? "text-signal-cyan font-bold" : ""}`}
                            >
                              {fmt(s)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
