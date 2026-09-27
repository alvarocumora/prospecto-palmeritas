// Geometría normativa de pedimento (Código de Minería): terreno vacante y el
// mayor rectángulo con lados N-S / E-W (ejes UTM) inscrito en él. Puerto en TS de
// la lógica de geocapitals-remote/scripts/pedimentos.py, para correr en el server
// sobre un AOI dibujado + el catastro en vivo (SERNAGEOMIN).
//
// Trabaja en metros UTM (huso por longitud del AOI). Las operaciones booleanas de
// turf son cartesianas sobre las coordenadas proyectadas; NO se usan buffer/area
// geodésicos de turf (asumen grados). El margen al lindero se aplica probando el
// rectángulo expandido contra los obstáculos.
import * as turf from "@turf/turf";
import proj4 from "proj4";
import type { Feature, FeatureCollection, Polygon, Position } from "geojson";

const WGS84 = "EPSG:4326";

function utmProj(lon: number): { proj: string; zone: number } {
  const zone = Math.floor((lon + 180) / 6) + 1;
  return { proj: `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`, zone };
}

function projectRing(ring: Position[], fwd: (c: Position) => Position): Position[] {
  return ring.map((c) => fwd([c[0], c[1]]));
}

function projectPolygon(poly: Polygon, fwd: (c: Position) => Position): Polygon {
  return { type: "Polygon", coordinates: poly.coordinates.map((r) => projectRing(r, fwd)) };
}

/** Polígonos de obstáculo (concesiones ocupadas) del catastro, ya en UTM. */
function obstaclesUtm(concessions: FeatureCollection, fwd: (c: Position) => Position) {
  const polys: Polygon[] = [];
  for (const f of concessions.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") polys.push(projectPolygon(g, fwd));
    else if (g.type === "MultiPolygon")
      for (const coords of g.coordinates) polys.push(projectPolygon({ type: "Polygon", coordinates: coords }, fwd));
  }
  return polys;
}

function rectPolygon(w: number, s: number, e: number, n: number): Feature<Polygon> {
  return turf.polygon([[[w, s], [e, s], [e, n], [w, n], [w, s]]]);
}

export type PedimentoResult = {
  rectangleWgs84: Feature<Polygon>;
  cornersUtm: Record<"NW" | "NE" | "SE" | "SW", [number, number]>;
  cornersWgs84: Record<"NW" | "NE" | "SE" | "SW", [number, number]>;
  ladosM: { "E-W": number; "N-S": number };
  areaHa: number;
  caraNorteUtm: { E_centro: number; N: number };
  huso: number;
  datum: string;
  concessionsChecked: number;
};

/**
 * Mayor rectángulo N-S/E-W inscrito en el AOI, sin solapar concesiones ocupadas.
 * step/maxHa/margin en metros/ha. Devuelve null si no cabe ni un cuadrado mínimo.
 */
export function proposePedimento(
  aoi: Feature<Polygon> | Polygon,
  concessions: FeatureCollection,
  opts: { stepM?: number; maxHa?: number; marginM?: number } = {},
): PedimentoResult | null {
  const step = opts.stepM ?? 100;
  const maxHa = opts.maxHa ?? 5000;
  const margin = opts.marginM ?? 30;
  const aoiPoly: Polygon = aoi.type === "Feature" ? aoi.geometry : aoi;

  // huso por el centroide del AOI
  const c = turf.centroid(aoiPoly).geometry.coordinates;
  const { proj, zone } = utmProj(c[0]);
  const fwd = (coord: Position): Position => proj4(WGS84, proj, [coord[0], coord[1]]) as Position;
  const inv = (x: number, y: number): [number, number] => proj4(proj, WGS84, [x, y]) as [number, number];

  const aoiUtm = turf.polygon(projectPolygon(aoiPoly, fwd).coordinates);
  const obstacles = obstaclesUtm(concessions, fwd);
  const obstacleMulti = obstacles.length
    ? turf.multiPolygon(obstacles.map((p) => p.coordinates))
    : null;

  const [minX, minY, maxX, maxY] = turf.bbox(aoiUtm);

  const ok = (w: number, e: number, s: number, n: number): boolean => {
    if ((e - w) * (n - s) / 10000 > maxHa) return false;
    const rect = rectPolygon(w, s, e, n);
    if (!turf.booleanContains(aoiUtm, rect)) return false;
    if (obstacleMulti) {
      const grown = rectPolygon(w - margin, s - margin, e + margin, n + margin);
      if (turf.booleanIntersects(grown, obstacleMulti)) return false;
    }
    return true;
  };

  // semilla: buscar un punto vacante dentro del AOI (grilla gruesa)
  let seed: [number, number] | null = null;
  const gx = Math.max(8, Math.min(40, Math.round((maxX - minX) / step)));
  const gy = Math.max(8, Math.min(40, Math.round((maxY - minY) / step)));
  for (let i = 1; i < gx && !seed; i++)
    for (let j = 1; j < gy && !seed; j++) {
      const x = minX + ((maxX - minX) * i) / gx;
      const y = minY + ((maxY - minY) * j) / gy;
      if (ok(x - 10, x + 10, y - 10, y + 10)) seed = [x, y];
    }
  if (!seed) return null;

  let [w, e] = [seed[0] - 10, seed[0] + 10];
  let [s, n] = [seed[1] - 10, seed[1] + 10];
  let grew = true;
  while (grew) {
    grew = false;
    for (const side of ["e", "w", "n", "s"] as const) {
      const nw = side === "w" ? w - step : w;
      const ne = side === "e" ? e + step : e;
      const ns = side === "s" ? s - step : s;
      const nn = side === "n" ? n + step : n;
      if (ok(nw, ne, ns, nn)) {
        w = nw; e = ne; s = ns; n = nn; grew = true;
      }
    }
  }

  // redondear a 100 m (convención de vértices)
  w = Math.floor(w / 100) * 100; s = Math.floor(s / 100) * 100;
  e = Math.ceil(e / 100) * 100; n = Math.ceil(n / 100) * 100;
  while (obstacleMulti && turf.booleanIntersects(rectPolygon(w, s, e, n), obstacleMulti) && e - w > 200 && n - s > 200) {
    w += 100; s += 100; e -= 100; n -= 100;
  }

  const cornersUtm = {
    NW: [w, n] as [number, number], NE: [e, n] as [number, number],
    SE: [e, s] as [number, number], SW: [w, s] as [number, number],
  };
  const cornersWgs84 = {
    NW: inv(w, n), NE: inv(e, n), SE: inv(e, s), SW: inv(w, s),
  };
  const ring: Position[] = [cornersWgs84.NW, cornersWgs84.NE, cornersWgs84.SE, cornersWgs84.SW, cornersWgs84.NW];
  return {
    rectangleWgs84: turf.polygon([ring]),
    cornersUtm,
    cornersWgs84,
    ladosM: { "E-W": e - w, "N-S": n - s },
    areaHa: Math.round((e - w) * (n - s) / 10000 * 10) / 10,
    caraNorteUtm: { E_centro: Math.round((w + e) / 2), N: n },
    huso: zone,
    datum: `WGS84 / UTM ${zone}S`,
    concessionsChecked: obstacles.length,
  };
}
