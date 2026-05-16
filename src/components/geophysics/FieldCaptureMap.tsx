import { useEffect, useRef } from "react";
import type { Station, Line } from "@/hooks/useGeophysicsCRUD";

type Props = {
  userLat: number | null;
  userLng: number | null;
  accuracy: number | null;
  projectCenter: { lat: number; lng: number } | null;
  stations: Station[];
  lines: Line[];
};

export function FieldCaptureMap({
  userLat,
  userLng,
  accuracy,
  projectCenter,
  stations,
  lines,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const userMarkerRef = useRef<unknown>(null);
  const accuracyCircleRef = useRef<unknown>(null);
  const stationsLayerRef = useRef<unknown>(null);
  const linesLayerRef = useRef<unknown>(null);

  // init map
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;
      const center: [number, number] =
        userLat != null && userLng != null
          ? [userLat, userLng]
          : projectCenter
            ? [projectCenter.lat, projectCenter.lng]
            : [-33.45, -70.66];
      const map = L.map(containerRef.current, {
        center,
        zoom: 16,
        zoomControl: true,
        attributionControl: false,
      });
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 20 },
      ).addTo(map);
      stationsLayerRef.current = L.layerGroup().addTo(map);
      linesLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
    };
  }, [projectCenter, userLat, userLng]);

  // update user marker + accuracy
  useEffect(() => {
    if (typeof window === "undefined") return;
    const map = mapRef.current as {
      setView: (c: [number, number], z?: number) => void;
      removeLayer: (l: unknown) => void;
      getZoom: () => number;
    } | null;
    if (!map || userLat == null || userLng == null) return;
    (async () => {
      const L = await import("leaflet");
      if (userMarkerRef.current) map.removeLayer(userMarkerRef.current);
      if (accuracyCircleRef.current) map.removeLayer(accuracyCircleRef.current);
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 2px #3b82f6,0 0 12px rgba(59,130,246,.7);animation:pulse-dot 2s infinite"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      userMarkerRef.current = L.marker([userLat, userLng], { icon }).addTo(map as unknown as L.Map);
      if (accuracy != null) {
        accuracyCircleRef.current = L.circle([userLat, userLng], {
          radius: accuracy,
          color: "#3b82f6",
          weight: 1,
          fillOpacity: 0.08,
        }).addTo(map as unknown as L.Map);
      }
      map.setView([userLat, userLng], Math.max(map.getZoom(), 16));
    })();
  }, [userLat, userLng, accuracy]);

  // render stations + lines
  useEffect(() => {
    if (typeof window === "undefined") return;
    const map = mapRef.current as L.Map | null;
    if (!map) return;
    (async () => {
      const L = await import("leaflet");
      const sLayer = stationsLayerRef.current as L.LayerGroup | null;
      const lLayer = linesLayerRef.current as L.LayerGroup | null;
      if (sLayer) {
        sLayer.clearLayers();
        stations.forEach((s) => {
          L.circleMarker([s.lat, s.lng], {
            radius: 5,
            color: "#fbbf24",
            weight: 2,
            fillColor: "#fbbf24",
            fillOpacity: 0.7,
          })
            .bindTooltip(s.station_id, { direction: "top" })
            .addTo(sLayer);
        });
      }
      if (lLayer) {
        lLayer.clearLayers();
        lines.forEach((ln) => {
          const coords = ln.geometry_geojson?.coordinates ?? [];
          if (coords.length < 2) return;
          const latlngs = coords.map((c) => [c[1], c[0]] as [number, number]);
          L.polyline(latlngs, { color: "#a78bfa", weight: 2, opacity: 0.8 }).addTo(lLayer);
        });
      }
    })();
  }, [stations, lines]);

  return <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden bg-muted" />;
}
