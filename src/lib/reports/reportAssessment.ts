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
  for (const q of model.dataQuality ?? []) parts.push(`Calidad [${q.status}] ${q.label}: ${q.detail}`);
  for (const s of model.sections) {
    const body = s.blocks.map(blockText).filter(Boolean).join("\n");
    if (body) parts.push(`## ${s.title}\n${clip(body, 1800)}`);
  }
  return clip(parts.join("\n"), 18000);
}

const PRIORITY: Record<"P1" | "P2" | "P3", "high" | "medium" | "low"> = {
  P1: "high",
  P2: "medium",
  P3: "low",
};

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
    ...a.synthesis.map((body) => ({ kind: "narrative" as const, body, provenance: "INTERPRETED" as never })),
  ];
  if (priorities.length) {
    blocks.push({
      kind: "table",
      head: ["Prioridad", "Objetivo", "Fundamento", "Evidencia", "Acción"],
      rows: priorities.map((p) => [p.level, p.target, p.rationale, p.evidence, p.action]),
      widths: [0.09, 0.17, 0.27, 0.25, 0.22],
    });
    for (const p of priorities.filter((p) => p.level === "P1"))
      blocks.push({ kind: "recommendation", title: `${p.level} · ${p.target}`, body: p.action, priority: PRIORITY[p.level] });
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
