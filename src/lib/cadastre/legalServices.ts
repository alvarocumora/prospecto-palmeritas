import type { LegalServiceType } from "./legalRequest";

export interface LegalServiceDefinition {
  id: LegalServiceType;
  title: string;
  shortTitle: string;
  subtitle: string;
  description: string;
  items: string[];
  required: string[];
}

export const LEGAL_SERVICES: LegalServiceDefinition[] = [
  {
    id: "pedimento",
    title: "Pedimento minero (Exploración)",
    shortTitle: "Pedimento",
    subtitle: "Hasta 5.000 ha por solicitud · Código de Minería",
    description:
      "Convertimos un sector de interés en una solicitud de exploración con geometría revisable, antecedentes catastrales y seguimiento de la tramitación judicial.",
    items: [
      "Diseño geométrico y chequeo de solapes SERNAGEOMIN",
      "Revisión jurídica de disponibilidad en OJV y Boletín Oficial",
      "Redacción de escrito y patrocinio de abogado minero",
      "Ingreso ante el Juzgado de Letras competente y seguimiento de plazos",
    ],
    required: [
      "Identificación del peticionario y de la sociedad, si corresponde",
      "Comuna, sector y superficie preliminar de cada solicitud",
      "Coordenadas o diseño catastral, si ya existen",
      "Antecedentes de concesiones colindantes o causas relacionadas",
    ],
  },
  {
    id: "manifestacion",
    title: "Manifestación (Explotación)",
    shortTitle: "Manifestación",
    subtitle: "Pertenencias de 1 a 10 ha · Faenas identificadas",
    description:
      "Evaluamos el punto de interés y las labores declaradas para preparar la manifestación, sin presentar indicios visuales o históricos como recursos o reservas.",
    items: [
      "Determinación preliminar del punto de interés y pertenencias",
      "Revisión de antecedentes técnicos, históricos y de labores aportados",
      "Redacción, ingreso judicial y seguimiento de la solicitud de mensura",
      "Coordinación con perito mensurador y Conservador de Minas cuando corresponda",
    ],
    required: [
      "Identificación del manifestante y poderes, si actúa un representante",
      "Ubicación y descripción de la faena o punto de interés",
      "Antecedentes de labores, producción o entregas ENAMI disponibles",
      "Coordenadas y datum conocidos, con su fuente",
    ],
  },
  {
    id: "due-diligence",
    title: "Due Diligence y Blindaje",
    shortTitle: "Due Diligence",
    subtitle: "Vigencia, patentes, riesgos y contratos mineros",
    description:
      "Ordenamos la evidencia jurídica y territorial de un activo para identificar brechas, riesgos y acciones de regularización antes de negociar o presentar.",
    items: [
      "Revisión de vigencia, roles, patentes TGR y antecedentes disponibles",
      "Análisis de terceros, colindancias y publicaciones relevantes",
      "Informe de hallazgos con distinción entre hechos, antecedentes y pendientes",
      "Evaluación de opciones, arriendos, royalties y Joint Venture según el caso",
    ],
    required: [
      "Roles, nombres de concesiones y titulares conocidos",
      "Certificados, escrituras, contratos o resoluciones disponibles",
      "Comprobantes de patentes y antecedentes TGR aportados por el cliente",
      "Objetivo de la revisión: adquisición, defensa, financiamiento o regularización",
    ],
  },
];

export function getLegalService(id: LegalServiceType): LegalServiceDefinition {
  return LEGAL_SERVICES.find((service) => service.id === id) ?? LEGAL_SERVICES[0]!;
}
