import { Layers, Mountain, Sparkles, Loader2 } from "lucide-react";
import type { TargetGeologyEvidence } from "@/lib/targetContext/geologyEvidence";

type Props = {
  loading?: boolean;
  error?: string | null;
  data: TargetGeologyEvidence | null;
  radiusM?: number;
  compact?: boolean;
};

const CONF_COLOR: Record<"high" | "medium" | "low", string> = {
  high: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  medium: "text-gold border-gold/40 bg-gold/10",
  low: "text-muted-foreground border-border bg-muted/20",
};

function confidenceFromDistance(d: number, r: number): "high" | "medium" | "low" {
  if (d <= r * 0.25) return "high";
  if (d <= r * 0.6) return "medium";
  return "low";
}

export function GeologicalEvidenceSummary({
  loading,
  error,
  data,
  radiusM = 1500,
  compact = false,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-md border border-border bg-bg-secondary p-4 inline-flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Evaluando contexto geológico…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs font-mono text-destructive">
        Error al cargar geología: {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/10 p-3 text-xs font-mono text-muted-foreground">
        El target no tiene coordenadas; no es posible calcular evidencia geológica.
      </div>
    );
  }

  const empty = data.hostRocks.length === 0 && data.alterations.length === 0;

  return (
    <section className="rounded-md border border-border bg-card p-4 space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-gold" /> Geological Evidence Summary
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Features dentro de{" "}
            {radiusM >= 1000 ? `${(radiusM / 1000).toFixed(1)} km` : `${radiusM} m`} del target ·{" "}
            {data.nearby.length} elementos
          </div>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {data.hostRocks.length} host · {data.alterations.length} alt
        </span>
      </header>

      {empty ? (
        <div className="text-xs font-mono text-muted-foreground py-2">
          Sin host rock ni alteraciones mapeadas dentro del radio.
        </div>
      ) : (
        <div className={compact ? "space-y-3" : "grid md:grid-cols-2 gap-3"}>
          {data.hostRocks.length > 0 && (
            <div className="rounded border border-border bg-background p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5 mb-2">
                <Mountain className="w-3 h-3 text-amber-500" /> Host rock
              </div>
              <ul className="space-y-1.5">
                {data.hostRocks.map((h) => {
                  const conf = confidenceFromDistance(h.minDistanceM, radiusM);
                  return (
                    <li key={h.unit.id} className="flex items-start gap-2 text-xs">
                      <span
                        className="w-2.5 h-2.5 rounded-sm mt-0.5 shrink-0"
                        style={{ background: h.unit.color_hex ?? "#a8794d" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-mono font-semibold truncate">
                          {h.unit.name}{" "}
                          <span className="text-muted-foreground font-normal">
                            · {h.unit.unit_code}
                          </span>
                        </div>
                        {(h.unit.rock_type || h.unit.formation || h.unit.age) && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {[h.unit.rock_type, h.unit.formation, h.unit.age]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${CONF_COLOR[conf]}`}
                        title={`${h.count} feature(s) · más cercano ≈ ${Math.round(h.minDistanceM)} m`}
                      >
                        ≥{Math.round(h.minDistanceM)}m
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {data.alterations.length > 0 && (
            <div className="rounded border border-border bg-background p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5 mb-2">
                <Layers className="w-3 h-3 text-purple-400" /> Alteración
              </div>
              <ul className="space-y-1.5">
                {data.alterations.map((a) => {
                  const conf = confidenceFromDistance(a.minDistanceM, radiusM);
                  return (
                    <li key={a.unit.id} className="flex items-start gap-2 text-xs">
                      <span
                        className="w-2.5 h-2.5 rounded-sm mt-0.5 shrink-0"
                        style={{ background: a.unit.color_hex ?? "#c08aff" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-mono font-semibold truncate">
                          {a.unit.name}{" "}
                          <span className="text-muted-foreground font-normal">
                            · {a.unit.zone_code}
                          </span>
                        </div>
                        {(a.unit.assemblage || a.unit.intensity) && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {[a.unit.assemblage, a.unit.intensity].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${CONF_COLOR[conf]}`}
                        title={`${a.count} feature(s) · más cercano ≈ ${Math.round(a.minDistanceM)} m`}
                      >
                        ≥{Math.round(a.minDistanceM)}m
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
