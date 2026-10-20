// Carta geológica oficial (SERNAGEOMIN, publicada vía Geoportal CIGeo Chile en
// ArcGIS Online). Solo se listan hojas cuya capa vectorial de unidades y fallas
// fue verificada; las demás hojas del índice nacional (Geología_Básica_Chile)
// solo entregan descarga externa y no se dibujan. Fuera de cobertura no se
// muestra nada: nunca se extrapola una carta a otro sector.
import { useQuery } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";

type BBox = [number, number, number, number];

export type OfficialGeologySheet = {
  id: string;
  label: string;
  service: string;
  unitsLayer: number;
  faultsLayer: number;
  extent: BBox;
};

const ROOT = "https://services5.arcgis.com/ToenwDPmNHUDbHS6/arcgis/rest/services";

export const OFFICIAL_GEOLOGY_SHEETS: readonly OfficialGeologySheet[] = [
  {
    id: "M431",
    label: "Carta Illapel (M431)",
    service: `${ROOT}/Carta_M431_Illapel/FeatureServer`,
    unitsLayer: 19,
    faultsLayer: 14,
    extent: [-71.694, -32.022, -70.196, -30.983],
  },
  {
    id: "M21",
    label: "Carta Chañaral y Diego de Almagro (M21)",
    service: `${ROOT}/Carta_M21_Chanaral_y_Diego_de_Almagro/FeatureServer`,
    unitsLayer: 15,
    faultsLayer: 11,
    extent: [-70.703, -26.51, -69.998, -25.997],
  },
  {
    id: "M29",
    label: "Carta La Guardia (M29)",
    service: `${ROOT}/Carta_M29_La_Guardia/FeatureServer`,
    unitsLayer: 14,
    faultsLayer: 11,
    extent: [-70.007, -28.006, -69.5, -27.501],
  },
];

const intersects = (a: BBox, b: BBox) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

export function sheetsForBBox(bbox: BBox): OfficialGeologySheet[] {
  return OFFICIAL_GEOLOGY_SHEETS.filter((s) => intersects(s.extent, bbox));
}

export function projectBBox(center: [number, number], bbox?: BBox | null, padDeg = 0.05): BBox {
  const b = bbox ?? [center[0], center[1], center[0], center[1]];
  return [b[0] - padDeg, b[1] - padDeg, b[2] + padDeg, b[3] + padDeg];
}

async function query(url: string, bbox: BBox): Promise<FeatureCollection> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    outSR: "4326",
    f: "geojson",
    geometry: bbox.join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    resultRecordCount: "2000",
  });
  const res = await fetch(`${url}/query?${params}`);
  if (!res.ok) throw new Error(`Carta geológica HTTP ${res.status}`);
  const fc = (await res.json()) as FeatureCollection & { error?: unknown };
  if (fc.error) throw new Error("Carta geológica: error del servicio");
  return fc;
}

const label = (v: unknown) => (v == null || v === "" ? undefined : String(v));

export type OfficialGeology = { sheets: OfficialGeologySheet[]; units: FeatureCollection; faults: FeatureCollection };

export async function fetchOfficialGeology(bbox: BBox): Promise<OfficialGeology> {
  const sheets = sheetsForBBox(bbox);
  const units: FeatureCollection = { type: "FeatureCollection", features: [] };
  const faults: FeatureCollection = { type: "FeatureCollection", features: [] };
  for (const s of sheets) {
    const [u, f] = await Promise.all([
      query(`${s.service}/${s.unitsLayer}`, bbox),
      query(`${s.service}/${s.faultsLayer}`, bbox),
    ]);
    for (const ft of u.features) {
      const p = ft.properties ?? {};
      ft.properties = {
        nombre: label(p.NOMBRE) ?? label(p.UNIDAD) ?? label(p.CODIGO) ?? "Unidad geológica",
        codigo: label(p.CODIGO),
        edad: [label(p.PERIODO_MAX), label(p.PERIODO_MIN)].filter(Boolean).join(" – ") || undefined,
        litologia: label(p.DEFINICION),
        fuente: `SERNAGEOMIN · ${s.label}`,
        procedencia: "official",
      };
    }
    for (const ft of f.features) {
      const p = ft.properties ?? {};
      ft.properties = {
        nombre: label(p.NOMBRE) ?? label(p.SUBTIPO_DESC) ?? "Falla geológica",
        tipo: label(p.SUBTIPO_DESC) ?? label(p.TP_INFORMACION),
        manteo: label(p.DIR_MANTEO),
        fuente: `SERNAGEOMIN · ${s.label}`,
        procedencia: "official",
      };
    }
    units.features.push(...u.features);
    faults.features.push(...f.features);
  }
  return { sheets, units, faults };
}

export function useOfficialGeology(center: [number, number], bbox?: BBox | null) {
  const area = projectBBox(center, bbox);
  return useQuery({
    queryKey: ["official-geology", area.map((n) => n.toFixed(3)).join(",")],
    queryFn: () => fetchOfficialGeology(area),
    enabled: sheetsForBBox(area).length > 0,
    staleTime: 24 * 3600_000,
    retry: 1,
  });
}
