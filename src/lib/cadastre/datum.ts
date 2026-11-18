// Conversión WGS84 ↔ PSAD56 (UTM sur) para minutas OJV. PSAD56 usa elipsoide
// Internacional 1924 y parámetros de 3 traslaciones (EPSG:1201, Sudamérica,
// precisión publicada ±5–10 m). Validar contra la exigencia del tribunal/perito.
import proj4 from "proj4";
import type { PedimentoResult } from "@/lib/pedimentoGeometry";

export type Datum = "WGS84" | "PSAD56";
export const PSAD56_NOTE = "PSAD56 calculado con 3 parámetros (EPSG:1201), precisión ±5–10 m: confirmar con perito.";

const def = (zone: number, datum: Datum) =>
  datum === "WGS84"
    ? `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`
    : `+proj=utm +zone=${zone} +south +ellps=intl +towgs84=-288,175,-376,0,0,0,0 +units=m +no_defs`;

/** Proyecta un punto WGS84 (lng, lat) a UTM del datum indicado. */
export function lngLatToUtm(lng: number, lat: number, zone: number, datum: Datum): [number, number] {
  return proj4("EPSG:4326", def(zone, datum), [lng, lat]) as [number, number];
}

export function utmToLngLat(e: number, n: number, zone: number, datum: Datum): [number, number] {
  return proj4(def(zone, datum), "EPSG:4326", [e, n]) as [number, number];
}

/** Devuelve el mismo PedimentoResult con vértices UTM expresados en el datum pedido. */
export function pedimentoInDatum(p: PedimentoResult, datum: Datum): PedimentoResult {
  if (datum === "WGS84") return p;
  const c = p.cornersWgs84;
  const conv = (k: "NW" | "NE" | "SE" | "SW") => lngLatToUtm(c[k][0], c[k][1], p.huso, datum);
  const cornersUtm = { NW: conv("NW"), NE: conv("NE"), SE: conv("SE"), SW: conv("SW") } as PedimentoResult["cornersUtm"];
  return {
    ...p,
    cornersUtm,
    caraNorteUtm: { E_centro: Math.round((cornersUtm.NW[0] + cornersUtm.NE[0]) / 2), N: Math.round((cornersUtm.NW[1] + cornersUtm.NE[1]) / 2) },
    datum: `PSAD56 / UTM ${p.huso}S`,
  };
}
