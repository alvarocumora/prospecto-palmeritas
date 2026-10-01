import type { ReportProfile } from "@/lib/pdf/architecture";

export type ReportProductId =
  "executive_summary" | "investment_memorandum" | "exploration_targeting" | "technical_evidence";

export type ReportProduct = {
  id: ReportProductId;
  title: string;
  shortTitle: string;
  audience: string;
  purpose: string;
  profile: ReportProfile | null;
  output: string;
  status: "available" | "foundation" | "planned";
  standardLabel: string;
};

export const REPORT_PRODUCTS: readonly ReportProduct[] = [
  {
    id: "executive_summary",
    title: "Executive Summary",
    shortTitle: "Resumen ejecutivo",
    audience: "Propietarios, socios e inversionistas en primera revisión",
    purpose:
      "Sintetizar en 1–2 páginas qué se sabe, qué falta y cuál es el siguiente hito de reducción de riesgo.",
    profile: null,
    output: "PDF A4 · 1–2 páginas",
    status: "foundation",
    standardLabel: "Executive communication",
  },
  {
    id: "investment_memorandum",
    title: "Investment Memorandum",
    shortTitle: "Memorándum de inversión",
    audience: "Family offices, fondos y comités de inversión",
    purpose:
      "Explicar tesis, base de evidencia, riesgos, escenarios, capital requerido y ruta de de-risking.",
    profile: "investment",
    output: "PDF A4 · 10–20 páginas + anexos",
    status: "foundation",
    standardLabel: "Investment due diligence",
  },
  {
    id: "exploration_targeting",
    title: "Exploration Targeting Report",
    shortTitle: "Informe de targeting",
    audience: "Geólogos, equipos de exploración y revisores técnicos",
    purpose:
      "Preservar la cadena reproducible desde datasets y anomalías hasta targets, ground truth y perforación conceptual.",
    profile: "targeting",
    output: "PDF A4 · 15–30 páginas + anexos",
    status: "foundation",
    standardLabel: "Exploration evidence chain",
  },
  {
    id: "technical_evidence",
    title: "Technical Evidence Report",
    shortTitle: "Informe técnico",
    audience: "Due diligence técnica, QP/CP y revisores independientes",
    purpose:
      "Presentar hechos, procedencia, calidad de datos, interpretación, limitaciones y programa recomendado.",
    profile: "technical",
    output: "PDF A4 · extensión variable",
    status: "foundation",
    standardLabel: "NI 43-101 / JORC review-ready",
  },
] as const;

export const REPORTING_PRINCIPLES = [
  "Narrative-first: texto técnico, mapas y figuras antes que tablas.",
  "Una fuente canónica de evidencia por proyecto; los informes no duplican datasets.",
  "Las tablas extensas viven en anexos salvo que sean materiales para la decisión.",
  "DERIVED, INTERPRETED, PROPOSED y SCENARIO nunca se presentan como hechos medidos.",
  "Una sección sin evidencia suficiente se muestra como gap; no se completa con texto genérico.",
] as const;
