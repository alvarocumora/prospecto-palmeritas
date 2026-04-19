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
      <div className="absolute top-3 right-3 z-[1100] flex flex-col gap-2 items-end pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 bg-bg-secondary/95 border border-border rounded backdrop-blur p-1.5 shadow-lg">
          <button
            onClick={() => { setActive((a) => !a); cleanup(); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono font-semibold transition-colors ${
              active ? "bg-gold text-bg-primary" : "text-foreground hover:bg-accent"
            }`}
            aria-pressed={active}
            title="Dibuja una línea de sección haciendo dos clicks en el mapa"
          >
            <Scissors className="w-3.5 h-3.5" />
            {active ? "Click 2 puntos…" : "Sección"}
          </button>
          <label className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            ±
            <input
              type="number"
              min={5}
              max={500}
              step={5}
              value={maxOffset}
              onChange={(e) => setMaxOffset(Math.max(5, Number(e.target.value) || 50))}
              className="w-12 px-1 py-0.5 bg-background border border-border rounded text-foreground"
            />
            m
          </label>
          {section && (
            <>
              <button onClick={() => setShowView(true)} className="text-[10px] font-mono text-info hover:underline">Ver sección</button>
              <button onClick={clearAll} className="text-muted-foreground hover:text-destructive p-0.5" aria-label="Limpiar"><X className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
        {active && (
          <div className="pointer-events-none text-[10px] font-mono bg-gold text-bg-primary px-2 py-1 rounded shadow">
            {startRef.current ? "Click 2 (fin)" : "Click 1 (inicio)"} · ESC cancela
          </div>
        )}
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
