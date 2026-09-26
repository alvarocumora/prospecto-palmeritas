// Mapa de proyectos publicados. Client-only: carga leaflet dinámicamente.
// Colorea los pins por stage (exploration / advanced / etc.).
import { useEffect, useRef } from "react";
import type { Map as LMap, Marker as LMarker, LayerGroup } from "leaflet";
import type { PublicListing } from "@/lib/publicListings.functions";
import { MODALITY_LABEL, STAGE_LABEL } from "@/modules/deals/domain/constants";
import { fmtUSD } from "@/modules/deals/domain/format";

const STAGE_COLOR: Record<string, string> = {
  exploration: "#f59e0b", // amber
  advanced: "#0b2a5b", // brand deep
  development: "#059669",
  production: "#dc2626",
  greenfield: "#f59e0b",
  brownfield: "#0b2a5b",
};

const STAGE_LEGEND: Array<{ key: string; label: string; color: string }> = [
  { key: "exploration", label: "Exploración", color: STAGE_COLOR.exploration },
  { key: "advanced", label: "Avanzado", color: STAGE_COLOR.advanced },
  { key: "development", label: "Desarrollo", color: STAGE_COLOR.development },
  { key: "production", label: "Producción", color: STAGE_COLOR.production },
];

function pinSvg(color: string, featured: boolean) {
  const ring = featured
    ? `<circle cx="14" cy="14" r="13" fill="none" stroke="${color}" stroke-opacity="0.35" stroke-width="2"/>`
    : "";
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      ${ring}
      <circle cx="14" cy="14" r="8" fill="${color}" stroke="white" stroke-width="2.5"/>
      <circle cx="14" cy="14" r="2.5" fill="white"/>
    </svg>`;
}

export function ListingsMap({ listings }: { listings: PublicListing[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ default: L }] = await Promise.all([
        import("leaflet"),
        import("leaflet/dist/leaflet.css"),
      ]);
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        const map = L.map(containerRef.current, {
          scrollWheelZoom: false,
          zoomControl: true,
          attributionControl: true,
        }).setView([-32.5, -71], 5);
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 18,
            attribution: "Esri, HERE, Garmin © OpenStreetMap",
          },
        ).addTo(map);
        L.tileLayer(
          "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 18, opacity: 0.75 },
        ).addTo(map);
        mapRef.current = map;
        layerRef.current = L.layerGroup().addTo(map);
      }

      const map = mapRef.current!;
      const layer = layerRef.current!;
      layer.clearLayers();

      const markers: LMarker[] = [];
      for (const l of listings) {
        if (!l.centroid) continue;
        const [lng, lat] = l.centroid;
        const color = STAGE_COLOR[l.stage ?? ""] ?? "#64748b";
        const icon = L.divIcon({
          className: "listing-pin",
          html: pinSvg(color, l.is_featured),
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -12],
        });
        const price =
          l.modality === "royalty" && l.royalty_pct != null
            ? `${l.royalty_pct}% NSR`
            : fmtUSD(l.asking_price_usd);
        const popup = `
          <div style="font-family:inherit;min-width:220px">
            <div style="font-size:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:${color};margin-bottom:4px">
              ${STAGE_LABEL[l.stage ?? ""] ?? l.stage ?? "—"} · ${MODALITY_LABEL[l.modality ?? ""] ?? l.modality ?? ""}
            </div>
            <div style="font-weight:600;font-size:14px;color:#0f172a;line-height:1.3;margin-bottom:4px">${escapeHtml(l.title)}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:8px">
              ${[l.region, l.country]
                .filter((x): x is string => !!x)
                .map(escapeHtml)
                .join(", ")}${l.commodity ? " · " + escapeHtml(l.commodity) : ""}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding-top:6px;border-top:1px solid #e2e8f0">
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:600;color:#0f172a">${price}</span>
              <a href="/proyectos/${l.id}" style="font-size:11px;color:${color};text-decoration:none;font-weight:600">Ver ficha →</a>
            </div>
          </div>`;
        const m = L.marker([lat, lng], { icon }).bindPopup(popup).addTo(layer);
        markers.push(m);
      }

      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.35), { maxZoom: 8 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [listings]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-hairline bg-slate-900">
      <div ref={containerRef} className="h-[460px] w-full" />
      <div className="absolute top-3 left-3 z-[400] rounded-lg bg-white/95 backdrop-blur px-3 py-2 shadow-sm border border-hairline">
        <div className="text-[9px] font-mono uppercase tracking-widest text-content-subtle mb-1.5">
          Estado del proyecto
        </div>
        <ul className="space-y-1">
          {STAGE_LEGEND.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-[11px] text-content">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: s.color, boxShadow: "0 0 0 1.5px white" }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute bottom-3 right-3 z-[400] rounded-md bg-black/60 text-white text-[10px] font-mono px-2 py-1">
        {listings.filter((l) => l.centroid).length} proyectos georreferenciados
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
