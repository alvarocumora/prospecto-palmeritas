// Section Engine: intersección geométrica de un plano de corte con
// isosuperficie (mesh), terreno TIN (mesh), sondajes (segmentos) y
// puntos de muestreo, generando una vista 2D en el frame (u,v) del plano.
//
// IMPORTANTE: todo el cálculo se hace en coordenadas "three" (X=este,
// Y=altura·ve, Z=-norte) para coincidir con el frame de los clipping planes.
// La isosuperficie llega en ENU y debe remapearse antes (helper expuesto).
import type { DrillholeSegment } from "@/engine3d/data/drillholes.functions";
import type { AnomalyPoint } from "@/engine3d/data/anomalies.functions";

export type Vec3Lite = { x: number; y: number; z: number };
export type Section2DPoint = { u: number; v: number };
export type Section2DSegment = { a: Section2DPoint; b: Section2DPoint };

export type SectionFrame = {
  origin: Vec3Lite;
  normal: Vec3Lite;
  u: Vec3Lite;
  v: Vec3Lite;
  /** "vertical" = u horizontal + v=altura; "plan" = corte horizontal (vista en planta). */
  kind: "vertical" | "plan";
};

export type DrillholeIntersection = {
  holeId: string;
  collar2D: Section2DPoint;
  toe2D: Section2DPoint;
  intersect?: Section2DPoint;
  status: string | null;
  isAi: boolean;
  depth: number;
  azimuth: number;
  dip: number;
  distToPlane: number;
};

export type SamplePoint2D = Section2DPoint & {
  value: number;
  kind: "geophysics" | "satellite";
  distToPlane: number;
};

export type SectionResult = {
  frame: SectionFrame;
  width: number;
  anomalySegments: Section2DSegment[];
  terrainProfile: Section2DSegment[];
  drillholes: DrillholeIntersection[];
  samples: SamplePoint2D[];
  bounds: { uMin: number; uMax: number; vMin: number; vMax: number };
  stats: {
    anomalyTris: number;
    terrainTris: number;
    holesIntersected: number;
    samplesInSlab: number;
    elapsedMs: number;
  };
};

export type SectionMeshInput = {
  positions: Float32Array; // [x,y,z,...] en coords three
  indices: Uint32Array;
};

export type SectionInput = {
  iso: SectionMeshInput | null;
  terrain: SectionMeshInput | null;
  holes: DrillholeSegment[];
  samples: AnomalyPoint[];
  /** Plano: n·p + constant = 0 (mismo convenio que THREE.Plane). */
  planeNormal: Vec3Lite;
  planeConstant: number;
  /** Ancho de corredor en metros (filtro de muestras y sondajes cercanos). */
  width: number;
  verticalExaggeration: number;
};

// ------------------------- helpers vec3 -------------------------
const v3 = (x: number, y: number, z: number): Vec3Lite => ({ x, y, z });
const dot = (a: Vec3Lite, b: Vec3Lite) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3Lite, b: Vec3Lite) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a: Vec3Lite, k: number) => v3(a.x * k, a.y * k, a.z * k);
const cross = (a: Vec3Lite, b: Vec3Lite) =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const norm = (a: Vec3Lite) => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return v3(a.x / l, a.y / l, a.z / l);
};

/** Convierte ENU(x,y,z) → three(x, z*ve, -y). */
export function enuToThree(x: number, y: number, z: number, ve: number): Vec3Lite {
  return v3(x, z * ve, -y);
}

/** Remapea positions de iso (ENU) a coords three con exageración vertical. */
export function isoEnuToThree(
  positions: Float32Array,
  ve: number,
): Float32Array {
  const n = positions.length / 3;
  const out = new Float32Array(positions.length);
  for (let i = 0; i < n; i++) {
    out[i * 3] = positions[i * 3];
    out[i * 3 + 1] = positions[i * 3 + 2] * ve;
    out[i * 3 + 2] = -positions[i * 3 + 1];
  }
  return out;
}

export function buildFrame(planeNormal: Vec3Lite, planeConstant: number): SectionFrame {
  const n = norm(planeNormal);
  const up = v3(0, 1, 0);
  const dotUp = Math.abs(dot(n, up));
  let u: Vec3Lite;
  let vAxis: Vec3Lite;
  let kind: SectionFrame["kind"];
  if (dotUp > 0.95) {
    // plano horizontal: vista en planta
    u = v3(1, 0, 0);
    vAxis = v3(0, 0, 1);
    kind = "plan";
  } else {
    u = norm(cross(up, n));
    vAxis = norm(cross(n, u));
    kind = "vertical";
  }
  const origin = scale(n, -planeConstant);
  return { origin, normal: n, u, v: vAxis, kind };
}

function project2D(p: Vec3Lite, frame: SectionFrame): Section2DPoint {
  const d = sub(p, frame.origin);
  return { u: dot(d, frame.u), v: dot(d, frame.v) };
}

function planeDist(p: Vec3Lite, n: Vec3Lite, c: number): number {
  return p.x * n.x + p.y * n.y + p.z * n.z + c;
}

function intersectEdge(
  pa: Vec3Lite, pb: Vec3Lite, da: number, db: number,
): Vec3Lite | null {
  if ((da > 0 && db > 0) || (da < 0 && db < 0)) return null;
  if (da === db) return null;
  const t = da / (da - db);
  if (t < 0 || t > 1) return null;
  return v3(
    pa.x + t * (pb.x - pa.x),
    pa.y + t * (pb.y - pa.y),
    pa.z + t * (pb.z - pa.z),
  );
}

function meshPlaneSegments(
  mesh: SectionMeshInput,
  n: Vec3Lite, c: number,
  frame: SectionFrame,
): { segs: Section2DSegment[]; triCount: number } {
  const segs: Section2DSegment[] = [];
  const { positions, indices } = mesh;
  const triCount = indices.length / 3;
  const a = v3(0, 0, 0), b = v3(0, 0, 0), cc = v3(0, 0, 0);
  for (let i = 0; i < triCount; i++) {
    const ia = indices[i * 3] * 3;
    const ib = indices[i * 3 + 1] * 3;
    const ic = indices[i * 3 + 2] * 3;
    a.x = positions[ia];     a.y = positions[ia + 1]; a.z = positions[ia + 2];
    b.x = positions[ib];     b.y = positions[ib + 1]; b.z = positions[ib + 2];
    cc.x = positions[ic];    cc.y = positions[ic + 1]; cc.z = positions[ic + 2];
    const da = planeDist(a, n, c);
    const db = planeDist(b, n, c);
    const dc = planeDist(cc, n, c);
    const cuts: Vec3Lite[] = [];
    let p = intersectEdge(a, b, da, db); if (p) cuts.push(p);
    p = intersectEdge(b, cc, db, dc);    if (p) cuts.push(p);
    p = intersectEdge(cc, a, dc, da);    if (p) cuts.push(p);
    if (cuts.length === 2) {
      segs.push({ a: project2D(cuts[0], frame), b: project2D(cuts[1], frame) });
    }
  }
  return { segs, triCount };
}

export function computeSection(input: SectionInput): SectionResult {
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  const n = norm(input.planeNormal);
  const c = input.planeConstant;
  const frame = buildFrame(n, c);
  const ve = input.verticalExaggeration;
  const halfWidth = Math.max(0, input.width / 2);

  const isoOut = input.iso
    ? meshPlaneSegments(input.iso, n, c, frame)
    : { segs: [], triCount: 0 };
  const terrainOut = input.terrain
    ? meshPlaneSegments(input.terrain, n, c, frame)
    : { segs: [], triCount: 0 };

  // Drillholes
  const drillholes: DrillholeIntersection[] = [];
  for (const h of input.holes) {
    const A = enuToThree(h.collar.x, h.collar.y, h.collar.z, ve);
    const B = enuToThree(h.toe.x, h.toe.y, h.toe.z, ve);
    const dA = planeDist(A, n, c);
    const dB = planeDist(B, n, c);
    const crosses = (dA <= 0 && dB >= 0) || (dA >= 0 && dB <= 0);
    const minAbs = Math.min(Math.abs(dA), Math.abs(dB));
    if (!crosses && minAbs > halfWidth) continue;
    let intersect: Section2DPoint | undefined;
    if (crosses && dA !== dB) {
      const t = dA / (dA - dB);
      const ipt = v3(
        A.x + t * (B.x - A.x),
        A.y + t * (B.y - A.y),
        A.z + t * (B.z - A.z),
      );
      intersect = project2D(ipt, frame);
    }
    drillholes.push({
      holeId: h.holeId,
      collar2D: project2D(A, frame),
      toe2D: project2D(B, frame),
      intersect,
      status: h.status,
      isAi: h.isAi,
      depth: h.depth,
      azimuth: h.azimuth,
      dip: h.dip,
      distToPlane: Math.min(Math.abs(dA), Math.abs(dB)),
    });
  }

  // Samples
  const samples: SamplePoint2D[] = [];
  for (const p of input.samples) {
    const P = enuToThree(p.x, p.y, p.z, ve);
    const d = planeDist(P, n, c);
    if (Math.abs(d) > halfWidth) continue;
    const p2 = project2D(P, frame);
    samples.push({ u: p2.u, v: p2.v, value: p.v, kind: p.kind, distToPlane: d });
  }

  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  const acc = (p: Section2DPoint) => {
    if (p.u < uMin) uMin = p.u; if (p.u > uMax) uMax = p.u;
    if (p.v < vMin) vMin = p.v; if (p.v > vMax) vMax = p.v;
  };
  for (const s of isoOut.segs) { acc(s.a); acc(s.b); }
  for (const s of terrainOut.segs) { acc(s.a); acc(s.b); }
  for (const dh of drillholes) { acc(dh.collar2D); acc(dh.toe2D); }
  for (const sp of samples) acc(sp);
  if (uMin === Infinity) { uMin = -200; uMax = 200; vMin = -200; vMax = 200; }

  const elapsedMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;

  return {
    frame,
    width: input.width,
    anomalySegments: isoOut.segs,
    terrainProfile: terrainOut.segs,
    drillholes,
    samples,
    bounds: { uMin, uMax, vMin, vMax },
    stats: {
      anomalyTris: isoOut.triCount,
      terrainTris: terrainOut.triCount,
      holesIntersected: drillholes.length,
      samplesInSlab: samples.length,
      elapsedMs,
    },
  };
}
