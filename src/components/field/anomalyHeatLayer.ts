// Anomaly heatmap + structural lineaments layers for the public field map.
// leaflet.heat is imported dynamically so it only ships when toggled on.
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type {
  Lineament,
  MagAnomalyPoint,
  SatAnomalyPoint,
} from "@/lib/livemap-public.functions";

type LeafletNS = typeof import("leaflet");
type HeatLayer = LayerGroup & {
  setLatLngs: (points: Array<[number, number, number]>) => void;
};

const HEAT_GRADIENT: Record<number, string> = {
  0.0: "#1e3a8a",
  0.3: "#0ea5e9",
  0.5: "#facc15",
  0.7: "#fb923c",
  1.0: "#dc2626",
};

const SEVERITY_WEIGHT: Record<string, number> = {
  low: 0.35,
  medium: 0.6,
  high: 0.95,
};

export async function buildAnomalyHeatLayer(
  L: LeafletNS,
  map: LeafletMap,
  mag: MagAnomalyPoint[],
  sat: SatAnomalyPoint[],
): Promise<LayerGroup> {
  // Dynamic import so the plugin only loads when needed.
  await import("leaflet.heat");

  const magVals = mag.map((m) => Math.abs(m.mag_nt));
  const maxMag = magVals.length ? Math.max(...magVals) : 1;

  const points: Array<[number, number, number]> = [];
  for (const m of mag) {
    const w = maxMag > 0 ? Math.min(1, Math.abs(m.mag_nt) / maxMag) : 0.5;
    points.push([m.lat, m.lng, Math.max(0.4, w)]);
  }
  for (const s of sat) {
    const w = (SEVERITY_WEIGHT[s.severity] ?? 0.5) * Math.max(0.3, s.score || 0.5);
    points.push([s.lat, s.lng, w]);
  }

  // @ts-expect-error leaflet.heat augments L at runtime
  const heat = L.heatLayer(points, {
    radius: 38,
    blur: 28,
    maxZoom: 17,
    minOpacity: 0.35,
    gradient: HEAT_GRADIENT,
  }) as HeatLayer;
  heat.addTo(map);
  return heat;
}

export function buildLineamentsLayer(
  L: LeafletNS,
  map: LeafletMap,
  lineaments: Lineament[],
): LayerGroup {
  const group = L.layerGroup();
  for (const l of lineaments) {
    if (l.path.length < 2) continue;
    // Outer glow (orange halo)
    L.polyline(l.path, {
      color: "#fb923c",
      weight: 7,
      opacity: 0.35,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
    }).addTo(group);
    // Inner bright yellow "vein"
    const inner = L.polyline(l.path, {
      color: "#facc15",
      weight: 2.5,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round",
    });
    inner.bindPopup(
      `<div style="font-family:monospace;font-size:11px;min-width:160px">
        <div style="color:#facc15;font-weight:700">Lineamiento estructural</div>
        <div style="color:#A89080;margin-top:4px">Severidad: ${l.severity}</div>
        <div style="color:#A89080">Score: ${(l.score * 100).toFixed(0)}%</div>
      </div>`,
    );
    inner.addTo(group);
  }
  group.addTo(map);
  return group;
}

export function removeLayer(map: LeafletMap, layer: LayerGroup | null) {
  if (!layer) return;
  try {
    map.removeLayer(layer);
  } catch {
    /* noop */
  }
}
