import type { Feature, FeatureCollection, LineString, Point } from "geojson";

/**
 * Cruce veta medida (informe Arcos/Leman) × lineamiento Sentinel-1 × halos EMIT.
 * Resultado INTERPRETADO: coincidencia geométrica y espectral, no prueba de continuidad
 * ni de mineralización. Parámetros explícitos para que el cálculo sea reproducible.
 */
export const CORRELATION_PARAMS = {
  maxDistanceM: 250,
  maxAngleDeg: 15,
  haloRadiusM: 300,
} as const;

export const HALO_FAMILIES = ["alunita", "arcillas", "clorita", "oxidos"] as const;
export type HaloFamily = (typeof HALO_FAMILIES)[number];

const HALO_LABEL: Record<HaloFamily, string> = {
  alunita: "argílica avanzada",
  arcillas: "argílica",
  clorita: "propilítica",
  oxidos: "óxidos Fe³⁺",
};

type XY = [number, number];

function toMeters([lng, lat]: number[], lat0: number): XY {
  const k = 111_320;
  return [lng * k * Math.cos((lat0 * Math.PI) / 180), lat * k];
}

/** Axial (0–180°) azimuth of a segment in local metres. */
export function axialAzimuth(a: XY, b: XY): number {
  const az = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
  return ((az % 180) + 180) % 180;
}

/** Smallest difference between two axial directions, 0–90°. */
export function axialDelta(a: number, b: number): number {
  const d = Math.abs((((a - b) % 180) + 180) % 180);
  return Math.min(d, 180 - d);
}

function segmentDistance(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export type VeinCorrelation = {
  code: string;
  name: string;
  strikeDeg: number;
  lineaments: Array<{ index: number; distanceM: number; deltaDeg: number; azimuthDeg: number }>;
  halo: Record<HaloFamily, number>;
};

export function correlateVeins(
  veins: FeatureCollection,
  lineaments: FeatureCollection,
  emit: FeatureCollection | null,
  params = CORRELATION_PARAMS,
): VeinCorrelation[] {
  const out: VeinCorrelation[] = [];
  for (const vein of veins.features as Feature<LineString>[]) {
    if (vein.geometry?.type !== "LineString" || vein.geometry.coordinates.length < 2) continue;
    const coords = vein.geometry.coordinates;
    const lat0 = coords[0][1];
    const a = toMeters(coords[0], lat0);
    const b = toMeters(coords[coords.length - 1], lat0);
    const mid: XY = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const props = (vein.properties ?? {}) as Record<string, unknown>;
    const strike = Number(props.strikeDeg);
    const veinAxis = Number.isFinite(strike) ? ((strike % 180) + 180) % 180 : axialAzimuth(a, b);

    const matches: VeinCorrelation["lineaments"] = [];
    lineaments.features.forEach((lf, index) => {
      if (lf.geometry?.type !== "LineString") return;
      const lc = (lf.geometry as LineString).coordinates;
      if (lc.length < 2) return;
      const la = toMeters(lc[0], lat0);
      const lb = toMeters(lc[lc.length - 1], lat0);
      const distanceM = segmentDistance(mid, la, lb);
      if (distanceM > params.maxDistanceM) return;
      const azimuthDeg = axialAzimuth(la, lb);
      const deltaDeg = axialDelta(veinAxis, azimuthDeg);
      if (deltaDeg > params.maxAngleDeg) return;
      matches.push({
        index,
        distanceM: Math.round(distanceM),
        deltaDeg: Math.round(deltaDeg),
        azimuthDeg: Math.round(azimuthDeg),
      });
    });

    const halo = Object.fromEntries(HALO_FAMILIES.map((f) => [f, 0])) as Record<HaloFamily, number>;
    for (const f of (emit?.features ?? []) as Feature<Point>[]) {
      const fam = f.properties?.familia as HaloFamily | undefined;
      if (!fam || !(fam in halo) || f.geometry?.type !== "Point") continue;
      const p = toMeters(f.geometry.coordinates, lat0);
      if (Math.hypot(p[0] - mid[0], p[1] - mid[1]) <= params.haloRadiusM) halo[fam] += 1;
    }

    out.push({
      code: String(props.code ?? ""),
      name: String(props.name ?? props.code ?? "Veta"),
      strikeDeg: Math.round(veinAxis),
      lineaments: matches.sort((x, y) => x.distanceM - y.distanceM),
      halo,
    });
  }
  return out;
}

export function haloSummary(halo: Record<HaloFamily, number>): string {
  return (
    HALO_FAMILIES.filter((f) => halo[f] > 0)
      .map((f) => `${HALO_LABEL[f]} ${halo[f]} px EMIT`)
      .join(" · ") || "sin detecciones EMIT en 300 m"
  );
}

/** Coincident lineaments as an INTERPRETED layer, annotated with the vein they align with. */
export function correlationLayer(
  results: VeinCorrelation[],
  lineaments: FeatureCollection,
): FeatureCollection {
  const features: Feature[] = [];
  for (const r of results) {
    const haloText = haloSummary(r.halo);
    for (const m of r.lineaments) {
      const src = lineaments.features[m.index];
      features.push({
        type: "Feature",
        geometry: src.geometry,
        properties: {
          nombre: `${r.code} ↔ lineamiento S1`,
          veta: r.name,
          rumbo_veta_deg: r.strikeDeg,
          azimut_lineamiento_deg: m.azimuthDeg,
          delta_angular_deg: m.deltaDeg,
          distancia_m: m.distanceM,
          halo_emit_300m: haloText,
          procedencia: `INTERPRETADO · Δθ ≤ ${CORRELATION_PARAMS.maxAngleDeg}°, ≤ ${CORRELATION_PARAMS.maxDistanceM} m`,
          advertencia:
            "Coincidencia geométrica radar–terreno; no prueba continuidad de la veta ni mineralización.",
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}
