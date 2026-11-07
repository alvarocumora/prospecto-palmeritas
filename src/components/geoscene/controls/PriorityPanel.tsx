import { useMemo } from "react";
import type { FeatureCollection } from "geojson";
import type { ResolvedProjectLayer } from "../projectLayers";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  priorityStats,
  suggestedSamplePoints,
  type ExplorationPriority,
} from "../priority";

const SWATCH: Record<ExplorationPriority, string> = {
  P1: "rgb(196,106,52)",
  P2: "rgb(201,162,74)",
  P3: "rgb(120,130,150)",
};

/** Filtro P1/P2/P3 común a todos los visores, con recuento y superficie. */
export function PriorityPanel({
  layers,
  active,
  onChange,
}: {
  layers: ResolvedProjectLayer[];
  active: ReadonlySet<ExplorationPriority>;
  onChange: (next: ReadonlySet<ExplorationPriority>) => void;
}) {
  const stats = useMemo(() => {
    const total = priorityStats(undefined);
    for (const l of layers) {
      const s = priorityStats(l.data as FeatureCollection);
      for (const p of PRIORITIES) {
        total[p].count += s[p].count;
        total[p].ha += s[p].ha;
      }
    }
    return total;
  }, [layers]);
  const toggle = (p: ExplorationPriority) => {
    const next = new Set(active);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    onChange(next.size ? next : new Set(PRIORITIES));
  };
  const p1 = stats.P1.ha;
  return (
    <section
      data-theme="im-light"
      aria-label="Prioridades de exploración"
      className="absolute right-3 top-3 z-20 w-[min(15rem,calc(100%-1.5rem))] rounded border border-hairline bg-surface/95 p-2.5 text-content shadow backdrop-blur"
    >
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        Prioridades · interpretado
      </p>
      <div className="mt-1.5 space-y-1">
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={active.has(p)}
            onClick={() => toggle(p)}
            className={`flex min-h-9 w-full items-center gap-2 rounded border px-2 text-left text-[11px] transition-opacity ${
              active.has(p) ? "border-hairline" : "border-transparent opacity-40"
            }`}
          >
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: SWATCH[p] }} />
            <span className="font-mono">{p}</span>
            <span>{PRIORITY_LABEL[p]}</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {stats[p].count}
              {stats[p].ha > 0 && ` · ${Math.round(stats[p].ha).toLocaleString("es-CL")} ha`}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange(new Set<ExplorationPriority>(["P1"]))}
        className="mt-1.5 min-h-8 w-full rounded bg-accent-brand px-2 font-mono text-[10px] uppercase tracking-wider text-primary-foreground"
      >
        Ver solo P1
      </button>
      {p1 > 0 && (
        <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
          Malla sugerida 200 × 200 m sobre P1: ~{suggestedSamplePoints(p1)} puntos. Propuesta de
          terreno; no mide ley ni recurso.
        </p>
      )}
    </section>
  );
}
