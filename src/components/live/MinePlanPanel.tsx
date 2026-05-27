// Panel del plan de explotación conceptual con cubicación por fase.
// Click en fase emite `losverdes:focus` para centrar el visor 3D.
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers3, TrendingUp, Pickaxe, Mountain } from "lucide-react";
import type { MinePlanPhasePublic } from "@/lib/losverdes-veins.functions";
import { emitLosVerdesFocus } from "@/lib/losverdes-focus";

function fmtUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}k`;
  return `${sign}$${a.toFixed(0)}`;
}
function fmtT(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} Mt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)} kt`;
  return `${v.toFixed(0)} t`;
}

const METHOD_LABEL: Record<string, { label: string; icon: typeof Pickaxe; color: string }> = {
  heap_leach: { label: "Heap Leach", icon: Layers3, color: "#22d3ee" },
  open_pit: { label: "Open Pit", icon: Mountain, color: "#f59e0b" },
  underground: { label: "Subterránea", icon: Pickaxe, color: "#a855f7" },
};

export function MinePlanPanel({ phases }: { phases: MinePlanPhasePublic[] }) {
  if (!phases.length) {
    return (
      <Card className="p-4 bg-bg-secondary border-border">
        <div className="text-[11px] font-mono text-muted-foreground">
          Sin fases de plan minero cargadas.
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-4 bg-bg-secondary border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-mono uppercase tracking-wider text-foreground/90 flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-gold" /> Plan de explotación conceptual
        </h3>
        <Badge variant="outline" className="text-[10px] font-mono">
          {phases.length} fases
        </Badge>
      </div>
      <div className="space-y-2">
        {phases.map((p) => {
          const meta = METHOD_LABEL[p.method ?? ""] ?? { label: p.method ?? "—", icon: Pickaxe, color: "#64748b" };
          const Icon = meta.icon;
          const c = p.cubication;
          const ring = p.area_polygon?.coordinates?.[0];
          const onClick = () => {
            if (!ring || ring.length === 0) return;
            let lat = 0, lng = 0;
            for (const [x, y] of ring) { lng += x; lat += y; }
            lng /= ring.length;
            lat /= ring.length;
            emitLosVerdesFocus({
              kind: "target",
              id: `phase-${p.phase_no}`,
              label: p.name,
              lat,
              lng,
              source: "fieldmap",
            });
          };
          return (
            <button
              key={p.id}
              onClick={onClick}
              className="w-full text-left border border-border/60 rounded p-2.5 bg-background/40 hover:border-gold/60 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} />
                  <span className="font-mono text-[11px] text-gold">F{p.phase_no}</span>
                  <span className="text-xs text-foreground/90 truncate">{p.name}</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[9px] font-mono"
                  style={{ borderColor: meta.color, color: meta.color }}
                >
                  {meta.label}
                </Badge>
              </div>
              {c && (
                <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono">
                  <Mini label="Tonelaje" value={fmtT(c.tonnes)} />
                  <Mini label="Revenue" value={fmtUsd(c.revenueUsd)} />
                  <Mini label="CAPEX" value={fmtUsd(c.capexUsd)} />
                  <Mini
                    label="NPV @8%"
                    value={fmtUsd(c.npvUsd)}
                    highlight={c.npvUsd > 0}
                    danger={c.npvUsd < 0}
                  />
                </div>
              )}
              <div className="text-[9px] font-mono text-muted-foreground mt-1.5">
                Y{p.start_year}–Y{(p.start_year ?? 0) + (p.duration_years ?? 0)} ·{" "}
                {(p.recovery_pct ?? 0).toFixed(0)}% rec · ${(p.opex_usd_t ?? 0).toFixed(1)}/t opex
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function Mini({
  label, value, highlight, danger,
}: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground text-[9px] uppercase">{label}</span>
      <b className={highlight ? "text-emerald-400" : danger ? "text-rose-400" : "text-foreground"}>
        {value}
      </b>
    </div>
  );
}
