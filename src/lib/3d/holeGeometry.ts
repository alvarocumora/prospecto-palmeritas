// Sprint 5.4 — utilidades para proyectar sondajes en escena 3D local.
// Las coordenadas se normalizan a metros respecto al centroide de los collares,
// así no necesitamos proj4 para desplegar (todo está ya en UTM o aprox.).

import type { DrillHole, DrillCoreLog } from "@/hooks/useDrilling";

export type SceneOrigin = {
  east0: number;
  north0: number;
  elev0: number;
};

export function computeOrigin(holes: DrillHole[]): SceneOrigin {
  const valid = holes.filter((h) => h.easting != null && h.northing != null);
  if (valid.length === 0) return { east0: 0, north0: 0, elev0: 0 };
  const east0 = valid.reduce((s, h) => s + (h.easting ?? 0), 0) / valid.length;
  const north0 = valid.reduce((s, h) => s + (h.northing ?? 0), 0) / valid.length;
  const elev0 = valid.reduce((s, h) => s + (h.elevation ?? 0), 0) / valid.length;
  return { east0, north0, elev0 };
}

/** Convierte (E, N, Z) a coords de escena Three.js: x=Easting, y=Elev (up), z=-Northing. */
export function toScene(
  easting: number,
  northing: number,
  elev: number,
  origin: SceneOrigin,
): [number, number, number] {
  return [easting - origin.east0, elev - origin.elev0, -(northing - origin.north0)];
}

/** Direction unit vector dado azimuth (deg, 0=N, 90=E) y dip (deg, +abajo). */
export function holeDirection(azimuthDeg: number, dipDeg: number): [number, number, number] {
  const az = (azimuthDeg * Math.PI) / 180;
  const dip = (dipDeg * Math.PI) / 180;
  const horiz = Math.cos(dip);
  const dx = horiz * Math.sin(az); // East component
  const dy = -Math.sin(dip); // Up axis: dip positivo va hacia abajo
  const dz = -horiz * Math.cos(az); // -North → +z apunta al sur
  return [dx, dy, dz];
}

/** Devuelve punto a profundidad d (m) sobre el sondaje. */
export function pointAtDepth(
  collarScene: [number, number, number],
  dir: [number, number, number],
  depth: number,
): [number, number, number] {
  return [
    collarScene[0] + dir[0] * depth,
    collarScene[1] + dir[1] * depth,
    collarScene[2] + dir[2] * depth,
  ];
}

/** Color ramp para Au g/t. */
export function auColor(au: number | null): string {
  if (au == null || au < 0.1) return "#475569";
  if (au < 0.3) return "#0d9488";
  if (au < 1.0) return "#f59e0b";
  if (au < 3.0) return "#dc2626";
  return "#fbbf24";
}

export type SceneHole = {
  hole: DrillHole;
  collar: [number, number, number];
  direction: [number, number, number];
  totalDepth: number;
  intercepts: Array<{
    log: DrillCoreLog;
    from: [number, number, number];
    to: [number, number, number];
    color: string;
  }>;
};

export function buildSceneHoles(
  holes: DrillHole[],
  logs: DrillCoreLog[],
  origin: SceneOrigin,
): SceneHole[] {
  const logsByHole = new Map<string, DrillCoreLog[]>();
  for (const l of logs) {
    if (!logsByHole.has(l.hole_id)) logsByHole.set(l.hole_id, []);
    logsByHole.get(l.hole_id)!.push(l);
  }
  return holes
    .filter((h) => h.easting != null && h.northing != null)
    .map((h) => {
      const collar = toScene(h.easting!, h.northing!, h.elevation ?? origin.elev0, origin);
      const direction = holeDirection(h.azimuth ?? 0, h.dip ?? 90);
      const totalDepth = h.actual_depth ?? h.planned_depth ?? 100;
      const intercepts = (logsByHole.get(h.id) ?? [])
        .filter((l) => (l.au_gpt ?? 0) >= 0.1)
        .map((log) => ({
          log,
          from: pointAtDepth(collar, direction, log.depth_from),
          to: pointAtDepth(collar, direction, log.depth_to),
          color: auColor(log.au_gpt),
        }));
      return { hole: h, collar, direction, totalDepth, intercepts };
    });
}
