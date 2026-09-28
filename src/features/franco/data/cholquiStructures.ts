import type { Feature, FeatureCollection, LineString } from "geojson";
import { CHOLQUI_POINTS } from "./cholqui";

/**
 * Vetas/estructuras de Cholqui derivadas del rumbo/manteo documentado en el
 * nombre de cada punto de observación (ej. "N20ºE/30ºSE"). Solo se generan
 * segmentos donde el antecedente trae un rumbo explícito — no se inventa
 * orientación para los puntos que solo describen litología o alteración.
 */

const STRIKE_RE = /N\s*(\d{1,2})\s*º\s*([EW])(?:\s*\/\s*(\d{1,2}(?:-\d{1,2})?)\s*º\s*([A-Z]*))?/i;
const POTENCIA_RE = /pot\.?\s*([\d,.\-–]+)\s*m/i;

function strikeToAzimuthDeg(deg: number, dir: "E" | "W"): number {
  return dir === "E" ? deg : 360 - deg;
}

/** Punto + azimut + media-longitud (m) -> segmento de línea en lat/lng. */
function segment(
  lat: number,
  lng: number,
  azimuthDeg: number,
  halfLengthM: number,
): [number, number][] {
  const dLat = (halfLengthM / 111_000) * Math.cos((azimuthDeg * Math.PI) / 180);
  const dLng =
    (halfLengthM / (111_000 * Math.cos((lat * Math.PI) / 180))) *
    Math.sin((azimuthDeg * Math.PI) / 180);
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat + dLat],
  ];
}

export type CholquiStructureFeature = Feature<
  LineString,
  {
    code: string;
    name: string;
    strikeDeg: number;
    dipText: string | null;
    potenciaM: string | null;
  }
>;

const features: CholquiStructureFeature[] = [];
for (const pt of CHOLQUI_POINTS) {
  const m = STRIKE_RE.exec(pt.name);
  if (!m) continue;
  const deg = Number(m[1]);
  const dir = m[2].toUpperCase() as "E" | "W";
  const azimuth = strikeToAzimuthDeg(deg, dir);
  const dipDeg = m[3] ?? null;
  const dipDir = m[4] ?? "";
  const pm = POTENCIA_RE.exec(pt.name);
  features.push({
    type: "Feature",
    geometry: { type: "LineString", coordinates: segment(pt.lat, pt.lng, azimuth, 45) },
    properties: {
      code: pt.code,
      name: pt.name,
      strikeDeg: azimuth,
      dipText: dipDeg ? `${dipDeg}°${dipDir ? ` ${dipDir}` : ""}` : null,
      potenciaM: pm ? pm[1] : null,
    },
  });
}

/**
 * Estructuras (vetas) de Cholqui con rumbo documentado, como FeatureCollection
 * consumible por ProjectMasterViewer. Procedencia MEDIDO: rumbo/manteo de
 * terreno del prospecto (Arcos/Leman), no interpretación satelital.
 */
export const CHOLQUI_STRUCTURES_GEOJSON: FeatureCollection & { metadata: Record<string, unknown> } =
  {
    type: "FeatureCollection",
    metadata: {
      fuente:
        "Prospecto Cholqui (Juan Arcos Vidal / Andrés Leman Vargas) — rumbo/manteo de terreno",
      n: features.length,
      n_puntos_sin_rumbo: CHOLQUI_POINTS.length - features.length,
    },
    features,
  };
