// Procedencia de un dato del proyecto (semáforo de certificación) y secciones
// de la ficha de datos. Lógica pura y testeable. GeoCapitals distingue lo
// probado de lo declarado: esta capa es esa distinción.

export const PROVENANCE_STATES = ["certificado", "declarado", "a_verificar"] as const;
export type Provenance = (typeof PROVENANCE_STATES)[number];

export const PROVENANCE_LABELS: Record<Provenance, string> = {
  certificado: "Certificado",
  declarado: "Declarado",
  a_verificar: "A verificar",
};

/** Descripción del estado, para tooltips/leyenda. */
export const PROVENANCE_DESC: Record<Provenance, string> = {
  certificado: "Verificado por tercero, QP o estándar (NI 43-101, JORC).",
  declarado: "Informado por el dueño, con fuente pero sin verificación independiente.",
  a_verificar: "Pendiente de confirmación. Entra al checklist de due diligence.",
};

/** Clases de color del semáforo (verde / ámbar / rojo). */
export const PROVENANCE_TONE: Record<Provenance, string> = {
  certificado: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30",
  declarado: "text-amber-700 bg-amber-500/10 border-amber-500/30",
  a_verificar: "text-red-700 bg-red-500/10 border-red-500/30",
};

export function normalizeProvenance(v: string | null | undefined): Provenance {
  const s = (v ?? "").toLowerCase().trim();
  return (PROVENANCE_STATES as readonly string[]).includes(s) ? (s as Provenance) : "a_verificar";
}

export const FACT_SECTIONS = [
  "activo",
  "geologia",
  "oro",
  "tierras_raras",
  "economico",
  "catastro",
  "legal",
  "otro",
] as const;
export type FactSection = (typeof FACT_SECTIONS)[number];

export const FACT_SECTION_LABELS: Record<FactSection, string> = {
  activo: "Activo",
  geologia: "Geología",
  oro: "Oro",
  tierras_raras: "Tierras raras",
  economico: "Económico",
  catastro: "Catastro",
  legal: "Legal / societario",
  otro: "Otro",
};

export function normalizeSection(v: string | null | undefined): FactSection {
  const s = (v ?? "").toLowerCase().trim();
  return (FACT_SECTIONS as readonly string[]).includes(s) ? (s as FactSection) : "otro";
}

export type FactLike = { provenance: string };

export type ProvenanceSummary = {
  total: number;
  certificado: number;
  declarado: number;
  aVerificar: number;
  /** % de datos certificados sobre el total (0–100). */
  certifiedPct: number;
};

/** Resumen de procedencia: cuántos datos hay en cada estado. */
export function summarizeProvenance(facts: FactLike[]): ProvenanceSummary {
  let certificado = 0;
  let declarado = 0;
  let aVerificar = 0;
  for (const f of facts) {
    const p = normalizeProvenance(f.provenance);
    if (p === "certificado") certificado += 1;
    else if (p === "declarado") declarado += 1;
    else aVerificar += 1;
  }
  const total = facts.length;
  return {
    total,
    certificado,
    declarado,
    aVerificar,
    certifiedPct: total > 0 ? Math.round((certificado / total) * 100) : 0,
  };
}
