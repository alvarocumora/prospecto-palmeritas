import type { LayerGroup } from "leaflet";
import type { LeafletNS } from "./types";
import type { ProspectivityCell } from "@/hooks/useProspectivity";

// Color ramp viridis-ish: low=blue, mid=yellow, high=red
function scoreColor(s: number): string {
  // s in 0..100
  const t = Math.max(0, Math.min(1, s / 100));
  if (t < 0.25) return "#1e3a8a";       // deep blue
  if (t < 0.45) return "#0891b2";       // cyan
  if (t < 0.6)  return "#65a30d";       // green
  if (t < 0.75) return "#eab308";       // yellow
  if (t < 0.88) return "#ea580c";       // orange
  return "#dc2626";                     // red
}

export function buildProspectivityLayer(L: LeafletNS, cells: ProspectivityCell[]): LayerGroup {
  const group = L.layerGroup();
  if (!cells.length) return group;

  for (const c of cells) {
    const color = scoreColor(c.score);
    // Approximate cell as square in lat/lng degrees.
    const halfLat = c.cell_size_m / 2 / 111320;
    const halfLng = c.cell_size_m / 2 / (111320 * Math.cos((c.cell_lat * Math.PI) / 180));
    const bounds: [[number, number], [number, number]] = [
      [c.cell_lat - halfLat, c.cell_lng - halfLng],
      [c.cell_lat + halfLat, c.cell_lng + halfLng],
    ];
    const rect = L.rectangle(bounds, {
      color,
      weight: 0,
      fillColor: color,
      fillOpacity: 0.35 + 0.4 * (c.score / 100), // hotter = more opaque
      interactive: true,
    });
    const f = c.features as Record<string, unknown>;
    const nearest = (f.nearest_target ?? null) as { dist: number; score: number; priority: string } | null;
    rect.bindPopup(
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:240px;">
        <div style="color:#F0C96B;font-weight:600;margin-bottom:4px;">Prospectividad</div>
        <div style="font-size:18px;color:${color};font-weight:700;">Score ${c.score}/100</div>
        <div style="color:#A89080;margin-top:4px;">${c.cell_lat.toFixed(5)}, ${c.cell_lng.toFixed(5)}</div>
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #3a322c;color:#C8B8A8;">
          Targets a ≤1500 m: <b>${(f.targets_in_radius as number) ?? 0}</b><br/>
          ${nearest ? `Más cercano: ${nearest.priority} score ${nearest.score} a ${Math.round(nearest.dist)} m` : "Sin target cercano"}
        </div>
      </div>`,
    );
    rect.addTo(group);
  }
  return group;
}

export function prospectivityLegendHtml(): string {
  const stops = [
    { v: 95, c: "#dc2626", l: "Muy alto" },
    { v: 80, c: "#ea580c", l: "Alto" },
    { v: 65, c: "#eab308", l: "Medio-alto" },
    { v: 50, c: "#65a30d", l: "Medio" },
    { v: 35, c: "#0891b2", l: "Bajo" },
    { v: 15, c: "#1e3a8a", l: "Marginal" },
  ];
  return `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;line-height:1.5;">
    <div style="font-weight:600;color:#F0C96B;margin-bottom:4px;">Prospectividad IA</div>
    ${stops.map(s => `<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:14px;height:10px;background:${s.c};"></span>${s.v}+ ${s.l}</div>`).join("")}
  </div>`;
}
