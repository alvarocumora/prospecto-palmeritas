import type { LeafletNS } from "@/components/map/types";
import type { ReconciliationBundle } from "./reconciliationBundle";
import { reconciliationGeoJSON } from "./reconciliationBundle";

const STYLE = {
  EXACT_MATCH: { color: "#22c55e", fillColor: "#22c55e", weight: 3, fillOpacity: 0.18 },
  INTERSECTS: { color: "#f59e0b", fillColor: "#f59e0b", weight: 3, fillOpacity: 0.2 },
  NEIGHBOR: { color: "#38bdf8", fillColor: "#38bdf8", weight: 1.5, fillOpacity: 0.06, dashArray: "5 4" },
  UNMATCHED: { color: "#ef4444", fillColor: "#ef4444", weight: 3, fillOpacity: 0.16, dashArray: "8 4" },
} as const;

export function buildReconciliationLayer(L: LeafletNS, bundle: ReconciliationBundle) {
  return L.geoJSON(reconciliationGeoJSON(bundle) as never, {
    style: feature => STYLE[(feature?.properties?.GEOCAPITALS_STATE ?? "UNMATCHED") as keyof typeof STYLE],
    onEachFeature: (feature, layer) => {
      const p = (feature.properties ?? {}) as Record<string, unknown>;
      const el = document.createElement("div");
      el.style.cssText = "font-family:ui-monospace,monospace;font-size:11px;line-height:1.55";
      [
        ["GEOCAPITALS RECONCILIATION", p.GEOCAPITALS_STATE],
        ["Overlap", `${p.GEOCAPITALS_OVERLAP_HA ?? 0} ha · ${p.GEOCAPITALS_OVERLAP_PCT ?? 0}%`],
        ["Distancia", p.GEOCAPITALS_DISTANCE_KM == null ? "—" : `${p.GEOCAPITALS_DISTANCE_KM} km`],
        ["Razón", p.GEOCAPITALS_REASON],
      ].forEach(([k,v], i) => {
        const row = document.createElement(i === 0 ? "strong" : "div");
        row.textContent = `${k}: ${v ?? "—"}`;
        el.appendChild(row);
      });
      layer.bindPopup(el);
    },
  });
}
