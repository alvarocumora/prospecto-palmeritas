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

const DOMAIN_LABEL: Partial<Record<GeoLayerDomain, string>> = {
  territory: "Tenencia minera",
  remote_sensing: "Relieve y teledetección",
  geology: "Geología estructural",
  geophysics: "Geofísica y espectral",
  sampling: "Muestreo",
  targets: "Targets",
  drilling: "Sondajes",
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
}: {
  mode: GeoSceneMode;
  enabled: ReadonlySet<string>;
  open: boolean;
  onClose: () => void;
  onToggle: (id: CanonicalGeoLayerId) => void;
  extraLayerIds?: readonly CanonicalGeoLayerId[];
  opacity?: Readonly<Record<string, number>>;
  onOpacity?: (id: string, value: number) => void;
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
  const domains = Array.from(new Set(definitions.map((definition) => definition.domain)));

  return (
    <div data-theme="im-light" className="absolute left-3 top-3 z-30 flex max-h-[calc(100%-5rem)] w-[min(20rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded border border-hairline bg-surface/95 text-xs text-content shadow-lg backdrop-blur">
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
      {domains.map((domain) => (
        <details key={domain} open className="group mb-2 border-b border-hairline pb-2 last:border-0">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {DOMAIN_LABEL[domain] ?? domain}
            <span className="transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="space-y-2">
            {definitions
              .filter((definition) => definition.domain === domain)
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
                      className={`h-auto w-full block whitespace-normal rounded border p-2 text-left transition-colors ${
                        active
                          ? "border-accent-brand/50 bg-accent-brand-subtle"
                          : "border-hairline bg-transparent hover:border-content/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-medium leading-tight text-foreground">
                          {definition.label}
                        </span>
                        <span
                          className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                            active ? "bg-accent-brand" : "bg-muted-foreground/30"
                          }`}
                        />
                      </div>
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
                      {definition.caution && active && (
                        <div className="mt-1.5 text-[9px] leading-snug text-amber-600">
                          {definition.caution}
                        </div>
                      )}
                    </BrandButton>
                    {active && onOpacity && definition.domain === "remote_sensing" && (
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
        </div>
      ))}
    </div>
  );
}
