import type { LayerGroup } from "leaflet";
import type { LeafletNS } from "@/components/map/types";
import { FIELD_POI_TYPES, type FieldPoi, type FieldPoiType } from "@/hooks/useFieldPois";

const TYPE_COLOR: Record<FieldPoiType, string> = Object.fromEntries(
  FIELD_POI_TYPES.map((t) => [t.value, t.color]),
) as Record<FieldPoiType, string>;

const TYPE_LABEL: Record<FieldPoiType, string> = Object.fromEntries(
  FIELD_POI_TYPES.map((t) => [t.value, t.label]),
) as Record<FieldPoiType, string>;

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (m) =>
    m === "&" ? "&amp;" : m === "<" ? "&lt;" : m === ">" ? "&gt;" : m === '"' ? "&quot;" : "&#39;",
  );
}

export function buildFieldPoisLayer(
  L: LeafletNS,
  pois: FieldPoi[],
  opts?: { onDelete?: (id: string) => void },
): LayerGroup {
  const group = L.layerGroup();
  for (const p of pois) {
    const color = TYPE_COLOR[p.poi_type] ?? "#a8a29e";
    const marker = L.circleMarker([p.lat, p.lng], {
      radius: 8,
      color: "#0b0a09",
      weight: 2,
      fillColor: color,
      fillOpacity: 0.9,
      opacity: 1,
    });
    const date = new Date(p.created_at).toLocaleString("es-CL", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const html = `
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:240px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};"></span>
          <strong style="color:#F0C96B;">${escape(TYPE_LABEL[p.poi_type] ?? p.poi_type)}</strong>
        </div>
        <div style="color:#E8DDD0;font-weight:600;">${escape(p.title)}</div>
        ${p.note ? `<div style="margin-top:4px;color:#C8B8A8;">${escape(p.note)}</div>` : ""}
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #3a322c;color:#A89080;font-size:10px;">
          ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}${p.accuracy_m != null ? ` · ±${Math.round(p.accuracy_m)}m` : ""}${p.elevation_m != null ? ` · ${Math.round(p.elevation_m)} msnm` : ""}
        </div>
        <div style="color:#A89080;font-size:10px;">${date}</div>
        ${p.photo_path ? `<div style="margin-top:4px;color:#A89080;font-size:10px;">📷 Foto adjunta</div>` : ""}
        ${opts?.onDelete ? `<button data-poi-del="${p.id}" style="margin-top:6px;padding:4px 8px;border:1px solid #3a322c;background:transparent;color:#dc2626;font-size:10px;font-family:inherit;cursor:pointer;border-radius:3px;">Eliminar</button>` : ""}
      </div>`;
    marker.bindPopup(html);
    if (opts?.onDelete) {
      marker.on("popupopen", (ev) => {
        const popupNode = (ev as { popup: { getElement: () => HTMLElement | null } }).popup.getElement();
        const btn = popupNode?.querySelector<HTMLButtonElement>(`[data-poi-del="${p.id}"]`);
        if (btn) {
          btn.addEventListener("click", () => opts.onDelete?.(p.id), { once: true });
        }
      });
    }
    marker.addTo(group);
  }
  return group;
}
