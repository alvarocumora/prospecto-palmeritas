// Drill Target Ranking Worker — Sprint 5
// Genera targets ranqueados a partir de anomalías, sondajes existentes, block model
// y penalizaciones QA/QC. Toda la lógica corre fuera del main thread.

import type { AnomalyPoint } from "@/engine3d/data/anomalies.functions";

export type Priority = "A" | "B" | "C";
export type ExpectedZone = "shallow" | "medium" | "deep";

export type DrillTarget = {
  targetId: string;
  collar: { x: number; y: number; z: number };
  azimuth: number;
  dip: number;
  depth: number;
  expectedZone: ExpectedZone;
  score: number;
  confidence: number;
  rationale: string[];
  estimatedCost: number;
  priority: Priority;
  /** Anomaly intensity at the target site (0..1). */
  anomalyStrength: number;
  /** Distance to nearest existing drillhole (m). */
  spacingGap: number;
};

export type DrillTargetInput = {
  anomalies: AnomalyPoint[];
  existingCollars: Array<{ x: number; y: number; z: number }>;
  /** Max targets returned. */
  maxTargets: number;
  /** Minimum spacing between two proposed targets (m). */
  minSeparation: number;
  /** Minimum anomaly intensity to consider. */
  minAnomaly: number;
  /** Cost per meter (USD). */
  costPerMeter: number;
  /** Mobilization base cost (USD). */
  mobilization: number;
  /** Assay cost per meter (USD). */
  assayPerMeter: number;
  /** Overhead multiplier (e.g. 1.2 = +20%). */
  overheadMult: number;
  /** Penalty factor for QA/QC issues (0..1, multiplies confidence). */
  qaqcPenalty: number;
  /** Default azimuth (deg). */
  defaultAzimuth: number;
  /** Default dip (deg, negative = downward). */
  defaultDip: number;
};

export type DrillTargetOutput = {
  targets: DrillTarget[];
  stats: {
    candidates: number;
    selected: number;
    aPriority: number;
    bPriority: number;
    cPriority: number;
    totalMeters: number;
    totalCost: number;
    elapsedMs: number;
  };
};

self.onmessage = (ev: MessageEvent<DrillTargetInput>) => {
  const t0 = performance.now();
  const out = rankTargets(ev.data);
  (self as unknown as Worker).postMessage({
    ...out,
    stats: { ...out.stats, elapsedMs: performance.now() - t0 },
  });
};

function rankTargets(p: DrillTargetInput): Omit<DrillTargetOutput, "stats"> & {
  stats: Omit<DrillTargetOutput["stats"], "elapsedMs">;
} {
  const candidates = p.anomalies.filter((a) => a.v >= p.minAnomaly);

  // Compute base score per candidate
  const scored = candidates.map((a) => {
    const nearest = nearestDistanceXY(a, p.existingCollars);
    const spacingScore = Math.min(1, nearest / 300); // bigger gap → better
    const anomalyScore = a.v;
    const depthAbs = Math.abs(a.z);
    const depthScore = depthAbs < 50 ? 0.5 : depthAbs < 250 ? 1 : depthAbs < 450 ? 0.85 : 0.55;
    const score = anomalyScore * 0.55 + spacingScore * 0.3 + depthScore * 0.15;
    const confidenceRaw = (anomalyScore * 0.7 + Math.min(1, nearest / 500) * 0.3) * p.qaqcPenalty;
    const confidence = Math.max(0, Math.min(1, confidenceRaw));
    return { a, nearest, score, confidence, depthAbs };
  });

  // Sort desc by score
  scored.sort((x, y) => y.score - x.score);

  // Greedy non-max-suppression by minSeparation
  const selected: typeof scored = [];
  for (const s of scored) {
    if (selected.length >= p.maxTargets) break;
    const tooClose = selected.some(
      (sel) => Math.hypot(sel.a.x - s.a.x, sel.a.y - s.a.y) < p.minSeparation,
    );
    if (!tooClose) selected.push(s);
  }

  const targets: DrillTarget[] = selected.map((s, idx) => {
    // Depth: punta hasta 50m bajo el anomaly center, mínimo 80, máx 600
    const targetDepth = Math.max(80, Math.min(600, s.depthAbs + 80));
    const expectedZone: ExpectedZone =
      s.depthAbs < 150 ? "shallow" : s.depthAbs < 350 ? "medium" : "deep";
    const drillCost =
      (targetDepth * (p.costPerMeter + p.assayPerMeter) + p.mobilization) * p.overheadMult;
    const priority: Priority = s.score > 0.7 ? "A" : s.score > 0.5 ? "B" : "C";

    const rationale: string[] = [];
    rationale.push(`Anomaly v=${s.a.v.toFixed(2)} (${s.a.kind}).`);
    rationale.push(`Gap a sondaje más cercano: ${s.nearest.toFixed(0)} m.`);
    rationale.push(`Zona esperada: ${expectedZone} (${s.depthAbs.toFixed(0)} m bajo superficie).`);
    if (s.confidence < 0.4) rationale.push("Baja confianza por QA/QC — revisar muestras vecinas.");
    if (priority === "A") rationale.push("Alta convergencia de drivers — recomendado para fase 1.");

    return {
      targetId: `TGT-${String(idx + 1).padStart(3, "0")}`,
      collar: { x: s.a.x, y: s.a.y, z: 0 }, // collar en superficie (z=0 relativo a topografía local)
      azimuth: p.defaultAzimuth,
      dip: p.defaultDip,
      depth: targetDepth,
      expectedZone,
      score: s.score,
      confidence: s.confidence,
      rationale,
      estimatedCost: drillCost,
      priority,
      anomalyStrength: s.a.v,
      spacingGap: s.nearest,
    };
  });

  const aP = targets.filter((t) => t.priority === "A").length;
  const bP = targets.filter((t) => t.priority === "B").length;
  const cP = targets.filter((t) => t.priority === "C").length;
  const meters = targets.reduce((s, t) => s + t.depth, 0);
  const cost = targets.reduce((s, t) => s + t.estimatedCost, 0);

  return {
    targets,
    stats: {
      candidates: candidates.length,
      selected: targets.length,
      aPriority: aP,
      bPriority: bP,
      cPriority: cP,
      totalMeters: meters,
      totalCost: cost,
    },
  };
}

function nearestDistanceXY(
  a: { x: number; y: number },
  collars: Array<{ x: number; y: number }>,
): number {
  if (collars.length === 0) return 1000;
  let best = Infinity;
  for (const c of collars) {
    const d = Math.hypot(a.x - c.x, a.y - c.y);
    if (d < best) best = d;
  }
  return Number.isFinite(best) ? best : 1000;
}
