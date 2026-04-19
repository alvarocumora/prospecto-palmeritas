import type { LayerGroup } from "leaflet";
import type { LeafletNS } from "./types";
import type { ExplorationTarget, TargetPriority, TargetStage } from "@/hooks/useExplorationTargets";

const PRIORITY_COLOR: Record<TargetPriority, string> = {
  critical: "#dc2626",
  high: "#F0C96B",
  medium: "#3b82f6",
  low: "#94a3b8",
};

const PRIORITY_RADIUS: Record<TargetPriority, number> = {
  critical: 12,
  high: 10,
  medium: 8,
  low: 7,
};

const STAGE_LABEL: Record<TargetStage, string> = {
  generated: "Generado",
  validated: "Validado",
  drill_ready: "Listo perforar",
  drilling: "Perforando",
  drilled: "Perforado",
  closed: "Cerrado",
};

export type TargetClickHandler = (t: ExplorationTarget) => void;

export function buildTargetsLayer(
  L: LeafletNS,
  targets: ExplorationTarget[],
  opts?: { onClick?: TargetClickHandler },
): LayerGroup {
  const group = L.layerGroup();
  for (const t of targets) {
    if (t.lat == null || t.lng == null) continue;
    const color = PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.medium;
    const radius = PRIORITY_RADIUS[t.priority] ?? 8;
    const dimmed = t.stage === "closed";
    const opacity = dimmed ? 0.35 : 0.95;

    // Outer halo for critical/high
    if (t.priority === "critical" || t.priority === "high") {
      L.circleMarker([t.lat, t.lng], {
        radius: radius + 6,
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
    const popupHtml = `
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:240px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};"></span>
          <strong style="color:#F0C96B;">${t.code}</strong>
          <span style="color:#A89080;">${STAGE_LABEL[t.stage]}</span>
        </div>
        <div style="color:#E8DDD0;font-weight:600;">${t.name}</div>
        <div style="color:#A89080;margin-top:2px;">
          ${t.target_type}${t.commodity ? ` · ${t.commodity}` : ""}${t.score != null ? ` · score ${t.score}` : ""}
        </div>
        ${t.rationale ? `<div style="margin-top:6px;color:#C8B8A8;font-style:italic;">${t.rationale}</div>` : ""}
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #3a322c;color:#A89080;font-size:10px;">
          ${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}${t.elevation_m != null ? ` · ${t.elevation_m} m` : ""}
        </div>
      </div>`;
    marker.bindPopup(popupHtml);
    if (opts?.onClick) {
      marker.on("click", () => opts.onClick?.(t));
    }
    marker.addTo(group);
  }
  return group;
}
