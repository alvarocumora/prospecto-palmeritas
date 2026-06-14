// AI Geologist — Sprint 5
// Heurística determinista que sintetiza una interpretación geológica a partir de
// anomalías, block model, QA/QC, sondajes y litología. No depende de LLM (la
// integración con Lovable AI Gateway puede agregarse encima usando este resumen
// como contexto trazable).

import type { AnomalyPoint } from "@/engine3d/data/anomalies.functions";
import type { DrillholeSegment } from "@/engine3d/data/drillholes.functions";
import type { BlockModelOutput } from "@/engine3d/workers/blockModel.worker";
import type { QAQCResult } from "@/engine3d/qaqc/qaqc.worker";
import type { ParsedDrillholeBundle } from "@/engine3d/data/csvDrillholes";

export type UncertaintyLevel = "low" | "medium" | "high";
export type UpsideLevel = "limited" | "moderate" | "high" | "exceptional";

export type AIInterpretation = {
  generatedAt: string;
  headline: string;
  interpretation: string[];
  uncertainty: UncertaintyLevel;
  uncertaintyDrivers: string[];
  upside: UpsideLevel;
  upsideDrivers: string[];
  risks: string[];
  nextSteps: string[];
  stats: {
    anomalies: number;
    geophysics: number;
    satellite: number;
    drillholes: number;
    aiHoles: number;
    blocks: number;
    measured: number;
    indicated: number;
    inferred: number;
    qaqcCritical: number;
    qaqcWarning: number;
    avgSpacingM: number | null;
    bboxAreaKm2: number | null;
  };
};

export type AIGeologistInput = {
  points: AnomalyPoint[];
  holes: DrillholeSegment[];
  blockModel: BlockModelOutput | null;
  qaqc: QAQCResult | null;
  bundle: ParsedDrillholeBundle | null;
};

function avgNearestNeighborSpacing(holes: DrillholeSegment[]): number | null {
  if (holes.length < 2) return null;
  let acc = 0;
  let n = 0;
  for (let i = 0; i < holes.length; i++) {
    let best = Infinity;
    const a = holes[i].collar;
    for (let j = 0; j < holes.length; j++) {
      if (i === j) continue;
      const b = holes[j].collar;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < best) best = d;
    }
    if (Number.isFinite(best)) {
      acc += best;
      n++;
    }
  }
  return n > 0 ? acc / n : null;
}

function bboxAreaKm2(points: AnomalyPoint[]): number | null {
  if (points.length < 3) return null;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const dx = (maxX - minX) / 1000;
  const dy = (maxY - minY) / 1000;
  return Math.max(0, dx * dy);
}

export function runAIGeologist(input: AIGeologistInput): AIInterpretation {
  const { points, holes, blockModel, qaqc, bundle } = input;
  const geo = points.filter((p) => p.kind === "geophysics").length;
  const sat = points.filter((p) => p.kind === "satellite").length;
  const aiHoles = holes.filter((h) => h.isAi).length;
  const spacing = avgNearestNeighborSpacing(holes);
  const area = bboxAreaKm2(points);

  const measured = blockModel?.stats.measured ?? 0;
  const indicated = blockModel?.stats.indicated ?? 0;
  const inferred = blockModel?.stats.inferred ?? 0;
  const totalClassified = measured + indicated + inferred;

  const critical = qaqc?.summary.critical ?? 0;
  const warning = qaqc?.summary.warning ?? 0;

  // Uncertainty model
  const uncertaintyDrivers: string[] = [];
  let uScore = 0;
  if (holes.length < 10) {
    uScore += 2;
    uncertaintyDrivers.push(`Densidad de sondajes baja (${holes.length} reales).`);
  }
  if (spacing && spacing > 200) {
    uScore += 2;
    uncertaintyDrivers.push(
      `Espaciamiento medio ${spacing.toFixed(0)} m sobre malla recomendada (<150 m).`,
    );
  }
  if (critical > 0) {
    uScore += 3;
    uncertaintyDrivers.push(`${critical} issue(s) críticos de QA/QC sin resolver.`);
  } else if (warning > 5) {
    uScore += 1;
    uncertaintyDrivers.push(`${warning} warnings QA/QC pendientes.`);
  }
  if (totalClassified > 0 && measured / totalClassified < 0.1) {
    uScore += 1;
    uncertaintyDrivers.push("Recurso dominado por categoría Inferred/Indicated.");
  }
  if (!blockModel) {
    uScore += 1;
    uncertaintyDrivers.push("Sin block model construido — recursos no cuantificados.");
  }
  const uncertainty: UncertaintyLevel = uScore >= 5 ? "high" : uScore >= 2 ? "medium" : "low";

  // Upside
  const upsideDrivers: string[] = [];
  let upScore = 0;
  if (points.length > 200) {
    upScore += 2;
    upsideDrivers.push(`${points.length} anomalías detectadas (alto volumen de señales).`);
  }
  if (geo > 50 && sat > 50) {
    upScore += 1;
    upsideDrivers.push("Coincidencia multi-fuente (geofísica + satelital).");
  }
  if (blockModel && blockModel.stats.gradeMean > 0.5) {
    upScore += 2;
    upsideDrivers.push(
      `Ley media estimada ${blockModel.stats.gradeMean.toFixed(2)} sobre cutoff típico.`,
    );
  }
  if (blockModel && blockModel.stats.metalTotal > 0) {
    upScore += 1;
    upsideDrivers.push(
      `Metal contenido estimado: ${blockModel.stats.metalTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${blockModel.commodity}.`,
    );
  }
  if (area && area > 5) {
    upScore += 1;
    upsideDrivers.push(`Footprint anómalo amplio (~${area.toFixed(1)} km²).`);
  }
  const upside: UpsideLevel =
    upScore >= 5 ? "exceptional" : upScore >= 3 ? "high" : upScore >= 1 ? "moderate" : "limited";

  // Risks
  const risks: string[] = [];
  if (critical > 0)
    risks.push(`QA/QC crítico: ${critical} issue(s) deben resolverse antes de reportar recursos.`);
  if (spacing && spacing > 300)
    risks.push("Espaciamiento insuficiente: clasificación Measured no defendible.");
  if (bundle && bundle.errors.length > 0)
    risks.push(`Errores de importación: ${bundle.errors.length} filas rechazadas.`);
  if (aiHoles > 0 && holes.length > 0 && aiHoles / holes.length > 0.5) {
    risks.push(
      "Más del 50% de los sondajes son targets propuestos por IA — falta validación física.",
    );
  }
  if (!blockModel) risks.push("Sin modelo de bloques activo — economía y NPV son indicativos.");
  if (risks.length === 0) risks.push("Sin riesgos materiales detectados en la corrida actual.");

  // Next steps
  const nextSteps: string[] = [];
  if (critical > 0) nextSteps.push("1. Resolver issues críticos de QA/QC.");
  if (spacing && spacing > 150)
    nextSteps.push(`2. Cerrar malla de sondajes a ≤150 m (actual ${spacing.toFixed(0)} m).`);
  if (blockModel && inferred > indicated * 2)
    nextSteps.push(
      "3. Convertir Inferred → Indicated con sondajes infill en clusters de alto grade.",
    );
  if (geo > 0 && holes.length < 20)
    nextSteps.push("4. Priorizar drilling sobre anomalías geofísicas de mayor intensidad.");
  if (upside === "exceptional" || upside === "high")
    nextSteps.push("5. Preparar borrador NI 43-101 preliminar y campaña de delineación.");
  if (nextSteps.length === 0)
    nextSteps.push(
      "Mantener monitoreo de anomalías satelitales y validar con campaña geofísica adicional.",
    );

  // Interpretation narrative
  const interpretation: string[] = [];
  interpretation.push(
    `Se identifican ${points.length} anomalías (${geo} geofísicas / ${sat} satelitales) distribuidas sobre ${area ? area.toFixed(1) + " km²" : "área indeterminada"}.`,
  );
  if (blockModel) {
    interpretation.push(
      `El modelo de bloques arroja ${blockModel.count.toLocaleString()} bloques, ley media ${blockModel.stats.gradeMean.toFixed(2)} y tonelaje total ${(blockModel.stats.tonnesTotal / 1_000_000).toFixed(2)} Mt (clasificación M/I/I: ${measured}/${indicated}/${inferred}).`,
    );
  } else {
    interpretation.push(
      "Sin block model activo: la cuantificación de recursos no está disponible en esta corrida.",
    );
  }
  if (holes.length > 0) {
    interpretation.push(
      `${holes.length} sondajes en la base${spacing ? ` con espaciamiento medio ${spacing.toFixed(0)} m` : ""}${aiHoles > 0 ? `, de los cuales ${aiHoles} son targets propuestos por IA` : ""}.`,
    );
  }
  if (qaqc) {
    interpretation.push(
      `QA/QC: ${critical} críticos, ${warning} warnings sobre ${qaqc.summary.totalAssays} muestras de assay.`,
    );
  }

  const headline =
    upside === "exceptional"
      ? "Sistema mineralizado de alto potencial con upside excepcional"
      : upside === "high"
        ? "Target prioritario con upside alto y data suficiente para fase de delineación"
        : upside === "moderate"
          ? "Sistema prospectivo de upside moderado — requiere validación adicional"
          : "Señales preliminares: se recomienda continuar exploración temprana";

  return {
    generatedAt: new Date().toISOString(),
    headline,
    interpretation,
    uncertainty,
    uncertaintyDrivers,
    upside,
    upsideDrivers,
    risks,
    nextSteps,
    stats: {
      anomalies: points.length,
      geophysics: geo,
      satellite: sat,
      drillholes: holes.length,
      aiHoles,
      blocks: blockModel?.count ?? 0,
      measured,
      indicated,
      inferred,
      qaqcCritical: critical,
      qaqcWarning: warning,
      avgSpacingM: spacing,
      bboxAreaKm2: area,
    },
  };
}
