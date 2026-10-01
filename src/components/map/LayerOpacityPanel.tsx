import { useEffect } from "react";
import { Eye, EyeOff, Layers, X } from "lucide-react";
import type { Layer, Map as LeafletMap, TileLayer } from "leaflet";
import type { LayerStateMap } from "@/hooks/useLayerState";
import { EvidenceBadge } from "@/components/ui-system";
import {
  resolveGeoLayer,
  type CanonicalGeoLayerId,
  type GeoLayerDomain,
} from "@/lib/geospatial/layerRegistry";

export type ManagedLayer = {
  id: string;
  label: string;
  group:
    | "Basemap"
    | "Geología Chile"
    | "Satelital"
    | "Geología"
    | "Geofísica"
    | "Catastro"
    | "Proyecto"
    | "Datos externos";
  layer: Layer;
  /** Optional direct canonical id. Legacy ids are otherwise resolved through the registry aliases. */
  canonicalId?: CanonicalGeoLayerId;
  /** If true, only one layer in this legacy runtime group can be visible (radio behavior). */
  exclusive?: boolean;
};

interface Props {
  open: boolean;
  onClose: () => void;
  map: LeafletMap | null;
  layers: ManagedLayer[];
  state: LayerStateMap;
  onVisible: (id: string, visible: boolean) => void;
  onOpacity: (id: string, opacity: number) => void;
  presetLabel?: string;
}

const DOMAIN_ORDER: readonly GeoLayerDomain[] = [
  "basemap",
  "territory",
  "remote_sensing",
  "geology",
  "geophysics",
  "geochemistry",
  "sampling",
  "targets",
  "drilling",
  "models",
];

const DOMAIN_LABEL: Record<GeoLayerDomain, string> = {
  basemap: "Base",
  territory: "Territorio",
  remote_sensing: "Satélite / teledetección",
  geology: "Geología",
  geophysics: "Geofísica",
  geochemistry: "Geoquímica",
  sampling: "Muestreo",
  targets: "Targets",
  drilling: "Sondajes",
  models: "Modelos",
};

function setLayerOpacity(layer: Layer, opacity: number) {
  const tl = layer as TileLayer & { setOpacity?: (v: number) => void };
  if (typeof tl.setOpacity === "function") {
    tl.setOpacity(opacity);
    return;
  }

  const lg = layer as Layer & { eachLayer?: (fn: (l: Layer) => void) => void };
  if (typeof lg.eachLayer === "function") {
    lg.eachLayer((sub) => {
      const child = sub as TileLayer & {
        setStyle?: (style: { opacity: number; fillOpacity: number }) => void;
        setOpacity?: (value: number) => void;
      };
      if (typeof child.setStyle === "function") {
        child.setStyle({ opacity, fillOpacity: opacity * 0.5 });
      } else if (typeof child.setOpacity === "function") {
        child.setOpacity(opacity);
      }
    });
  }
}

function canonicalMeta(layer: ManagedLayer) {
  return resolveGeoLayer(layer.canonicalId ?? layer.id);
}

export function LayerOpacityPanel({
  open,
  onClose,
  map,
  layers,
  state,
  onVisible,
  onOpacity,
  presetLabel = "Official Geo Workbench",
}: Props) {
  useEffect(() => {
    if (!map) return;
    for (const managed of layers) {
      const layerState = state[managed.id];
      const visible = layerState?.visible ?? false;
      const opacity = layerState?.opacity ?? 1;
      const has = map.hasLayer(managed.layer);
      if (visible && !has) managed.layer.addTo(map);
      if (!visible && has) map.removeLayer(managed.layer);
      if (visible) setLayerOpacity(managed.layer, opacity);
    }
  }, [map, layers, state]);

  if (!open) return null;

  const sections = [
    ...DOMAIN_ORDER.map((domain) => ({
      key: `domain:${domain}`,
      label: DOMAIN_LABEL[domain],
      items: layers.filter((layer) => canonicalMeta(layer)?.domain === domain),
    })),
    ...Array.from(
      new Set(layers.filter((layer) => !canonicalMeta(layer)).map((layer) => layer.group)),
    )
      .sort()
      .map((group) => ({
        key: `legacy:${group}`,
        label: `Otros · ${group}`,
        items: layers.filter((layer) => !canonicalMeta(layer) && layer.group === group),
      })),
  ].filter((section) => section.items.length > 0);

  const handleToggle = (managed: ManagedLayer) => {
    const currentlyVisible = state[managed.id]?.visible ?? false;
    if (managed.exclusive && !currentlyVisible) {
      for (const other of layers) {
        if (other.group === managed.group && other.exclusive && other.id !== managed.id) {
          onVisible(other.id, false);
        }
      }
    }
    onVisible(managed.id, !currentlyVisible);
  };

  return (
    <div className="absolute top-2 right-2 z-[1000] max-h-[84vh] w-[22rem] overflow-y-auto rounded border border-border bg-background/95 p-3 font-mono text-xs shadow-xl backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-2">
        <div>
          <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide text-foreground">
            <Layers className="h-3.5 w-3.5" /> Geo Workbench
          </span>
          <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
            {presetLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {sections.map((section) => (
        <div key={section.key} className="mb-4">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground/80">
            {section.label}
          </div>
          <div className="space-y-2.5">
            {section.items.map((managed) => {
              const layerState = state[managed.id] ?? { visible: false, opacity: 1 };
              const meta = canonicalMeta(managed);
              const canonicalLabel = meta?.label ?? managed.label;
              const runtimeDetail = meta && managed.label !== meta.label ? managed.label : null;

              return (
                <div
                  key={managed.id}
                  className="rounded border border-border/70 bg-bg-secondary/45 p-2"
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggle(managed)}
                      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        layerState.visible
                          ? "border-gold bg-gold/20 text-gold"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                      title={layerState.visible ? "Ocultar" : "Mostrar"}
                    >
                      {layerState.visible ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <EyeOff className="h-3 w-3" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-medium leading-tight text-foreground">
                          {canonicalLabel}
                        </span>
                        <span className="w-8 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">
                          {Math.round(layerState.opacity * 100)}%
                        </span>
                      </div>

                      {runtimeDetail && (
                        <div className="mt-0.5 truncate text-[9px] text-muted-foreground">
                          {runtimeDetail}
                        </div>
                      )}

                      {meta ? (
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <EvidenceBadge kind={meta.evidence} scale={meta.scaleLabel} size="xs" />
                          <span className="text-[9px] text-muted-foreground">
                            {meta.sourceSystem}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                          legacy · pendiente de registrar
                        </div>
                      )}

                      {meta?.caution && layerState.visible && (
                        <div className="mt-1.5 text-[9px] leading-snug text-amber-600">
                          {meta.caution}
                        </div>
                      )}
                    </div>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(layerState.opacity * 100)}
                    onChange={(event) => onOpacity(managed.id, Number(event.target.value) / 100)}
                    disabled={!layerState.visible}
                    className="mt-2 h-1 w-full accent-gold disabled:opacity-40"
                    aria-label={`Opacidad ${canonicalLabel}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
