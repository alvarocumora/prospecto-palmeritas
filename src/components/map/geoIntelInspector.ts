import type { Map as LeafletMap } from "leaflet";
import type { LeafletNS } from "./types";
import { wmsGetFeatureInfo } from "./sernageominLayers";
import type { ExplorationTarget } from "@/hooks/useExplorationTargets";

/**
 * Multi-source GeoIntel popup. On click, queries (in parallel):
 *   1. SERNAGEOMIN Geología 1:1M  → real Chilean lithology unit & age
 *   2. SERNAGEOMIN Yacimientos    → known nearby deposits (within bbox)
 *   3. Open-Elevation API         → elevation (m) at point
 *   4. Macrostrat (fallback)      → global geology unit
 *   5. Project targets            → nearest exploration target within 5 km
 */

type TargetGetter = () => ExplorationTarget[];

const fmt = (n: number, d = 4) => Number(n).toFixed(d);

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchElevation(lat: number, lng: number): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: Array<{ elevation?: number }> };
    return json.results?.[0]?.elevation ?? null;
  } catch {
    return null;
  }
}

async function fetchSernageominLitho(map: LeafletMap, lat: number, lng: number) {
  const size = map.getSize();
  const point = map.latLngToContainerPoint({ lat, lng } as never);
  const b = map.getBounds();
  const bbox = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
  return wmsGetFeatureInfo({
    baseUrl: "https://catastro.sernageomin.cl/arcgis/services/Geologia/Geologia_Base_1M/MapServer/WMSServer",
    layer: "0",
    bbox,
    width: size.x,
    height: size.y,
    x: point.x,
    y: point.y,
  });
}

async function fetchSernageominYacimientos(map: LeafletMap, lat: number, lng: number) {
  const size = map.getSize();
  const point = map.latLngToContainerPoint({ lat, lng } as never);
  const b = map.getBounds();
  const bbox = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
  return wmsGetFeatureInfo({
    baseUrl: "https://catastro.sernageomin.cl/arcgis/services/Mineria/Yacimientos/MapServer/WMSServer",
    layer: "0",
    bbox,
    width: size.x,
    height: size.y,
    x: point.x,
    y: point.y,
  });
}

function nearestTarget(targets: ExplorationTarget[], lat: number, lng: number) {
  let best: { t: ExplorationTarget; km: number } | null = null;
  for (const t of targets) {
    if (t.lat == null || t.lng == null) continue;
    const km = haversineKm([lat, lng], [t.lat, t.lng]);
    if (!best || km < best.km) best = { t, km };
  }
  return best;
}

export function wireGeoIntelClickPopup(
  L: LeafletNS,
  map: LeafletMap,
  fetchMacrostrat: (lat: number, lng: number) => Promise<Record<string, unknown> | undefined>,
  getTargets: TargetGetter,
) {
  map.on("click", async (e) => {
    const { lat, lng } = e.latlng;
    const popup = L.popup({ maxWidth: 340 })
      .setLatLng(e.latlng)
      .setContent(
        `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#A89080;">⏳ Consultando capas geocientíficas…</div>`,
      )
      .openOn(map);

    const [litho, yac, elev, macro] = await Promise.all([
      fetchSernageominLitho(map, lat, lng).catch(() => null),
      fetchSernageominYacimientos(map, lat, lng).catch(() => null),
      fetchElevation(lat, lng).catch(() => null),
      fetchMacrostrat(lat, lng).catch(() => undefined),
    ]);

    const near = nearestTarget(getTargets(), lat, lng);

    const sections: string[] = [];

    // Header
    sections.push(
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:320px;">
        <div style="color:#F0C96B;font-weight:600;font-size:12px;margin-bottom:4px;">📍 GeoIntel</div>
        <div style="color:#A89080;font-size:10px;margin-bottom:8px;">${fmt(lat, 5)}, ${fmt(lng, 5)}${elev != null ? ` · ${Math.round(elev)} m s.n.m.` : ""}</div>`,
    );

    // Lithology
    if (litho && Object.keys(litho).length > 0) {
      const name = (litho.NOMBRE_UNIDAD ?? litho.UNIDAD ?? litho.NAME ?? litho.LITOLOGIA ?? "Unidad geológica") as string;
      const edad = (litho.EDAD ?? litho.AGE ?? litho.PERIODO ?? "—") as string;
      const lit = (litho.LITOLOGIA ?? litho.ROCK_TYPE ?? "—") as string;
      sections.push(
        `<div style="border-top:1px solid #3a322c;padding-top:6px;margin-top:4px;">
          <div style="color:#F0C96B;font-weight:600;">🪨 ${name}</div>
          <div style="color:#C8B8A8;">Edad: ${edad}</div>
          <div style="color:#C8B8A8;">Litología: ${lit}</div>
          <div style="color:#A89080;font-size:9px;">SERNAGEOMIN 1:1M</div>
        </div>`,
      );
    } else if (macro) {
      const m = macro as Record<string, unknown>;
      const name = (m.name ?? m.unit_name ?? "Unidad Macrostrat") as string;
      const age = (m.age ?? m.b_age ?? "—") as string;
      const lith = (m.lith ?? m.lith_name ?? "—") as string;
      sections.push(
        `<div style="border-top:1px solid #3a322c;padding-top:6px;margin-top:4px;">
          <div style="color:#F0C96B;font-weight:600;">🪨 ${name}</div>
          <div style="color:#C8B8A8;">Edad: ${age}</div>
          <div style="color:#C8B8A8;">Litología: ${lith}</div>
          <div style="color:#A89080;font-size:9px;">Macrostrat (global)</div>
        </div>`,
      );
    } else {
      sections.push(
        `<div style="border-top:1px solid #3a322c;padding-top:6px;margin-top:4px;color:#A89080;">Sin información litológica en este punto</div>`,
      );
    }

    // Yacimiento conocido
    if (yac && Object.keys(yac).length > 0) {
      const name = (yac.NOMBRE ?? yac.NAME ?? yac.YACIMIENTO ?? "Yacimiento") as string;
      const sub = (yac.SUSTANCIA ?? yac.METAL ?? yac.PRODUCTO ?? "") as string;
      const estado = (yac.ESTADO ?? yac.STATUS ?? "") as string;
      sections.push(
        `<div style="border-top:1px solid #3a322c;padding-top:6px;margin-top:4px;">
          <div style="color:#F0C96B;font-weight:600;">⛏️ ${name}</div>
          ${sub ? `<div style="color:#C8B8A8;">Sustancia: ${sub}</div>` : ""}
          ${estado ? `<div style="color:#C8B8A8;">Estado: ${estado}</div>` : ""}
          <div style="color:#A89080;font-size:9px;">SERNAGEOMIN Yacimientos</div>
        </div>`,
      );
    }

    // Nearest project target
    if (near && near.km <= 5) {
      const t = near.t;
      sections.push(
        `<div style="border-top:1px solid #3a322c;padding-top:6px;margin-top:4px;">
          <div style="color:#F0C96B;font-weight:600;">🎯 Target cercano: ${t.code}</div>
          <div style="color:#C8B8A8;">${t.name}</div>
          <div style="color:#A89080;font-size:10px;">${t.target_type}${t.commodity ? ` · ${t.commodity}` : ""} · ${near.km.toFixed(2)} km</div>
        </div>`,
      );
    }

    sections.push(`</div>`);
    popup.setContent(sections.join(""));
  });
}
