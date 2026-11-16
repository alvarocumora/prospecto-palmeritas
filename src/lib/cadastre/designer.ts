// Diseñador normativo de pedimentos (exploración) y manifestaciones (explotación).
// Puro: trabaja en metros UTM (huso sur por longitud) y produce el mismo
// PedimentoResult que consume la minuta OJV, el escrito y las exportaciones.
// Topes usados (requieren validación legal, se muestran en pantalla):
//   Pedimento: rectángulo N-S/E-W, lados múltiplos de 100 m, ≤ 5.000 ha.
//   Manifestación: pertenencias rectangulares de 1–10 ha (lados múltiplos de 100 m),
//   agrupadas hasta 1.000 ha por manifestación.
import proj4 from "proj4";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Polygon, Position } from "geojson";
import type { PedimentoResult } from "@/lib/pedimentoGeometry";

export type SolicitudKind = "pedimento" | "manifestacion";
export const RULES = {
  pedimento: { maxHa: 5000, label: "Pedimento (exploración)", note: "Rectángulo N-S/E-W · lados múltiplos de 100 m · máx. 5.000 ha" },
  manifestacion: { maxHa: 1000, label: "Manifestación (explotación)", note: "Pertenencias de 1–10 ha · lados múltiplos de 100 m · máx. 1.000 ha" },
} as const;
export const MAX_PERTENENCIA_HA = 10;
export const STEP_M = 100;

export type Rect = { w: number; s: number; e: number; n: number };
export type Utm = { zone: number; fwd: (lng: number, lat: number) => [number, number]; inv: (x: number, y: number) => [number, number] };

export function utmFor(lng: number): Utm {
  const zone = Math.floor((lng + 180) / 6) + 1;
  const def = `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`;
  return {
    zone,
    fwd: (lng2, lat) => proj4("EPSG:4326", def, [lng2, lat]) as [number, number],
    inv: (x, y) => proj4(def, "EPSG:4326", [x, y]) as [number, number],
  };
}

export const snap = (v: number, step = STEP_M) => Math.round(v / step) * step;

/** Ajusta un rectángulo a múltiplos de 100 m, con lado mínimo de 100 m. */
export function snapRect(r: Rect): Rect {
  let w = snap(Math.min(r.w, r.e)), e = snap(Math.max(r.w, r.e));
  let s = snap(Math.min(r.s, r.n)), n = snap(Math.max(r.s, r.n));
  if (e - w < STEP_M) e = w + STEP_M;
  if (n - s < STEP_M) n = s + STEP_M;
  return { w, s, e, n };
}

export const rectHa = (r: Rect) => ((r.e - r.w) * (r.n - r.s)) / 10_000;

/** Recorta un rectángulo (desde su esquina SW) para no superar maxHa, manteniendo proporción. */
export function clampRectHa(r: Rect, maxHa: number): Rect {
  if (rectHa(r) <= maxHa) return r;
  const k = Math.sqrt(maxHa / rectHa(r));
  const wM = Math.max(STEP_M, Math.floor(((r.e - r.w) * k) / STEP_M) * STEP_M);
  const hM = Math.max(STEP_M, Math.floor(Math.min(maxHa * 10_000 / wM, (r.n - r.s)) / STEP_M) * STEP_M);
  return { w: r.w, s: r.s, e: r.w + wM, n: r.s + hM };
}

/** Bbox UTM de un polígono WGS84. */
export function polygonRectUtm(poly: Polygon, utm: Utm): Rect {
  const pts = poly.coordinates[0].map(([x, y]) => utm.fwd(x, y));
  return {
    w: Math.min(...pts.map((p) => p[0])), e: Math.max(...pts.map((p) => p[0])),
    s: Math.min(...pts.map((p) => p[1])), n: Math.max(...pts.map((p) => p[1])),
  };
}

export function rectToWgs(r: Rect, utm: Utm): Feature<Polygon> {
  const ring: Position[] = [utm.inv(r.w, r.n), utm.inv(r.e, r.n), utm.inv(r.e, r.s), utm.inv(r.w, r.s)];
  ring.push(ring[0]);
  return turf.polygon([ring]);
}

/** Construye el resultado compatible con minuta/escrito/KML a partir de un rectángulo UTM. */
export function rectToResult(r: Rect, utm: Utm, concessionsChecked = 0): PedimentoResult {
  const cornersUtm = { NW: [r.w, r.n], NE: [r.e, r.n], SE: [r.e, r.s], SW: [r.w, r.s] } as PedimentoResult["cornersUtm"];
  const cornersWgs84 = {
    NW: utm.inv(r.w, r.n), NE: utm.inv(r.e, r.n), SE: utm.inv(r.e, r.s), SW: utm.inv(r.w, r.s),
  };
  return {
    rectangleWgs84: rectToWgs(r, utm),
    cornersUtm,
    cornersWgs84,
    ladosM: { "E-W": r.e - r.w, "N-S": r.n - r.s },
    areaHa: Math.round(rectHa(r) * 10) / 10,
    caraNorteUtm: { E_centro: Math.round((r.w + r.e) / 2), N: r.n },
    huso: utm.zone,
    datum: `WGS84 / UTM ${utm.zone}S`,
    concessionsChecked,
  };
}

/** Mueve un vértice manteniendo lados N-S/E-W y snap a 100 m. */
export function dragCorner(r: Rect, corner: "NW" | "NE" | "SE" | "SW", x: number, y: number): Rect {
  const next = { ...r };
  if (corner.includes("W")) next.w = x; else next.e = x;
  if (corner.includes("N")) next.n = y; else next.s = y;
  return snapRect(next);
}

// ---------- celdas de 1 ha ----------
export type CellKey = string; // "col,row" en múltiplos de 100 m desde el origen UTM
export const cellKey = (x: number, y: number): CellKey => `${Math.floor(x / STEP_M)},${Math.floor(y / STEP_M)}`;
export const parseCell = (k: CellKey) => k.split(",").map(Number) as [number, number];

export function rectCells(r: Rect): CellKey[] {
  const out: CellKey[] = [];
  for (let x = r.w; x < r.e; x += STEP_M) for (let y = r.s; y < r.n; y += STEP_M) out.push(cellKey(x, y));
  return out;
}

export function cellsBounds(cells: Iterable<CellKey>): Rect | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const k of cells) {
    const [c, rr] = parseCell(k);
    w = Math.min(w, c * STEP_M); s = Math.min(s, rr * STEP_M);
    e = Math.max(e, (c + 1) * STEP_M); n = Math.max(n, (rr + 1) * STEP_M);
  }
  return Number.isFinite(w) ? { w, s, e, n } : null;
}

/** Continuidad por lado (4-vecinos). */
export function cellsContiguous(cells: Set<CellKey>): boolean {
  const first = cells.values().next().value;
  if (!first) return true;
  const seen = new Set<CellKey>([first]);
  const stack = [first];
  while (stack.length) {
    const [c, r] = parseCell(stack.pop()!);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${c + dc},${r + dr}`;
      if (cells.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); }
    }
  }
  return seen.size === cells.size;
}

/**
 * Agrupa celdas en pertenencias rectangulares de hasta 10 ha (greedy por filas:
 * tramos horizontales de ≤10 celdas, que luego crecen hacia el norte si el área lo permite).
 */
export function partitionPertenencias(cells: Set<CellKey>): Rect[] {
  const left = new Set(cells);
  const out: Rect[] = [];
  const sorted = [...cells].map(parseCell).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (const [c0, r0] of sorted) {
    if (!left.has(`${c0},${r0}`)) continue;
    let width = 1;
    while (width < MAX_PERTENENCIA_HA && left.has(`${c0 + width},${r0}`)) width++;
    let height = 1;
    const rowFree = (r: number) => { for (let c = c0; c < c0 + width; c++) if (!left.has(`${c},${r}`)) return false; return true; };
    while ((height + 1) * width <= MAX_PERTENENCIA_HA && rowFree(r0 + height)) height++;
    for (let c = c0; c < c0 + width; c++) for (let r = r0; r < r0 + height; r++) left.delete(`${c},${r}`);
    out.push({ w: c0 * STEP_M, s: r0 * STEP_M, e: (c0 + width) * STEP_M, n: (r0 + height) * STEP_M });
  }
  return out;
}

/** Celdas que chocan con concesiones vigentes/en trámite (polígonos WGS84). */
export function conflictingCells(cells: Iterable<CellKey>, occupied: FeatureCollection, utm: Utm): Set<CellKey> {
  const out = new Set<CellKey>();
  const polys: Feature[] = occupied.features.filter((f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"));
  if (!polys.length) return out;
  const boxes = polys.map((f) => turf.bbox(f));
  for (const k of cells) {
    const [c, r] = parseCell(k);
    const [lng, lat] = utm.inv((c + 0.5) * STEP_M, (r + 0.5) * STEP_M);
    for (let i = 0; i < polys.length; i++) {
      const b = boxes[i];
      if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
      const cell = rectToWgs({ w: c * STEP_M, s: r * STEP_M, e: (c + 1) * STEP_M, n: (r + 1) * STEP_M }, utm);
      if (turf.booleanIntersects(cell, polys[i] as Feature<Polygon>)) { out.add(k); break; }
    }
  }
  return out;
}
