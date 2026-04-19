import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Polyline, CircleMarker, LayerGroup } from "leaflet";
import type { LeafletNS } from "./types";
import { Scissors, X } from "lucide-react";
import { buildSectionLine, projectHolesToSection, type SectionLine, type ProjectedHole } from "@/lib/section/projection";
import type { DrillHole, DrillCoreLog } from "@/hooks/useDrilling";
import { SectionView } from "./SectionView";

interface Props {
  map: LeafletMap | null;
  L: LeafletNS | null;
  holes: DrillHole[];
  logsByHole: Record<string, DrillCoreLog[]>;
}

export function SectionBuilderTool({ map, L, holes, logsByHole }: Props) {
  const [active, setActive] = useState(false);
  const [maxOffset, setMaxOffset] = useState(50);
  const [section, setSection] = useState<SectionLine | null>(null);
  const [projected, setProjected] = useState<ProjectedHole[]>([]);
  const [showView, setShowView] = useState(false);
  const startRef = useRef<[number, number] | null>(null);
  const previewRef = useRef<Polyline | null>(null);
  const startMarkerRef = useRef<CircleMarker | null>(null);
  const lineGroupRef = useRef<LayerGroup | null>(null);

  const cleanup = () => {
    if (!map) return;
    if (previewRef.current) { map.removeLayer(previewRef.current); previewRef.current = null; }
    if (startMarkerRef.current) { map.removeLayer(startMarkerRef.current); startMarkerRef.current = null; }
    startRef.current = null;
  };

  const clearAll = () => {
    cleanup();
    if (map && lineGroupRef.current) {
      map.removeLayer(lineGroupRef.current);
      lineGroupRef.current = null;
    }
    setSection(null);
    setProjected([]);
  };

  useEffect(() => {
    if (!map || !L || !active) return;
    const container = map.getContainer();
    container.style.cursor = "crosshair";

    const onClick = (e: L.LeafletMouseEvent) => {
      const ll: [number, number] = [e.latlng.lat, e.latlng.lng];
      if (!startRef.current) {
        startRef.current = ll;
        startMarkerRef.current = L.circleMarker(ll, { radius: 6, color: "#C8922A", weight: 2, fillColor: "#C8922A", fillOpacity: 0.9 }).addTo(map);
        return;
      }
      // Second click → finalize section
      const line = buildSectionLine(startRef.current, ll);
      if (lineGroupRef.current) map.removeLayer(lineGroupRef.current);
      const group = L.layerGroup();
      L.polyline([line.start, line.end], { color: "#C8922A", weight: 3, dashArray: "8,4", opacity: 0.95 }).addTo(group);
      L.circleMarker(line.start, { radius: 6, color: "#fff", weight: 2, fillColor: "#C8922A", fillOpacity: 1 }).bindTooltip("A", { permanent: true, direction: "top", offset: [0, -8] }).addTo(group);
      L.circleMarker(line.end, { radius: 6, color: "#fff", weight: 2, fillColor: "#C8922A", fillOpacity: 1 }).bindTooltip("A'", { permanent: true, direction: "top", offset: [0, -8] }).addTo(group);
      group.addTo(map);
      lineGroupRef.current = group;

      const ph = projectHolesToSection(holes, logsByHole, line, maxOffset);
      setSection(line);
      setProjected(ph);
      setShowView(true);
      setActive(false);
      cleanup();
    };

    const onMove = (e: L.LeafletMouseEvent) => {
      if (!startRef.current) return;
      const pts: [number, number][] = [startRef.current, [e.latlng.lat, e.latlng.lng]];
      if (previewRef.current) {
        previewRef.current.setLatLngs(pts);
      } else {
        previewRef.current = L.polyline(pts, { color: "#C8922A", weight: 2, dashArray: "4,4", opacity: 0.7 }).addTo(map);
      }
    };

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setActive(false); cleanup(); }
    };

    map.on("click", onClick);
    map.on("mousemove", onMove);
    window.addEventListener("keydown", onEsc);
    return () => {
      container.style.cursor = "";
      map.off("click", onClick);
      map.off("mousemove", onMove);
      window.removeEventListener("keydown", onEsc);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, map, L, holes, logsByHole, maxOffset]);

  return (
    <>
      {/* Section button slots into the right toolbar column */}
      <div className="absolute top-3 right-3 z-[500] pointer-events-none" style={{ marginTop: 184 }}>
        <div className="pointer-events-auto flex flex-col items-end gap-1.5">
          <button
            onClick={() => { setActive((a) => !a); cleanup(); }}
            className={`w-9 h-9 inline-flex items-center justify-center rounded border border-border backdrop-blur shadow-md transition-colors ${
              active ? "bg-gold text-bg-primary" : "bg-background/95 text-foreground hover:bg-accent"
            }`}
            aria-pressed={active}
            title="Sección 2D — click 2 puntos en el mapa"
          >
            <Scissors className="w-4 h-4" />
          </button>
          {(active || section) && (
            <div className="flex items-center gap-1.5 bg-background/95 border border-border rounded backdrop-blur px-2 py-1 shadow-md">
              <label className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                ±
                <input
                  type="number"
                  min={5}
                  max={500}
                  step={5}
                  value={maxOffset}
                  onChange={(e) => setMaxOffset(Math.max(5, Number(e.target.value) || 50))}
                  className="w-12 px-1 py-0.5 bg-bg-secondary border border-border rounded text-foreground"
                />
                m
              </label>
              {section && (
                <>
                  <button onClick={() => setShowView(true)} className="text-[10px] font-mono text-info hover:underline">Ver</button>
                  <button onClick={clearAll} className="text-muted-foreground hover:text-destructive p-0.5" aria-label="Limpiar"><X className="w-3.5 h-3.5" /></button>
                </>
              )}
            </div>
          )}
          {active && (
            <div className="text-[10px] font-mono bg-gold text-bg-primary px-2 py-1 rounded shadow">
              {startRef.current ? "Click 2 (fin)" : "Click 1 (inicio)"} · ESC cancela
            </div>
          )}
        </div>
      </div>

      {showView && section && (
        <SectionView
          line={section}
          holes={projected}
          maxOffsetM={maxOffset}
          onClose={() => setShowView(false)}
        />
      )}
    </>
  );
}
