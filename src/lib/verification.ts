// Capa de confianza: clasificación honesta del origen de los datos.
//
// Tres niveles, en orden de garantía creciente:
//  - "demo"        → proyecto de muestra usado para demostrar la plataforma.
//  - "traceable"   → datos reales cargados en la base productiva (catastro,
//                    sondajes, satélite) con trazabilidad de origen, pero aún
//                    sin firma de una Qualified Person.
//  - "qp_verified" → revisado y firmado por una Qualified Person registrada
//                    (NI 43-101 / JORC). Reservado: se puebla cuando exista el
//                    convenio con QP firmante (Fase 1 del roadmap).

export type VerificationLevel = "pending" | "demo" | "traceable" | "qp_verified";

/** Proyectos de muestra: se etiquetan "demo" en toda la superficie pública. */
export const DEMO_PROJECT_IDS: readonly string[] = [];

/** Proyectos con firma QP. Vacío hasta cerrar el convenio con la Qualified Person. */
export const QP_VERIFIED_PROJECT_IDS: readonly string[] = [];

export function projectVerification(projectId: string | null | undefined): VerificationLevel {
  if (projectId && QP_VERIFIED_PROJECT_IDS.includes(projectId)) return "qp_verified";
  if (projectId && DEMO_PROJECT_IDS.includes(projectId)) return "demo";
  return "pending";
}

export const VERIFICATION_META: Record<
  VerificationLevel,
  { label: string; short: string; description: string }
> = {
  pending: {
    label: "Evidencia por revisar",
    short: "En revisión",
    description: "La procedencia y la revisión técnica deben comprobarse en las evidencias del activo. Esta etiqueta no acredita verificación por Qualified Person.",
  },
  demo: {
    label: "Datos demo",
    short: "Demo",
    description:
      "Proyecto de muestra para demostrar las capacidades de la plataforma. No representa una oportunidad de inversión activa.",
  },
  traceable: {
    label: "Datos trazables",
    short: "Trazable",
    description:
      "Información real cargada en la base de datos productiva con trazabilidad de origen (catastro, sondajes, satélite). Pendiente de revisión por Qualified Person.",
  },
  qp_verified: {
    label: "Verificado QP",
    short: "QP ✓",
    description:
      "Datos revisados y firmados por una Qualified Person registrada bajo estándar NI 43-101 / JORC.",
  },
};
