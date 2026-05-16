import type { LayerGroup } from "leaflet";
import type { ExplorationTarget, TargetPriority } from "@/hooks/useExplorationTargets";

type LeafletNS = typeof import("leaflet");

const PRIORITY_COLOR: Record<TargetPriority, string> = {
  critical: "#dc2626",
  high: "#F0C96B",
  medium: "#3b82f6",
  low: "#94a3b8",
};

const PRIORITY_RADIUS: Record<TargetPriority, number> = {
  critical: 10,
  high: 9,
  medium: 7,
  low: 6,
};

export type FieldTargetClickHandler = (t: ExplorationTarget) => void;

/**
 * Field-optimized targets layer (smaller markers, halo for critical/high,
 * compact mobile popup). Closed targets are dimmed.
 */
export function buildFieldTargetsLayer(
  L: LeafletNS,
  targets: ExplorationTarget[],
  opts?: { onClick?: FieldTargetClickHandler },
): LayerGroup {
  const group = L.layerGroup();
  for (const t of targets) {
    if (t.lat == null || t.lng == null) continue;
    const color = PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.medium;
    const radius = PRIORITY_RADIUS[t.priority] ?? 7;
    const dimmed = t.stage === "closed";
    const opacity = dimmed ? 0.35 : 0.95;

    if (t.priority === "critical" || t.priority === "high") {
      L.circleMarker([t.lat, t.lng], {
        radius: radius + 5,
        color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.1,
        opacity: opacity * 0.6,
        interactive: false,
      }).addTo(group);
    }

    const marker = L.circleMarker([t.lat, t.lng], {
      radius,
      color: "#0b0a09",
      weight: 2,
      fillColor: color,
      fillOpacity: opacity,
      opacity: 1,
    });
    marker.bindPopup(
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;min-width:160px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
          <strong style="color:#F0C96B">${t.code}</strong>
        </div>
        <div style="color:#E8DDD0;font-weight:600">${t.name}</div>
        <div style="color:#A89080;margin-top:2px">
          ${t.target_type}${t.commodity ? ` · ${t.commodity}` : ""}${t.score != null ? ` · ${t.score}` : ""}
        </div>
      </div>`,
    );
    if (opts?.onClick) marker.on("click", () => opts.onClick?.(t));
    marker.addTo(group);
  }
  return group;
}
