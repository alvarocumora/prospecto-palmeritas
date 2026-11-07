import { Layers3, X } from "lucide-react";
import { EvidenceBadge } from "@/components/ui-system";
import {
  getGeoLayer,
  type CanonicalGeoLayerId,
  type GeoLayerDefinition,
  type GeoLayerDomain,
} from "@/lib/geospatial/layerRegistry";
import { sceneDefinitionsForMode } from "../layerPolicy";
import type { GeoSceneMode } from "../types";
import { BrandButton } from "@/components/brand";
import type { ResolvedProjectLayer } from "../projectLayers";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  priorityStats,
  suggestedSamplePoints,
  type ExplorationPriority,
} from "../priority";
import type { FeatureCollection } from "geojson";

/**
 * Árbol de proyecto estilo Leapfrog: agrupa los 8 dominios canónicos del
 * registro geoespacial en 5 carpetas de más alto nivel, solo para mostrar
 * este panel. El `domain` de cada capa no cambia en ningún otro lugar.
 */
const PROJECT_TREE_FOLDER: Record<GeoLayerDomain, string> = {
  basemap: "Superficie",
  territory: "Superficie",
  remote_sensing: "Superficie",
  geology: "Estructuras",
  geochemistry: "Geoquímica",
  sampling: "Geoquímica",
  targets: "Geoquímica",
  drilling: "Sondajes & Geofísica",
  geophysics: "Sondajes & Geofísica",
  models: "Modelos",
};

export function SceneLayerPanel({
  mode,
  enabled,
  open,
  onClose,
  onToggle,
  extraLayerIds,
  opacity,
  onOpacity,
  counts,
  priorityLayers,
  activePriorities,
  onPriorityChange,
  spectralLegend,
}: {
  mode: GeoSceneMode;
  enabled: ReadonlySet<string>;
  open: boolean;
  onClose: () => void;
  onToggle: (id: CanonicalGeoLayerId) => void;
  extraLayerIds?: readonly CanonicalGeoLayerId[];
  opacity?: Readonly<Record<string, number>>;
  onOpacity?: (id: string, value: number) => void;
  counts?: Readonly<Record<string, number>>;
  /** Capas con features P1/P2/P3 encendidas — alimenta el filtro de
   * prioridades integrado en la carpeta Geoquímica (sin tarjeta flotante). */
  priorityLayers?: readonly ResolvedProjectLayer[];
  activePriorities?: ReadonlySet<ExplorationPriority>;
  onPriorityChange?: (next: ReadonlySet<ExplorationPriority>) => void;
  /** Firmas espectrales activas — se muestran dentro de Superficie en vez de
   * flotar aparte, donde competían por espacio con la barra inferior. */
  spectralLegend?: readonly { label: string; color: [number, number, number] }[];
}) {
  if (!open) return null;

  const base = sceneDefinitionsForMode(mode);
  const extras =
    mode === "resource"
      ? []
      : (extraLayerIds ?? [])
          .map((id) => getGeoLayer(id))
          .filter((d): d is GeoLayerDefinition => d != null && !base.some((b) => b.id === d.id));
  const definitions = [...extras, ...base];
  const folders = Array.from(
    new Set(definitions.map((definition) => PROJECT_TREE_FOLDER[definition.domain])),
  );
  const hasPriorities = Boolean(priorityLayers?.length && activePriorities && onPriorityChange);
  const pStats = hasPriorities
    ? priorityLayers!.reduce((total, l) => {
        const s = priorityStats(l.data as FeatureCollection);
        for (const p of PRIORITIES) {
          total[p].count += s[p].count;
          total[p].ha += s[p].ha;
        }
        return total;
      }, priorityStats(undefined))
    : null;

  return (
    <div
      data-theme="im-light"
      className="absolute left-3 top-3 z-30 flex max-h-[calc(100%-5rem)] w-[min(20rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded border border-hairline bg-surface/95 text-xs text-content shadow-lg backdrop-blur"
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-hairline px-3 py-2.5">
        <div>
          <div className="inline-flex items-center gap-1.5 font-serif text-sm text-content">
            <Layers3 className="h-3.5 w-3.5" />
            Capas
          </div>
          <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
            GeoScene3D · {mode}
          </div>
        </div>
        <BrandButton
          variant="ghost"
          size="sm"
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cerrar capas 3D"
        >
          <X className="h-3.5 w-3.5" />
        </BrandButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {folders.map((folder) => (
          <details
            key={folder}
            open
            className="group mb-2 border-b border-hairline pb-2 last:border-0"
          >
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {folder}
              <span className="transition-transform group-open:rotate-90">›</span>
            </summary>
            {folder === "Geoquímica" && hasPriorities && pStats && (
              <PriorityFilter
                stats={pStats}
                active={activePriorities!}
                onChange={onPriorityChange!}
              />
            )}
            {folder === "Superficie" && spectralLegend && spectralLegend.length > 0 && (
              <SpectralLegend items={spectralLegend} />
            )}
            <div className="space-y-1.5">
              {definitions
                .filter((definition) => PROJECT_TREE_FOLDER[definition.domain] === folder)
                .map((definition) => {
                  const active = enabled.has(definition.id);
                  return (
                    <div key={definition.id} className="space-y-1">
                      <BrandButton
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => onToggle(definition.id as CanonicalGeoLayerId)}
                        aria-pressed={active}
                        className={`h-auto w-full block whitespace-normal rounded border p-1.5 text-left transition-colors ${
                          active
                            ? "border-accent-brand/50 bg-accent-brand-subtle"
                            : "border-hairline bg-transparent hover:border-content/30"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              active ? "bg-accent-brand" : "bg-muted-foreground/30"
                            }`}
                          />
                          <span className="flex-1 truncate text-[11px] font-medium leading-tight text-foreground">
                            {definition.label}
                          </span>
                          {counts?.[definition.id] != null && (
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                              {counts[definition.id].toLocaleString("es-CL")}
                            </span>
                          )}
                        </div>
                        {active && (
                          <>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <EvidenceBadge
                                kind={definition.evidence}
                                scale={definition.scaleLabel}
                                size="xs"
                              />
                              <span className="text-[9px] text-muted-foreground">
                                {definition.sourceSystem}
                              </span>
                            </div>
                            {definition.caution && (
                              <div className="mt-1.5 text-[9px] leading-snug text-amber-600">
                                {definition.caution}
                              </div>
                            )}
                          </>
                        )}
                      </BrandButton>
                      {active && onOpacity && counts?.[definition.id] != null && (
                        <label className="flex items-center gap-2 px-2 text-[9px] uppercase tracking-wider text-muted-foreground">
                          Opacidad
                          <input
                            type="range"
                            min={10}
                            max={100}
                            step={5}
                            value={Math.round((opacity?.[definition.id] ?? 1) * 100)}
                            onChange={(e) => onOpacity(definition.id, Number(e.target.value) / 100)}
                            aria-label={`Opacidad ${definition.label}`}
                            className="flex-1 accent-[hsl(var(--primary))]"
                          />
                          <span className="w-8 text-right font-mono">
                            {Math.round((opacity?.[definition.id] ?? 1) * 100)}%
                          </span>
                        </label>
                      )}
                    </div>
                  );
                })}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

/** Firmas espectrales activas — reemplaza el cuadro flotante que se montaba
 * sobre la barra de análisis inferior. */
function SpectralLegend({
  items,
}: {
  items: readonly { label: string; color: [number, number, number] }[];
}) {
  return (
    <div className="mb-2 rounded border border-hairline bg-surface/60 p-1.5 font-mono text-[9px]">
      <div className="mb-1 px-1 uppercase tracking-wider text-muted-foreground">
        Firmas espectrales · modeladas
      </div>
      <ul className="space-y-1 px-1">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-foreground">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: `rgb(${item.color.join(",")})` }}
            />
            {item.label}
          </li>
        ))}
      </ul>
      <p className="mt-1 px-1 leading-snug text-muted-foreground">
        Intensidad = opacidad del polígono. Hipótesis de priorización, no ensayes ni recursos.
      </p>
    </div>
  );
}

const PRIORITY_SWATCH: Record<ExplorationPriority, string> = {
  P1: "rgb(196,106,52)",
  P2: "rgb(201,162,74)",
  P3: "rgb(120,130,150)",
};

/** Filtro P1/P2/P3 integrado a la carpeta Geoquímica — reemplaza la tarjeta
 * flotante que se montaba sobre la cabecera del visor. */
function PriorityFilter({
  stats,
  active,
  onChange,
}: {
  stats: Record<ExplorationPriority, { count: number; ha: number }>;
  active: ReadonlySet<ExplorationPriority>;
  onChange: (next: ReadonlySet<ExplorationPriority>) => void;
}) {
  const toggle = (p: ExplorationPriority) => {
    const next = new Set(active);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    onChange(next.size ? next : new Set(PRIORITIES));
  };
  const p1 = stats.P1.ha;
  return (
    <div className="mb-2 rounded border border-hairline bg-surface/60 p-1.5">
      <p className="px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        Prospectividad · interpretado
      </p>
      <div className="mt-1 space-y-1">
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={active.has(p)}
            onClick={() => toggle(p)}
            className={`flex min-h-8 w-full items-center gap-2 rounded border px-2 text-left text-[11px] transition-opacity ${
              active.has(p) ? "border-hairline" : "border-transparent opacity-40"
            }`}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ background: PRIORITY_SWATCH[p] }}
            />
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
        className="mt-1 min-h-8 w-full rounded bg-accent-brand px-2 font-mono text-[10px] uppercase tracking-wider text-primary-foreground"
      >
        Ver solo P1
      </button>
      {p1 > 0 && (
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          Malla sugerida 200 × 200 m sobre P1: ~{suggestedSamplePoints(p1)} puntos. Propuesta de
          terreno; no mide ley ni recurso.
        </p>
      )}
    </div>
  );
}
