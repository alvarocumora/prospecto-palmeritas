import type { LayerGroup } from "leaflet";
import type { LeafletNS } from "./types";
import { EXPIRY_COLORS, expiryStatus, daysUntilExpiry, type MiningConcession } from "@/hooks/useMiningConcessions";

function popupHtml(c: MiningConcession): string {
  const status = expiryStatus(c.expires_at);
  const days = daysUntilExpiry(c.expires_at);
  const color = EXPIRY_COLORS[status];
  const daysTxt =
    days === null ? "—" : days < 0 ? `vencida hace ${Math.abs(days)}d` : `${days}d restantes`;
  return `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;min-width:200px">
      <div style="font-weight:700;font-size:12px;margin-bottom:4px">${escape(c.code)} — ${escape(c.name)}</div>
      <div style="color:#6b7280">Titular: ${escape(c.holder ?? "—")}</div>
      <div style="color:#6b7280">Tipo: ${escape(c.concession_type)}</div>
      <div style="color:#6b7280">Superficie: ${c.area_ha ?? "—"} ha</div>
      <div style="margin-top:4px;padding:2px 6px;background:${color}22;border-left:3px solid ${color};color:${color};font-weight:600">
        ${escape(c.expires_at ?? "Sin fecha")} · ${daysTxt}
      </div>
      ${c.notes ? `<div style="margin-top:4px;color:#444">${escape(c.notes)}</div>` : ""}
    </div>
  `;
}

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (m) =>
    m === "&" ? "&amp;" : m === "<" ? "&lt;" : m === ">" ? "&gt;" : m === '"' ? "&quot;" : "&#39;"
  );
}

export function buildConcessionsLayer(
  L: LeafletNS,
  concessions: MiningConcession[]
): LayerGroup {
  const group = L.layerGroup();
  for (const c of concessions) {
    if (!c.geometry_geojson) continue;
    const status = expiryStatus(c.expires_at);
    const color = EXPIRY_COLORS[status];
    const isPending = c.status === "en_tramite";
    try {
      const layer = L.geoJSON(c.geometry_geojson as never, {
        style: () => ({
          color,
          weight: 2,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.18,
          dashArray: isPending ? "6 4" : undefined,
        }),
      });
      layer.bindPopup(popupHtml(c));
      group.addLayer(layer);
    } catch (e) {
      console.warn("Concession geom inválida", c.code, e);
    }
  }
  return group;
}
