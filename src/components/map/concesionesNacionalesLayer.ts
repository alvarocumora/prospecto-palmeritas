import type { LeafletNS, AnyFC } from "./types";
import type { GeoJSON as LeafletGeoJSON, Layer } from "leaflet";

/**
 * Capa nacional de concesiones mineras de Chile (SERNAGEOMIN).
 *
 * Estilo inspirado en propiedadminera.cl:
 *   - Verde: explotación vigente
 *   - Azul: exploración vigente
 *   - Amarillo: en trámite
 *   - Magenta: vencida o en remate
 *
 * Usa el endpoint ArcGIS REST de SERNAGEOMIN para obtener atributos reales
 * (titular, RUT, comuna, región, área, datum, vigencia) en GeoJSON, en vez
 * de un WMS visual sin atributos.
 *
 * NOTA: el servicio MapServer de SERNAGEOMIN expone capas 0..3:
 *   0 = Concesiones de Explotación
 *   1 = Concesiones de Exploración
 *   2 = Mensuras
 *   3 = Manifestaciones
 */

const ARCGIS_BASE =
  "https://catastro.sernageomin.cl/arcgis/rest/services/Concesiones_Mineras/Concesiones_Mineras/MapServer";

export type ConcesionTipo = "explotacion" | "exploracion" | "mensura" | "manifestacion";

const LAYER_BY_TIPO: Record<ConcesionTipo, number> = {
  explotacion: 0,
  exploracion: 1,
  mensura: 2,
  manifestacion: 3,
};

export const CONCESION_COLORS: Record<ConcesionTipo, string> = {
  explotacion: "#16a34a", // verde
  exploracion: "#2563eb", // azul
  mensura: "#f59e0b", // amarillo
  manifestacion: "#db2777", // magenta
};

export const CONCESION_LABELS: Record<ConcesionTipo, string> = {
  explotacion: "Explotación vigente",
  exploracion: "Exploración vigente",
  mensura: "Mensura (en trámite)",
  manifestacion: "Manifestación",
};

export type ConcesionAttrs = {
  tipo: ConcesionTipo;
  titular: string | null;
  rut: string | null;
  nombre: string | null;
  codigo: string | null;
  comuna: string | null;
  provincia: string | null;
  region: string | null;
  area_ha: number | null;
  datum: string | null;
  vigencia: string | null;
  rol: string | null;
  raw: Record<string, unknown>;
};

/** Map ArcGIS attributes (heterogeneous between layers) to a normalized shape. */
function normalizeAttrs(props: Record<string, unknown>, tipo: ConcesionTipo): ConcesionAttrs {
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = props[k] ?? props[k.toUpperCase()] ?? props[k.toLowerCase()];
      if (v != null && String(v).trim() !== "") return String(v);
    }
    return null;
  };
  const pickNum = (...keys: string[]): number | null => {
    const v = pick(...keys);
    if (!v) return null;
    const n = Number(v.replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  return {
    tipo,
    titular: pick("TITULAR", "NOMBRE_TIT", "NOM_TITULA"),
    rut: pick("RUT", "RUT_TITULA"),
    nombre: pick("NOMBRE", "NOM_PERTEN", "NOM_CONCES"),
    codigo: pick("CODIGO", "ROL", "COD_PERTEN"),
    comuna: pick("COMUNA", "NOM_COMUNA"),
    provincia: pick("PROVINCIA", "NOM_PROV"),
    region: pick("REGION", "NOM_REGION"),
    area_ha: pickNum("AREA_HA", "HECTAREAS", "SUPERFICIE"),
    datum: pick("DATUM"),
    vigencia: pick("VIGENCIA", "ESTADO", "FECHA_VIG"),
    rol: pick("ROL"),
    raw: props,
  };
}

function popupHtml(a: ConcesionAttrs): string {
  const rows: Array<[string, string | null]> = [
    ["Tipo", CONCESION_LABELS[a.tipo]],
    ["Titular", a.titular],
    ["RUT", a.rut],
    ["Nombre", a.nombre],
    ["Código / Rol", a.codigo ?? a.rol],
    ["Comuna", a.comuna],
    ["Provincia", a.provincia],
    ["Región", a.region],
    ["Área (ha)", a.area_ha != null ? a.area_ha.toLocaleString("es-CL") : null],
    ["Datum", a.datum],
    ["Vigencia", a.vigencia],
  ];
  const body = rows
    .filter(([, v]) => v != null && v !== "")
    .map(
      ([k, v]) =>
        `<div style="display:flex;gap:8px;font-size:11px;line-height:1.45;">
          <div style="opacity:.65;min-width:88px">${k}</div>
          <div style="font-weight:500">${v}</div>
        </div>`,
    )
    .join("");
  return `
    <div style="min-width:240px;font-family:system-ui,sans-serif">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${CONCESION_COLORS[a.tipo]}"></span>
        <strong style="font-size:12px">${a.nombre ?? a.codigo ?? "Concesión"}</strong>
      </div>
      ${body}
      <div style="margin-top:6px;font-size:10px;opacity:.55">Fuente: SERNAGEOMIN · Catastro Minero</div>
    </div>`;
}

/**
 * Fetch concessions of a given type within a bbox (lng/lat, EPSG:4326) as GeoJSON.
 */
export async function fetchConcesionesGeoJSON(
  tipo: ConcesionTipo,
  bbox: [number, number, number, number],
  maxRecords = 1000,
): Promise<AnyFC | null> {
  const layer = LAYER_BY_TIPO[tipo];
  const [minX, minY, maxX, maxY] = bbox;
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    geometry: `${minX},${minY},${maxX},${maxY}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outSR: "4326",
    f: "geojson",
    resultRecordCount: String(maxRecords),
  });
  try {
    const res = await fetch(`${ARCGIS_BASE}/${layer}/query?${params.toString()}`);
    if (!res.ok) return null;
    const fc = (await res.json()) as AnyFC & { error?: unknown };
    if ("error" in fc) return null;
    return fc;
  } catch {
    return null;
  }
}

/**
 * Build a Leaflet GeoJSON layer for one concession type, fetched live from SERNAGEOMIN.
 */
export async function buildConcesionesNacionalesLayer(
  L: LeafletNS,
  tipo: ConcesionTipo,
  bbox: [number, number, number, number],
): Promise<{ layer: LeafletGeoJSON; count: number }> {
  const fc = (await fetchConcesionesGeoJSON(tipo, bbox)) ?? {
    type: "FeatureCollection",
    features: [],
  };
  const color = CONCESION_COLORS[tipo];
  const layer = L.geoJSON(fc as unknown as GeoJSON.FeatureCollection, {
    style: () => ({
      color,
      weight: 1.2,
      opacity: 0.9,
      fillColor: color,
      fillOpacity: 0.18,
    }),
    onEachFeature: (feature: GeoJSON.Feature, lyr: Layer) => {
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const attrs = normalizeAttrs(props, tipo);
      lyr.bindPopup(popupHtml(attrs), { maxWidth: 320 });
    },
  });
  return { layer, count: fc.features?.length ?? 0 };
}
