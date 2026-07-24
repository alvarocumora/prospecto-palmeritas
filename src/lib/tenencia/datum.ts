// Módulo de datums para el Módulo de Tenencia y Propiedad Minera (§4).
//
// Chile arrastra tres datums en documentos mineros vigentes: PSAD56, WGS84 y
// SIRGAS-Chile. Entre PSAD56 y WGS84 hay ~200 m de desplazamiento en esta
// latitud — suficiente para que un polígono caiga sobre concesión ajena. Toda
// geometría se almacena en 4326 (WGS84 geográfico); la conversión ocurre en los
// bordes (ingesta y presentación).
//
// Regla dura (§4): la transformación PSAD56↔WGS84 NO es un Helmert único de 3
// parámetros. PROJ/EPSG define traslaciones geocéntricas por FRANJA latitudinal.
// Parámetros verificados en epsg.io (2026-07):
//   · PSAD56→WGS84 (15) EPSG:6971 — Chile N de 26°S    → dx=-302 dy=+272 dz=-360
//   · PSAD56→WGS84 (16) EPSG:6972 — Chile 26°S–36°S     → dx=-328 dy=+340 dz=-329
//   · PSAD56→WGS84 (17) EPSG:6973 — Chile 36°S–43°30'S  → dx=-352 dy=+403 dz=-287
// Cada franja: "Geocentric translations (geog2D domain)", precisión 10 m/eje.
//
// Se usa proj4 (ya dependencia del proyecto) — no se requiere pyproj/Python.

import proj4 from "proj4";

export type Datum = "PSAD56" | "WGS84" | "SIRGAS";
export type Huso = 18 | 19;

/** Franja de transformación PSAD56→WGS84 por latitud (§4). */
export type Psad56Band = {
  code: number; // EPSG de la transformación
  label: string;
  towgs84: [number, number, number];
};

const PSAD56_BANDS: Psad56Band[] = [
  { code: 6971, label: "Chile norte de 26°S", towgs84: [-302, 272, -360] },
  { code: 6972, label: "Chile 26°S–36°S", towgs84: [-328, 340, -329] },
  { code: 6973, label: "Chile 36°S–43°30'S", towgs84: [-352, 403, -287] },
];

/** Selecciona la franja PSAD56→WGS84 por latitud (grados, negativos al sur). */
export function psad56Band(latDeg: number): Psad56Band {
  if (latDeg > -26) return PSAD56_BANDS[0];
  if (latDeg >= -36) return PSAD56_BANDS[1];
  return PSAD56_BANDS[2];
}

/**
 * Detecta el huso UTM por longitud. Chile continental: huso 18 al oeste de 72°W,
 * huso 19 al este. (Isla de Pascua y territorios especiales fuera de alcance.)
 */
export function husoFromLon(lonDeg: number): Huso {
  return lonDeg < -72 ? 18 : 19;
}

// ---- Definiciones proj4 (strings PROJ) ----
const WGS84_GEO = "EPSG:4326";

// SERNAGEOMIN transforma PSAD56→WGS84 con un ÚNICO juego de parámetros NACIONAL
// (EPSG:1204), verificado a 0.000 m contra su FeatureServer WGS84_Vertice (24
// vértices reales, husos 18/19, norte/centro/sur). Para que los traslapes calcen
// con el catastro OFICIAL, este módulo usa el MISMO juego. Los parámetros por
// franja (PSAD56_BANDS, EPSG 6971/6972/6973) son la alternativa "más precisa a
// WGS84 real", pero NO la que usa el catastro (difieren ~60 m); quedan como
// referencia y para `psad56Band`.
const PSAD56_TOWGS84: [number, number, number] = [-288, 175, -376];

const psad56GeoDef = `+proj=longlat +ellps=intl +towgs84=${PSAD56_TOWGS84.join(",")},0,0,0,0 +no_defs`;
const psad56UtmDef = (huso: Huso) =>
  `+proj=utm +zone=${huso} +south +ellps=intl +towgs84=${PSAD56_TOWGS84.join(",")},0,0,0,0 +units=m +no_defs`;

const wgs84UtmDef = (huso: Huso) => `+proj=utm +zone=${huso} +south +datum=WGS84 +units=m +no_defs`;

// SIRGAS-Chile (todas las realizaciones): marco geocéntrico GRS80, equivalente a
// WGS84 a efectos prácticos (<1 m). Sin traslación.
const sirgasUtmDef = (huso: Huso) =>
  `+proj=utm +zone=${huso} +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`;

export type LngLat = [number, number]; // [lon, lat] en grados (WGS84 4326)
export type Utm = { e: number; n: number; huso: Huso };

function utmDefFor(datum: Datum, huso: Huso): string {
  if (datum === "WGS84") return wgs84UtmDef(huso);
  if (datum === "SIRGAS") return sirgasUtmDef(huso);
  return psad56UtmDef(huso); // PSAD56 alineado a SERNAGEOMIN
}

/** Convierte una coordenada UTM (en el datum indicado) a WGS84 geográfico (4326). */
export function utmToWgs84({ e, n, huso }: Utm, datum: Datum): LngLat {
  return proj4(utmDefFor(datum, huso), WGS84_GEO, [e, n]) as LngLat;
}

/** Convierte WGS84 geográfico (4326) a UTM. Huso por longitud salvo que se fuerce. */
export function wgs84ToUtm([lon, lat]: LngLat, datum: Datum, forceHuso?: Huso): Utm {
  const huso = forceHuso ?? husoFromLon(lon);
  const [e, n] = proj4(WGS84_GEO, utmDefFor(datum, huso), [lon, lat]) as LngLat;
  return { e, n, huso };
}

/** Geográfico PSAD56 → WGS84 (para verificar/mostrar el cambio de datum). */
export function psad56GeoToWgs84([lon, lat]: LngLat): LngLat {
  return proj4(psad56GeoDef, WGS84_GEO, [lon, lat]) as LngLat;
}

/** Reproyecta un anillo (array de [lon,lat] o UTM) de un datum UTM a 4326. */
export function ringUtmToWgs84(ring: Array<[number, number]>, datum: Datum, huso: Huso): LngLat[] {
  return ring.map(([e, n]) => utmToWgs84({ e, n, huso }, datum));
}

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, "0");

/** Formatea una coordenada WGS84 como grados-minutos-segundos (para el footer). */
export function formatDms([lon, lat]: LngLat): string {
  const dms = (v: number, pos: string, neg: string) => {
    const hemi = v >= 0 ? pos : neg;
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = Math.floor((a - d) * 60);
    const s = ((a - d) * 60 - m) * 60;
    return `${hemi}${d}°${pad2(m)}'${s.toFixed(2)}"`;
  };
  return `${dms(lat, "N", "S")} ${dms(lon, "E", "W")}`;
}
