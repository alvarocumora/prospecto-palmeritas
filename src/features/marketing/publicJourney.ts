export type PublicJourneyIntent = "investor" | "owner" | "advisor";

export type PublicJourneyStep = {
  id: string;
  label: string;
  description: string;
  href: string;
};

export type PublicJourneyDefinition = {
  intent: PublicJourneyIntent;
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  authSearch: {
    intent: "investor" | "owner" | "team";
    mode: "signup";
  };
  steps: PublicJourneyStep[];
};

export const PUBLIC_JOURNEYS: Record<PublicJourneyIntent, PublicJourneyDefinition> = {
  investor: {
    intent: "investor",
    eyebrow: "Capital e inversión",
    title: "Encuentra y evalúa oportunidades mineras verificadas",
    description:
      "Explora proyectos, compara riesgo y retorno, solicita acceso al data room y continúa el proceso en el Terminal de inversión.",
    primaryLabel: "Explorar oportunidades",
    primaryHref: "/oportunidades",
    authSearch: { intent: "investor", mode: "signup" },
    steps: [
      {
        id: "discover",
        label: "Descubrir",
        description: "Explora oportunidades públicas por región, commodity, etapa y modalidad.",
        href: "/oportunidades",
      },
      {
        id: "evaluate",
        label: "Evaluar",
        description: "Revisa información técnica, económica, catastro y señales de riesgo.",
        href: "/inversionistas",
      },
      {
        id: "access",
        label: "Solicitar acceso",
        description: "Inicia KYC/AML y solicita acceso institucional al data room.",
        href: "/auth?intent=investor&mode=signup",
      },
      {
        id: "operate",
        label: "Operar",
        description: "Gestiona portafolio, alertas y due diligence desde el Terminal.",
        href: "/terminal",
      },
    ],
  },
  owner: {
    intent: "owner",
    eyebrow: "Propietarios y compañías",
    title: "Estructura tu activo y conéctalo con capital institucional",
    description:
      "Publica el proyecto, organiza evidencia técnica y legal, prepara el data room y gestiona conversaciones con inversionistas.",
    primaryLabel: "Publicar un proyecto",
    primaryHref: "/auth?intent=owner&mode=signup",
    authSearch: { intent: "owner", mode: "signup" },
    steps: [
      {
        id: "register",
        label: "Crear cuenta",
        description: "Registra la compañía y define el equipo responsable del proyecto.",
        href: "/auth?intent=owner&mode=signup",
      },
      {
        id: "structure",
        label: "Estructurar",
        description: "Conecta catastro, exploración, cumplimiento y documentación técnica.",
        href: "/proyectos",
      },
      {
        id: "publish",
        label: "Publicar",
        description: "Configura modalidad, términos, visibilidad y material para inversionistas.",
        href: "/marketplace",
      },
      {
        id: "raise",
        label: "Levantar capital",
        description: "Administra interés, data rooms y deal-flow desde el workspace.",
        href: "/terminal",
      },
    ],
  },
  advisor: {
    intent: "advisor",
    eyebrow: "Advisors y Qualified Persons",
    title: "Participa en evaluación, cumplimiento y estructuración técnica",
    description:
      "Colabora con compañías e inversionistas en reportes, evidencia, revisión técnica, due diligence y certificación.",
    primaryLabel: "Crear perfil profesional",
    primaryHref: "/auth?intent=team&mode=signup",
    authSearch: { intent: "team", mode: "signup" },
    steps: [
      {
        id: "profile",
        label: "Crear perfil",
        description: "Registra experiencia, especialidad y jurisdicciones de trabajo.",
        href: "/auth?intent=team&mode=signup",
      },
      {
        id: "review",
        label: "Revisar",
        description: "Participa en revisión técnica, QA/QC y matrices de cumplimiento.",
        href: "/recursos",
      },
      {
        id: "certify",
        label: "Certificar",
        description: "Gestiona evidencia, aprobaciones y entregables trazables.",
        href: "/recursos",
      },
      {
        id: "collaborate",
        label: "Colaborar",
        description: "Trabaja con proyectos y equipos desde un workspace con permisos.",
        href: "/auth?intent=team&mode=signup",
      },
    ],
  },
};

export const PUBLIC_PRIMARY_NAV = [
  { label: "Explorar", href: "/oportunidades" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Terminal", href: "/terminal" },
  { label: "Catastro", href: "/catastro/global" },
  { label: "Recursos", href: "/recursos" },
] as const;

export function getPublicJourney(intent: PublicJourneyIntent): PublicJourneyDefinition {
  return PUBLIC_JOURNEYS[intent];
}
