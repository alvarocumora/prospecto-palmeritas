import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Layers3, ShieldCheck } from "lucide-react";
import { EvidenceBadge } from "@/components/ui-system";
import {
  isCertificationEvidence,
  type PublicGeoManifest,
} from "@/lib/geospatial/publicGeoContract";
import type { CanonicalGeoLayerId } from "@/lib/geospatial/layerRegistry";

export function PublicGeoLayerControls({
  manifest,
  available,
  visible,
  certificationMode,
  onToggleLayer,
  onToggleCertification,
  compact = false,
  opacity,
  onOpacity,
  counts,
  tree = false,
  terrain,
  sections = [],
}: {
  manifest: PublicGeoManifest;
  available: ReadonlySet<string>;
  visible: ReadonlySet<string>;
  certificationMode: boolean;
  onToggleLayer: (id: CanonicalGeoLayerId) => void;
  onToggleCertification: () => void;
  compact?: boolean;
  opacity?: Readonly<Partial<Record<CanonicalGeoLayerId, number>>>;
  onOpacity?: (id: CanonicalGeoLayerId, opacity: number) => void;
  counts?: Readonly<Partial<Record<CanonicalGeoLayerId, number>>>;
  tree?: boolean;
  terrain?: {
    visible: boolean;
    opacity: number;
    onToggle: () => void;
    onOpacity: (opacity: number) => void;
  };
  sections?: Array<{ id: string; label: string; children: ReactNode }>;
}) {
  const [expanded, setExpanded] = useState(tree);
  const [search, setSearch] = useState("");
  const layers = manifest.layers.filter(
    (layer) =>
      available.has(layer.id) &&
      (layer.label + " " + layer.sourceSystem)
        .toLocaleLowerCase("es")
        .includes(search.toLocaleLowerCase("es")),
  );

  return (
    <div
      className={`max-w-[calc(100vw-3rem)] rounded border border-border bg-background/95 p-2.5 shadow-lg backdrop-blur ${tree ? "max-h-[calc(100%-1.5rem)] overflow-y-auto" : ""} ${compact ? "w-[18rem]" : "w-[21rem]"}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-foreground"
      >
        <Layers3 className="h-3.5 w-3.5 text-gold" />
        <span className="flex-1 text-left">
          {tree ? "Árbol del proyecto" : "Capas de evidencia"}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
      {expanded && (
        <>
          <div className="my-2 flex flex-wrap items-center gap-2 border-y border-border py-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar capas"
              placeholder="Buscar capas"
              className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[11px]"
            />
            <button
              type="button"
              onClick={onToggleCertification}
              aria-pressed={certificationMode}
              className={`inline-flex items-center gap-1 rounded border px-2 py-1 font-mono text-[9px] uppercase ${certificationMode ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600" : "border-border text-muted-foreground"}`}
              title="Mostrar sólo evidencia oficial, certificada o medida"
            >
              <ShieldCheck className="h-3 w-3" /> Evidencia primaria
            </button>
          </div>
          <div className="max-h-[45vh] space-y-1.5 overflow-y-auto pr-1">
            {terrain && (
              <section className="rounded border border-border p-2">
                <h3 className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Superficie
                </h3>
                <label className="flex items-center gap-2 text-[10px] text-foreground">
                  <input
                    type="checkbox"
                    checked={terrain.visible}
                    onChange={terrain.onToggle}
                    aria-label="Mostrar topografía DEM Copernicus"
                  />
                  <span className="flex-1">Topografía · DEM Copernicus GLO-30</span>
                  <EvidenceBadge kind="OFICIAL" scale="~30 m" size="xs" />
                </label>
                <label className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                  Opacidad
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={terrain.opacity}
                    onChange={(event) => terrain.onOpacity(Number(event.target.value))}
                    aria-label="Opacidad de la topografía DEM Copernicus"
                    className="min-w-0 flex-1 accent-gold"
                  />
                  <span className="w-7 text-right tabular-nums">
                    {Math.round(terrain.opacity * 100)}%
                  </span>
                </label>
              </section>
            )}
            {layers.length === 0 && (
              <p className="text-[11px] text-muted-foreground">Sin capas para esta búsqueda.</p>
            )}
            {(tree ? Array.from(new Set(layers.map((layer) => layer.domain))) : [null]).map(
              (domain) => (
                <section key={domain ?? "all-layers"}>
                  {domain && (
                    <h3 className="border-b border-border px-1 pt-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      {DOMAIN_LABELS[domain]}
                    </h3>
                  )}
                  {layers
                    .filter((layer) => domain == null || layer.domain === domain)
                    .map((layer) => {
                      const blocked = certificationMode && !isCertificationEvidence(layer.evidence);
                      const active = visible.has(layer.id) && !blocked;
                      return (
                        <div
                          key={layer.id}
                          className={`rounded border p-2 ${active ? "border-gold/50 bg-gold/5" : "border-border bg-background/40 text-muted-foreground"}`}
                        >
                          <button
                            type="button"
                            onClick={() => onToggleLayer(layer.id)}
                            disabled={blocked}
                            aria-pressed={active}
                            className="w-full text-left disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[10px] font-medium leading-tight text-foreground">
                                {layer.label}
                                {counts?.[layer.id] != null && ` · ${counts[layer.id]}`}
                              </span>
                              <span
                                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${active ? "bg-gold" : "bg-muted-foreground/30"}`}
                              />
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <EvidenceBadge
                                kind={layer.evidence}
                                scale={layer.scaleLabel}
                                size="xs"
                              />
                              <span className="font-mono text-[9px] text-muted-foreground">
                                {layer.sourceSystem}
                              </span>
                            </div>
                          </button>
                          {onOpacity && (
                            <label className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                              Opacidad
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                disabled={!active}
                                value={opacity?.[layer.id] ?? 1}
                                aria-label={`Opacidad de ${layer.label}`}
                                onChange={(event) =>
                                  onOpacity(layer.id, Number(event.target.value))
                                }
                                className="min-w-0 flex-1 accent-gold"
                              />
                              <span className="w-7 text-right tabular-nums">
                                {Math.round((opacity?.[layer.id] ?? 1) * 100)}%
                              </span>
                            </label>
                          )}
                          {layer.caution && active && (
                            <div className="mt-1.5 text-[9px] leading-snug text-amber-600">
                              {layer.caution}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </section>
              ),
            )}
            {sections.map((section) => (
              <details key={section.id} className="rounded border border-border p-2">
                <summary className="cursor-pointer font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </summary>
                <div className="mt-2">{section.children}</div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const DOMAIN_LABELS: Record<string, string> = {
  territory: "Tenencia y territorio",
  remote_sensing: "Teledetección",
  geology: "Geología",
  geophysics: "Geofísica",
  geochemistry: "Geoquímica",
  sampling: "Muestreo y ensayes",
  targets: "Targets",
  drilling: "Sondajes y trazas",
  models: "Modelos",
  basemap: "Cartografía base",
};
