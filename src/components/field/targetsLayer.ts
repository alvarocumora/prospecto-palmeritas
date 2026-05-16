import type { LayerGroup } from "leaflet";
import type { ExplorationTarget, TargetPriority } from "@/hooks/useExplorationTargets";

type LeafletNS = typeof import("leaflet");

type FieldTargetsLayerOptions = {
  onSelect?: (target: ExplorationTarget) => void;
};

const PRIORITY_COLORS: Record<TargetPriority, string> = {
  low: "#94a3b8",
  medium: "#38bdf8",
  high: "#facc15",
  critical: "#ef4444",
};

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function popupHtml(target: ExplorationTarget) {
  const score = target.score != null ? Number(target.score).toFixed(0) : "—";
  const coords = target.lat != null && target.lng != null ? `${target.lat.toFixed(5)}, ${target.lng.toFixed(5)}` : "—";
  return `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;min-width:210px">
      <div style="font-weight:700;margin-bottom:4px;color:#F0C96B">${escapeHtml(target.code)} — ${escapeHtml(target.name)}</div>
      <div style="color:#A89080">Prioridad: ${escapeHtml(target.priority)}</div>
      <div style="color:#A89080">Etapa: ${escapeHtml(target.stage)}</div>
      <div style="color:#A89080">Score: ${score}</div>
      <div style="color:#A89080">Commodity: ${escapeHtml(target.commodity)}</div>
      <div style="color:#A89080">Coords: ${coords}</div>
      ${target.rationale ? `<div style="margin-top:5px;color:#CDB8A8">${escapeHtml(target.rationale)}</div>` : ""}
    </div>
  `;
}

export function buildFieldTargetsLayer(
  L: LeafletNS,
  targets: ExplorationTarget[],
  options: FieldTargetsLayerOptions = {},
): LayerGroup {
  const group = L.layerGroup();

  for (const target of targets) {
    if (target.lat == null || target.lng == null) continue;

    const color = PRIORITY_COLORS[target.priority];
    const radius = target.priority === "critical" ? 10 : target.priority === "high" ? 8 : 6;

    const marker = L.circleMarker([target.lat, target.lng], {
      radius,
      color: "#0b0a09",
      weight: 2,
      fillColor: color,
      fillOpacity: 0.95,
    });

    marker.bindPopup(popupHtml(target));
    marker.on("click", () => options.onSelect?.(target));
    marker.addTo(group);

    if (target.priority === "critical" || target.priority === "high") {
      L.circle([target.lat, target.lng], {
        radius: target.priority === "critical" ? 120 : 80,
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.08,
      }).addTo(group);
    }
  }

  return group;
}
