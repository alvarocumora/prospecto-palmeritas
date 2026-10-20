// Utilidades puras: resumen del modelo documental para la IA y sección de
// prioridades insertada en el informe técnico global.
import type { DocBlock, DocSection, ProjectDoc } from "@/lib/pdf/model";
import type { ReportAssessment } from "./reportAssessment.functions";

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function blockText(b: DocBlock): string {
  switch (b.kind) {
    case "narrative":
    case "text":
      return b.body;
    case "finding":
    case "gap":
    case "recommendation":
      return `${b.title}: ${b.body}`;
    case "evidence":
      return `[${b.provenance}] ${b.label}: ${b.body}`;
    case "bullets":
      return b.items.join("; ");
    case "kv":
      return b.items.map(([k, v]) => `${k}: ${v}`).join("; ");
    case "table":
    case "appendixTable":
      return [b.head.join(" | "), ...b.rows.slice(0, 12).map((r) => r.join(" | "))].join("\n");
    default:
      return "";
  }
}

/** Resumen compacto y determinístico del informe (máx. ~18k caracteres). */
export function buildReportDigest(model: ProjectDoc): string {
  const parts: string[] = [
    `Ubicación: ${model.location} · Commodity: ${model.commodity} · Etapa: ${model.stage}`,
    `KPIs: ${model.kpis.map((k) => `${k.label}=${k.value}${k.note ? ` (${k.note})` : ""}`).join("; ")}`,
    `Tesis: ${model.thesis.join(" ")}`,
  ];
  for (const q of model.dataQuality ?? [])
    parts.push(`Calidad [${q.status}] ${q.label}: ${q.detail}`);
  for (const s of model.sections) {
    const body = s.blocks.map(blockText).filter(Boolean).join("\n");
    if (body) parts.push(`## ${s.title}${s.lead ? ` — ${s.lead}` : ""}\n${clip(body, 3500)}`);
  }
  const m = model.map;
  if (m) {
    parts.push(
      `Mapa: ${m.title}${m.source ? ` · fuente ${m.source}` : ""}${m.crs ? ` · ${m.crs}` : ""}`,
    );
    if (m.points?.length)
      parts.push(
        `Puntos mapeados (${m.points.length}): ${m.points
          .slice(0, 40)
          .map((p) => JSON.stringify(p))
          .join("; ")}`,
      );
    if (m.snapshotManifest)
      parts.push(`Capas del visor: ${clip(JSON.stringify(m.snapshotManifest), 1500)}`);
  }
  if (model.milestones?.length)
    parts.push(`Hitos: ${model.milestones.map((h) => `${h.when}: ${h.what}`).join("; ")}`);
  if (model.disclaimers.length) parts.push(`Avisos: ${model.disclaimers.join(" ")}`);
  return clip(parts.join("\n"), 38000);
}

const PRIORITY: Record<"P1" | "P2" | "P3", "high" | "medium" | "low"> = {
  P1: "high",
  P2: "medium",
  P3: "low",
};

const AI_NOTE =
  "Síntesis asistida por IA sobre la evidencia del informe (INTERPRETADO). No constituye estimación de recursos ni reservas, ni opinión de una Persona Calificada/Competente, ni recomendación de inversión.";

/** Resúmenes ejecutivos técnico y para inversionistas, y plan de trabajo. */
export function assessmentSections(a: ReportAssessment): DocSection[] {
  const out: DocSection[] = [];
  if (a.technicalSummary.length || a.investorSummary.length)
    out.push({
      eyebrow: "RESUMEN EJECUTIVO",
      title: "Resumen técnico y para inversionistas",
      lead: `Prospectividad ${a.prospectivity.toLowerCase()} · confianza ${a.confidence.toLowerCase()}.`,
      deck: true,
      blocks: [
        ...a.technicalSummary.map((body) => ({
          kind: "finding" as const,
          title: "Lectura técnica",
          body,
          provenance: "INTERPRETED" as const,
        })),
        ...a.investorSummary.map((body) => ({
          kind: "finding" as const,
          title: "Para inversionistas",
          body,
          provenance: "INTERPRETED" as const,
        })),
        { kind: "text", body: AI_NOTE },
      ],
    });
  out.push(assessmentSection(a));
  if (a.workPlan.length)
    out.push({
      eyebrow: "PLAN DE TRABAJO",
      title: "Plan de verificación por fases",
      lead: "Secuencia propuesta para reducir incertidumbre; duraciones orientativas, sin costos estimados.",
      blocks: [
        {
          kind: "table",
          head: ["Fase", "Actividades", "Duración", "Entregable", "Criterio para avanzar"],
          rows: a.workPlan.map((w) => [
            w.phase,
            w.activities,
            w.duration,
            w.deliverable,
            w.decisionGate,
          ]),
          widths: [0.14, 0.32, 0.1, 0.2, 0.24],
        },
        { kind: "text", body: AI_NOTE },
      ],
    });
  return out;
}

/** Sección "Evaluación y prioridades" con procedencia INTERPRETADA. */
export function assessmentSection(a: ReportAssessment): DocSection {
  const order = { P1: 0, P2: 1, P3: 2 } as const;
  const priorities = [...a.priorities].sort((x, y) => order[x.level] - order[y.level]);
  const blocks: DocBlock[] = [
    {
      kind: "kv",
      items: [
        ["Prospectividad cualitativa", a.prospectivity],
        ["Confianza de la evidencia", a.confidence],
        ["Procedencia", "INTERPRETADO · síntesis asistida por IA sobre evidencia del informe"],
      ],
    },
    ...a.synthesis.map((body) => ({
      kind: "narrative" as const,
      body,
      provenance: "INTERPRETED" as const,
    })),
  ];
  if (priorities.length) {
    blocks.push({
      kind: "table",
      head: ["Prioridad", "Objetivo", "Fundamento", "Evidencia", "Acción"],
      rows: priorities.map((p) => [p.level, p.target, p.rationale, p.evidence, p.action]),
      widths: [0.09, 0.17, 0.27, 0.25, 0.22],
    });
    for (const p of priorities.filter((p) => p.level === "P1"))
      blocks.push({
        kind: "recommendation",
        title: `${p.level} · ${p.target}`,
        body: p.action,
        priority: PRIORITY[p.level],
      });
  }
  for (const g of a.gaps) blocks.push({ kind: "gap", title: "Vacío de información", body: g });
  if (a.nextSteps.length) blocks.push({ kind: "bullets", items: a.nextSteps });
  blocks.push({
    kind: "text",
    body: "Evaluación cualitativa asistida por IA. No constituye estimación de recursos ni reservas, ni opinión de una Persona Calificada/Competente. Las prioridades orientan la verificación de campo.",
  });
  return {
    eyebrow: "EVALUACIÓN TÉCNICA",
    title: "Estimación y matriz de prioridades",
    lead: "Lectura consolidada de la evidencia del informe, ordenada por prioridad de verificación.",
    blocks,
  };
}
