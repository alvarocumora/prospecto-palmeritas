import { useEffect, useRef, useState } from "react";
import type { PortfolioProject } from "@/lib/terminal.functions";

type Props = {
  projects: PortfolioProject[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function GeologicalMapPanel({ projects, selectedId, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const mapInstance = useRef<{
    L: typeof import("leaflet");
    map: import("leaflet").Map;
    markers: Map<string, import("leaflet").CircleMarker>;
  } | null>(null);

  // init map once
  useEffect(() => {
    let cleanup = false;
    (async () => {
      if (!ref.current || mapInstance.current) return;
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      const EL = await import("esri-leaflet");
      if (cleanup || !ref.current) return;
      const map = L.map(ref.current, {
        center: [-30, -70.5],
        zoom: 5,
        zoomControl: true,
        attributionControl: false,
      });
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 18 },
      ).addTo(map);

      // ligero overlay de concesiones nacionales
      try {
        EL.featureLayer({
          url: "https://services1.arcgisonline.com/OyjvVdFTl5hfSdX3/arcgis/rest/services/Marcelo_Layer/FeatureServer/2",
          minZoom: 9,
          precision: 5,
          simplifyFactor: 0.5,
          style: () => ({
            color: "oklch(0.78 0.13 78)",
            weight: 0.6,
            fillOpacity: 0.08,
          }),
        } as Parameters<typeof EL.featureLayer>[0]).addTo(map);
      } catch {
        /* ignore */
      }

      mapInstance.current = { L, map, markers: new Map() };
      setReady(true);
    })();
    return () => {
      cleanup = true;
      mapInstance.current?.map.remove();
      mapInstance.current = null;
    };
  }, []);

  // sync markers
  useEffect(() => {
    const inst = mapInstance.current;
    if (!inst) return;
    const { L, map, markers } = inst;
    // clear old
    markers.forEach((m) => m.remove());
    markers.clear();

    const valid = projects.filter((p) => p.center_lat != null && p.center_lng != null);
    valid.forEach((p) => {
      const marker = L.circleMarker([p.center_lat!, p.center_lng!], {
        radius: 7,
        color: "oklch(0.78 0.13 78)",
        weight: 2,
        fillColor: "oklch(0.78 0.13 78)",
        fillOpacity: selectedId === p.id ? 0.9 : 0.45,
      })
        .addTo(map)
        .bindTooltip(
          `<div style="font-family:ui-monospace,monospace;font-size:11px"><strong>${p.code}</strong> · ${p.name}<br/>${p.commodity ?? "—"} · ${p.region ?? "—"}</div>`,
        )
        .on("click", () => onSelect(p.id));
      markers.set(p.id, marker);
    });

  }, [projects, selectedId, onSelect, ready]);

  useEffect(() => {
    const inst = mapInstance.current;
    if (!ready || !inst) return;
    const { L, map } = inst;
    const valid = projects.filter((p) => p.center_lat != null && p.center_lng != null);
    if (valid.length > 0) {
      const bounds = L.latLngBounds(
        valid.map((p) => [p.center_lat!, p.center_lng!] as [number, number]),
      );
      map.fitBounds(bounds.pad(0.4), { maxZoom: 9, animate: false });
    }
  }, [projects, ready]);

  useEffect(() => {
    const project = projects.find((item) => item.id === selectedId);
    if (!ready || project?.center_lat == null || project.center_lng == null) return;
    mapInstance.current?.map.flyTo([project.center_lat, project.center_lng], 11);
  }, [projects, selectedId, ready]);

  return (
    <div className="relative h-full w-full bg-background">
      <div ref={ref} className="absolute inset-0" />
      <div className="absolute top-2 left-2 z-[400] px-2 py-1 bg-background/85 backdrop-blur border border-border rounded text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Geological map · {projects.filter((p) => p.center_lat != null).length} activos
      </div>
    </div>
  );
}
