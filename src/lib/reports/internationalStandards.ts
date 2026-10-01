export type DisclosureStandard = "NI_43_101" | "JORC_2012";

export type StandardChecklistItem = {
  id: string;
  title: string;
  description: string;
  requiredForDelivery: boolean;
};

export type StandardFramework = {
  id: DisclosureStandard;
  name: string;
  positioning: string;
  reviewerRole: string;
  checklist: readonly StandardChecklistItem[];
};

export const STANDARD_FRAMEWORKS: Record<DisclosureStandard, StandardFramework> = {
  NI_43_101: {
    id: "NI_43_101",
    name: "NI 43-101 / Form 43-101F1",
    positioning:
      "Estructura preparada para revisión técnica bajo NI 43-101. No debe rotularse como Technical Report NI 43-101 hasta contar con Qualified Person y demás requisitos aplicables.",
    reviewerRole: "Qualified Person (QP)",
    checklist: [
      {
        id: "scope",
        title: "Scope, purpose and reliance",
        description:
          "Definir propósito del informe, destinatario, alcance y dependencia de terceros.",
        requiredForDelivery: true,
      },
      {
        id: "property",
        title: "Property description and ownership",
        description:
          "Identificar propiedad, derechos mineros, ubicación, CRS y materialidad legal.",
        requiredForDelivery: true,
      },
      {
        id: "history_geology",
        title: "History and geological setting",
        description: "Separar antecedentes históricos, geología observada e interpretación actual.",
        requiredForDelivery: true,
      },
      {
        id: "exploration_data",
        title: "Exploration, sampling and QA/QC",
        description:
          "Documentar métodos, datos de entrada, muestreo, laboratorio y controles de calidad.",
        requiredForDelivery: true,
      },
      {
        id: "verification",
        title: "Data verification",
        description: "Declarar qué datos fueron verificados, por quién y con qué limitaciones.",
        requiredForDelivery: true,
      },
      {
        id: "resources",
        title: "Mineral resources / reserves",
        description:
          "Sólo incluir estimaciones cuando exista base técnica y revisión competente suficiente; de lo contrario declarar explícitamente que no existen recursos/reservas declarados.",
        requiredForDelivery: true,
      },
      {
        id: "interpretation_recommendations",
        title: "Interpretation and recommendations",
        description:
          "Distinguir interpretación, incertidumbre, riesgos y programa de trabajo recomendado.",
        requiredForDelivery: true,
      },
      {
        id: "qp",
        title: "Qualified Person review",
        description:
          "Registrar identidad, responsabilidad, revisión y aprobación del QP cuando corresponda.",
        requiredForDelivery: true,
      },
    ],
  },
  JORC_2012: {
    id: "JORC_2012",
    name: "JORC Code 2012 · Table 1",
    positioning:
      "Estructura orientada a transparencia, materialidad y competencia. La plataforma puede preparar evidencia y checklist, pero la declaración pública requiere Competent Person y cumplimiento del código aplicable.",
    reviewerRole: "Competent Person (CP)",
    checklist: [
      {
        id: "sampling",
        title: "Sampling techniques and data",
        description: "Métodos de muestreo, recuperación, logging, submuestreo y calidad analítica.",
        requiredForDelivery: true,
      },
      {
        id: "reporting",
        title: "Reporting of exploration results",
        description:
          "Ubicación, tenencia, contexto geológico, método de agregación y balance de la divulgación.",
        requiredForDelivery: true,
      },
      {
        id: "estimation",
        title: "Estimation and reporting of Mineral Resources",
        description:
          "Checklist sólo habilitable cuando exista estimación técnicamente sustentada; no usar para material conceptual.",
        requiredForDelivery: false,
      },
      {
        id: "reserves",
        title: "Estimation and reporting of Ore Reserves",
        description:
          "Aplicable únicamente cuando exista conversión de recursos y factores modificadores suficientes.",
        requiredForDelivery: false,
      },
      {
        id: "competent_person",
        title: "Competent Person review",
        description: "Registrar la responsabilidad y aprobación de la Competent Person.",
        requiredForDelivery: true,
      },
    ],
  },
};

export type ReviewStatus = "missing" | "in_progress" | "ready_for_review" | "reviewed";

export function standardCompletion(
  framework: StandardFramework,
  statuses: Partial<Record<string, ReviewStatus>>,
) {
  const required = framework.checklist.filter((item) => item.requiredForDelivery);
  const ready = required.filter((item) => statuses[item.id] === "reviewed").length;
  return {
    required: required.length,
    reviewed: ready,
    pct: required.length ? Math.round((ready / required.length) * 100) : 0,
  };
}
