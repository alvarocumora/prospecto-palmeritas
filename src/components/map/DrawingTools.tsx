import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2, Download, X, Square, Minus, MapPin } from "lucide-react";
import type { FeatureGroup, Map as LeafletMap } from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import "leaflet-draw/dist/leaflet.draw.css";
import type { LeafletNS } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  map: LeafletMap | null;
  L: LeafletNS | null;
}

type DrawTool = "polygon" | "polyline" | "marker" | null;

export function DrawingTools({ open, onClose, map, L }: Props) {
  const groupRef = useRef<FeatureGroup | null>(null);
  const activeHandlerRef = useRef<{ disable: () => void } | null>(null);
  const [activeTool, setActiveTool] = useState<DrawTool>(null);
  const [count, setCount] = useState(0);

  // Initialize FeatureGroup once
  useEffect(() => {
    if (!map || !L || groupRef.current) return;
    const fg = L.featureGroup().addTo(map);
    groupRef.current = fg;

    const updateCount = () => setCount(fg.getLayers().length);

    // Leaflet Draw events
    map.on(
      "draw:created" as never,
      ((e: { layer: L.Layer }) => {
        fg.addLayer(e.layer);
        updateCount();
        setActiveTool(null);
        activeHandlerRef.current = null;
      }) as never,
    );

    map.on("draw:deleted" as never, updateCount as never);
    map.on("draw:edited" as never, updateCount as never);

    return () => {
      // Cleanup if necessary, but keeping group across remounts is preferred
    };
  }, [map, L]);

  const startDraw = (tool: Exclude<DrawTool, null>) => {
    if (!map || !L) return;
    activeHandlerRef.current?.disable();
    type DrawHandler = { enable: () => void; disable: () => void };
    type DrawCtor = new (m: LeafletMap, opts?: unknown) => DrawHandler;
    type DrawNS = { Polygon: DrawCtor; Polyline: DrawCtor; Marker: DrawCtor };
    const Draw = (L as unknown as { Draw: DrawNS }).Draw;
    let handler: DrawHandler;

    if (tool === "polygon") {
      handler = new Draw.Polygon(map, { shapeOptions: { color: "#F5A524", weight: 2 } });
    } else if (tool === "polyline") {
      handler = new Draw.Polyline(map, {
        shapeOptions: { color: "#E11D48", weight: 3, dashArray: "5 5" },
      });
    } else {
      handler = new Draw.Marker(map);
    }

    handler.enable();
    activeHandlerRef.current = handler;
    setActiveTool(tool);
  };

  const cancelDraw = () => {
    activeHandlerRef.current?.disable();
    activeHandlerRef.current = null;
    setActiveTool(null);
  };

  const clearAll = () => {
    groupRef.current?.clearLayers();
    setCount(0);
  };

  const exportGeoJSON = () => {
    const fg = groupRef.current;
    if (!fg) return;
    const fc = fg.toGeoJSON() as FeatureCollection<Geometry>;
    if (fc.features.length === 0) return;

    // Tag features with a source label
    fc.features = fc.features.map((f: Feature, i: number) => ({
      ...f,
      properties: { ...(f.properties ?? {}), drawn_at: new Date().toISOString(), feature_index: i },
    }));

    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `palmeras-features-${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Esc to cancel
  useEffect(() => {
    if (!activeTool) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDraw();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTool]);

  if (!open) return null;

  const btn = (tool: Exclude<DrawTool, null>, icon: React.ReactNode, label: string) => {
    const active = activeTool === tool;
    return (
      <button
        type="button"
        onClick={() => (active ? cancelDraw() : startDraw(tool))}
        className={`w-full inline-flex items-center gap-2 px-2 py-1.5 rounded border ${
          active
            ? "border-gold bg-gold/10 text-gold"
            : "border-border bg-bg-secondary text-foreground hover:bg-accent"
        } transition-colors`}
      >
        {icon}
        {active ? `${label} (Esc)` : label}
      </button>
    );
  };

  return (
    <div className="absolute top-2 left-14 z-[1000] w-64 rounded border border-border bg-background/95 backdrop-blur shadow-lg p-3 text-xs font-mono space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-foreground font-semibold uppercase tracking-wide inline-flex items-center gap-1.5">
          <Pencil className="w-3.5 h-3.5" /> Dibujo
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

      <div className="space-y-1.5">
        {btn("polygon", <Square className="w-3.5 h-3.5" />, "Polígono AOI")}
        {btn("polyline", <Minus className="w-3.5 h-3.5" />, "Línea geofísica")}
        {btn("marker", <MapPin className="w-3.5 h-3.5" />, "Punto / Sondaje")}
      </div>

      <div className="border-t border-border pt-2 space-y-1.5">
        <div className="text-[10px] text-muted-foreground">
          Features dibujadas: <strong className="text-foreground">{count}</strong>
        </div>
        <button
          type="button"
          onClick={exportGeoJSON}
          disabled={count === 0}
          className="w-full inline-flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-bg-secondary text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Exportar GeoJSON
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={count === 0}
          className="w-full inline-flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-bg-secondary text-muted-foreground hover:text-destructive disabled:opacity-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Limpiar todo
        </button>
      </div>
    </div>
  );
}
