import { useEffect } from "react";
import { Eye, EyeOff, Layers, X } from "lucide-react";
import type { Layer, Map as LeafletMap, TileLayer } from "leaflet";
import type { LayerStateMap } from "@/hooks/useLayerState";

export type ManagedLayer = {
  id: string;
  label: string;
  group: "Basemap" | "Geología" | "Geofísica" | "Catastro" | "Proyecto";
  layer: Layer;
  /** If true, only one layer in this group can be visible (radio behavior). */
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
}

function setLayerOpacity(layer: Layer, opacity: number) {
  const tl = layer as TileLayer & { setOpacity?: (v: number) => void };
  if (typeof tl.setOpacity === "function") {
    tl.setOpacity(opacity);
    return;
  }
  // GeoJSON / FeatureGroup / LayerGroup
  const lg = layer as Layer & { eachLayer?: (fn: (l: Layer) => void) => void };
  if (typeof lg.eachLayer === "function") {
    lg.eachLayer((sub) => {
      const s = sub as TileLayer & {
        setStyle?: (st: { opacity: number; fillOpacity: number }) => void;
        setOpacity?: (v: number) => void;
      };
      if (typeof s.setStyle === "function") {
        s.setStyle({ opacity, fillOpacity: opacity * 0.5 });
      } else if (typeof s.setOpacity === "function") {
        s.setOpacity(opacity);
      }
    });
  }
}

export function LayerOpacityPanel({
  open,
  onClose,
  map,
  layers,
  state,
  onVisible,
  onOpacity,
}: Props) {
  // Sync visibility & opacity to actual Leaflet layers
  useEffect(() => {
    if (!map) return;
    for (const ml of layers) {
      const st = state[ml.id];
      const visible = st?.visible ?? false;
      const opacity = st?.opacity ?? 1;
      const has = map.hasLayer(ml.layer);
      if (visible && !has) ml.layer.addTo(map);
      if (!visible && has) map.removeLayer(ml.layer);
      if (visible) setLayerOpacity(ml.layer, opacity);
    }
  }, [map, layers, state]);

  if (!open) return null;

  const groups = ["Basemap", "Geología", "Geofísica", "Catastro", "Proyecto"] as const;

  const handleToggle = (ml: ManagedLayer) => {
    const currentlyVisible = state[ml.id]?.visible ?? false;
    if (ml.exclusive && !currentlyVisible) {
      // Turn off other exclusive layers in same group
      for (const other of layers) {
        if (other.group === ml.group && other.exclusive && other.id !== ml.id) {
          onVisible(other.id, false);
        }
      }
    }
    onVisible(ml.id, !currentlyVisible);
  };

  return (
    <div className="absolute top-2 right-2 z-[1000] w-72 max-h-[80vh] overflow-y-auto rounded border border-border bg-background/95 backdrop-blur shadow-lg p-3 text-xs font-mono">
      <div className="flex items-center justify-between mb-2">
        <span className="text-foreground font-semibold uppercase tracking-wide inline-flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" /> Capas y opacidad
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {groups.map((group) => {
        const items = layers.filter((l) => l.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group} className="mb-3">
            <div className="text-[10px] uppercase text-muted-foreground/70 mb-1.5">{group}</div>
            <div className="space-y-2">
              {items.map((ml) => {
                const st = state[ml.id] ?? { visible: false, opacity: 1 };
                return (
                  <div key={ml.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggle(ml)}
                        className={`w-5 h-5 inline-flex items-center justify-center rounded border ${
                          st.visible
                            ? "border-gold bg-gold/20 text-gold"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                        title={st.visible ? "Ocultar" : "Mostrar"}
                      >
                        {st.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                      <span className="flex-1 text-foreground truncate" title={ml.label}>
                        {ml.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                        {Math.round(st.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(st.opacity * 100)}
                      onChange={(e) => onOpacity(ml.id, Number(e.target.value) / 100)}
                      disabled={!st.visible}
                      className="w-full h-1 accent-gold disabled:opacity-40"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
