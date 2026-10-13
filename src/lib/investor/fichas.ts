// Fichas de inversión de los proyectos showcase — la vista "inversionista":
// estado, valorización, ticket, ROI por escenario y simulación de inversión.
//
// IMPORTANTE: los términos económicos son REFERENCIALES, definidos por el
// equipo Geocapitals como base de conversación. No constituyen oferta pública
// y están sujetos a due diligence, NDA y acuerdo definitivo. Este archivo es
// la única fuente: editar aquí actualiza ficha, simulador y cards.

import { NAHUELBUTA } from "@/features/nahuelbuta/data/nahuelbuta";
import { CHOLQUI, CHOLQUI_HIGHLIGHTS, CHOLQUI_ROUND } from "@/features/franco/data/cholqui";

export type FichaSlug = "palmeras" | "losverdes" | "cholqui" | "nahuelbuta";

export type InvestmentScenario = {
  key: "conservador" | "base" | "optimista";
  label: string;
  /** Múltiplo sobre el capital invertido al horizonte (MOIC). */
  multiple: number;
  note: string;
};

export type ProjectFicha = {
  slug: FichaSlug;
  code: string;
  name: string;
  region: string;
  country: string;
  commodity: string;
  /** Etapa del proyecto en lenguaje inversionista. */
  stage: string;
  stageDetail: string;
  liveTo: string;
  reportTo?: string;
  highlights: string[];
  /** Valorización referencial del activo (rango, con método declarado). */
  valuationUsd: { low: number; high: number; method: string };
  /** Ronda que se levanta. */
  roundSizeUsd: number;
  minTicketUsd: number;
  instrument: string;
  /** % de la sociedad ofrecido por la ronda completa. */
  equityOfferedPct: number;
  horizonYears: number;
  scenarios: InvestmentScenario[];
  useOfFunds: Array<{ label: string; pct: number }>;
  milestones: Array<{ when: string; what: string }>;
};

const SCENARIOS_STD: InvestmentScenario[] = [
  {
    key: "conservador",
    label: "Conservador",
    multiple: 1.6,
    note: "Avance parcial de exploración; venta temprana del activo.",
  },
  {
    key: "base",
    label: "Base",
    multiple: 3,
    note: "Campaña cumple hitos; reventa o farm-out con recursos definidos.",
  },
  {
    key: "optimista",
    label: "Optimista",
    multiple: 6,
    note: "Descubrimiento relevante; entrada de socio estratégico o major.",
  },
];

export const FICHAS: Record<FichaSlug, ProjectFicha> = {
  palmeras: {
    slug: "palmeras",
    code: "PALMERAS",
    name: "Prospecto Las Palmeras",
    region: "Illapel · Coquimbo",
    country: "Chile",
    commodity: "Au-Ag",
    stage: "Exploración avanzada",
    stageDetail: "74 concesiones (12.807 ha), 16 sondajes (4.426 m) y 12 anomalías satelitales.",
    liveTo: "/terminal/palmeras",
    highlights: [
      "74 concesiones · 12.807 ha bajo control",
      "16 sondajes · 4.426 m perforados",
      "12 anomalías satelitales priorizadas (4 high)",
    ],
    valuationUsd: { low: 5_000_000, high: 8_000_000, method: "Comparables + gasto histórico" },
    roundSizeUsd: 1_200_000,
    minTicketUsd: 25_000,
    instrument: "Equity SpA",
    equityOfferedPct: 15,
    horizonYears: 4,
    scenarios: SCENARIOS_STD,
    useOfFunds: [
      { label: "Perforación (campaña 2ª fase)", pct: 55 },
      { label: "Geofísica y satélite", pct: 15 },
      { label: "Patentes y catastro", pct: 12 },
      { label: "Estudios y QP / NI 43-101", pct: 10 },
      { label: "Administración", pct: 8 },
    ],
    milestones: [
      { when: "T3 2026", what: "Campaña de perforación fase 2 (8 sondajes)" },
      { when: "T4 2026", what: "Modelo geológico actualizado + targets IA" },
      { when: "T1 2027", what: "Informe técnico pre-NI 43-101" },
    ],
  },
  losverdes: {
    slug: "losverdes",
    code: "LOSVERDES",
    name: "Los Verdes",
    region: "Los Vilos · Choapa · Coquimbo",
    country: "Chile",
    commodity: "Cu-Mo",
    stage: "Exploración avanzada · compliance en curso",
    stageDetail:
      "AOI 3D con satélite multi-índice, targets generados por IA y compliance NI 43-101 en curso.",
    liveTo: "/terminal/losverdes",
    reportTo: "/reports/losverdes/pre43101",
    highlights: [
      "Distrito cuprífero con vetas reconocidas",
      "Targets IA sobre anomalías multiespectrales",
      "Informe pre-NI 43-101 publicado en la plataforma",
    ],
    valuationUsd: { low: 8_000_000, high: 12_000_000, method: "Cubicación interna + comparables" },
    roundSizeUsd: 1_500_000,
    minTicketUsd: 50_000,
    instrument: "Equity SpA",
    equityOfferedPct: 12,
    horizonYears: 5,
    scenarios: SCENARIOS_STD,
    useOfFunds: [
      { label: "Perforación de validación", pct: 50 },
      { label: "Geología de detalle y muestreo", pct: 18 },
      { label: "Compliance NI 43-101 / QP", pct: 12 },
      { label: "Patentes y catastro", pct: 12 },
      { label: "Administración", pct: 8 },
    ],
    milestones: [
      { when: "T3 2026", what: "Cierre informe pre-NI 43-101 y QA/QC" },
      { when: "T4 2026", what: "Perforación de validación de targets IA" },
      { when: "T2 2027", what: "Estimación de recursos inicial" },
    ],
  },
  // Cholqui: los términos vienen de la fuente única del proyecto
  // (src/features/franco/data/cholqui.ts), la misma que alimenta el live view
  // y el PDF de inversión — nunca duplicar cifras aquí.
  cholqui: {
    slug: "cholqui",
    code: CHOLQUI.code,
    name: CHOLQUI.name,
    region: CHOLQUI.region,
    country: CHOLQUI.country,
    commodity: CHOLQUI.commodity,
    stage: CHOLQUI.stage,
    stageDetail:
      "Proyecto Cu-Au-Ag con muestreo de superficie a laboratorio certificado y faena vecina (Mina Las Minitas, de un tercero) en producción sobre la misma estructura. Sin estimación de recursos ni reservas bajo estándar reconocido.",
    liveTo: CHOLQUI.liveUrl,
    highlights: [...CHOLQUI_HIGHLIGHTS].slice(0, 3),
    valuationUsd: {
      low: CHOLQUI_ROUND.valuationLowUsd,
      high: CHOLQUI_ROUND.valuationHighUsd,
      method: CHOLQUI_ROUND.valuationMethod,
    },
    roundSizeUsd: CHOLQUI_ROUND.roundSizeUsd,
    minTicketUsd: CHOLQUI_ROUND.minTicketUsd,
    instrument: CHOLQUI_ROUND.instrument,
    equityOfferedPct: CHOLQUI_ROUND.equityOfferedPct,
    horizonYears: CHOLQUI_ROUND.horizonYears,
    scenarios: SCENARIOS_STD,
    useOfFunds: CHOLQUI_ROUND.useOfFunds.map((u) => ({ label: u.label, pct: u.pct })),
    milestones: CHOLQUI_ROUND.milestones.map((m) => ({ when: m.when, what: m.what })),
  },
  // Nahuelbuta: sin términos de ronda definidos; la referencia es el
  // presupuesto de Fase 1 del informe técnico (no es valorización).
  nahuelbuta: {
    slug: "nahuelbuta",
    code: NAHUELBUTA.code,
    name: NAHUELBUTA.name,
    region: NAHUELBUTA.region,
    country: NAHUELBUTA.country,
    commodity: NAHUELBUTA.commodity,
    stage: NAHUELBUTA.stage,
    stageDetail:
      "34 paños Arcillas en solicitud (10.200 ha) sobre el Complejo Metamórfico Nahuelbuta. Sin perforaciones ni muestras de laboratorio; sin recursos ni reservas.",
    liveTo: NAHUELBUTA.liveUrl,
    highlights: [
      "34 paños Arcillas · 10.200 ha en solicitud",
      "Saprolito arcilloso de 5 a 20 m descrito en el informe técnico",
      "Fase 1 recomendada: US$ 380.000 en 18 meses",
    ],
    valuationUsd: {
      low: NAHUELBUTA.fase1.budgetUsd,
      high: NAHUELBUTA.fase1.budgetUsd,
      method: "Por definir — se muestra el presupuesto de Fase 1, no una valorización",
    },
    roundSizeUsd: NAHUELBUTA.fase1.budgetUsd,
    minTicketUsd: 25_000,
    instrument: "Por definir",
    equityOfferedPct: 0,
    horizonYears: 2,
    scenarios: SCENARIOS_STD,
    useOfFunds: [
      { label: "Geofísica aérea VTEM", pct: 45 },
      { label: "Muestreo de saprolito (TREO, HREE)", pct: 30 },
      { label: "Cartografía geológica de detalle", pct: 15 },
      { label: "Patentes, títulos y consulta territorial", pct: 10 },
    ],
    milestones: NAHUELBUTA.milestones.map((m) => ({ when: m.when, what: m.what })),
  },
};

export function getFicha(slug: string): ProjectFicha | null {
  const canonicalSlug = slug === "franco" ? "cholqui" : slug === "tilama" ? "losverdes" : slug;
  return (FICHAS as Record<string, ProjectFicha>)[canonicalSlug] ?? null;
}

export type SimulationRow = {
  key: InvestmentScenario["key"];
  label: string;
  multiple: number;
  note: string;
  /** Valor bruto estimado de la posición al horizonte. */
  grossUsd: number;
  profitUsd: number;
  roiPct: number;
  /** TIR aproximada: multiple^(1/años) - 1. */
  irrApproxPct: number;
};

export type Simulation = {
  amountUsd: number;
  /** Participación estimada si la ronda completa coloca equityOfferedPct. */
  sharePct: number;
  horizonYears: number;
  rows: SimulationRow[];
};

/**
 * Simulación pura de inversión sobre una ficha. Clampa el monto al rango
 * [ticket mínimo, tamaño de la ronda].
 */
export function simulateInvestment(ficha: ProjectFicha, amountUsd: number): Simulation {
  const amount = Math.min(Math.max(amountUsd, ficha.minTicketUsd), ficha.roundSizeUsd);
  const sharePct = (amount / ficha.roundSizeUsd) * ficha.equityOfferedPct;
  const rows: SimulationRow[] = ficha.scenarios.map((s) => {
    const gross = amount * s.multiple;
    const profit = gross - amount;
    const irr = Math.pow(s.multiple, 1 / ficha.horizonYears) - 1;
    return {
      key: s.key,
      label: s.label,
      multiple: s.multiple,
      note: s.note,
      grossUsd: gross,
      profitUsd: profit,
      roiPct: (profit / amount) * 100,
      irrApproxPct: irr * 100,
    };
  });
  return { amountUsd: amount, sharePct, horizonYears: ficha.horizonYears, rows };
}

export function fmtUsd0(n: number): string {
  return `US$ ${Math.round(n).toLocaleString("es-CL")}`;
}
