/**
 * PROYECTO CHOLQUI (ex "Gianfranco / Distrito Franco") — FUENTE ÚNICA DE VERDAD.
 *
 * Todo lo que se muestra en el live view (/live/franco), en la ficha de
 * inversión (/proyectos/ficha/franco) y en el PDF descargable sale de este
 * archivo. Editar aquí actualiza las tres superficies a la vez.
 *
 * Fuentes (sin datos sintéticos):
 *  - Prospecto "Cholqui" — Juan Arcos Vidal Ph.D. / Andrés Leman Vargas (2025).
 *  - Analisis_economico_Proyecto_Cholqui 1,5 % / 2 % / 2,5 % / 3 % (hojas
 *    "Eva. Eco.", "Costos", "Plan Mina", "total inversión inicial").
 *  - Plano de pertenencias + acreditación de dominio (carpeta del titular).
 *
 * NO existe estimación de recursos ni reservas bajo estándar reconocido, y las
 * planillas NO contienen VAN ni TIR. Los escenarios de ley son hipótesis de
 * sensibilidad, no leyes promedio comprobadas.
 */

export type Procedencia = "Certificado" | "Declarado" | "A verificar";

export type CholquiPoint = {
  code: string;
  name: string;
  utmE: number;
  utmN: number;
  lat: number;
  lng: number;
};

export type CholquiScenario = {
  /** Ley de cobre hipotética del escenario, en % Cu. */
  grade: number;
  label: string;
  /** Ingresos brutos acumulados del ciclo, US$. */
  revenueUsd: number;
  /** Costos totales acumulados del ciclo, US$. */
  costUsd: number;
  /** Margen (utilidad acumulada NO descontada), US$. */
  marginUsd: number;
  /** Mes de equilibrio acumulado dentro del ciclo de 25 meses. */
  paybackMonth: number;
};

export const CHOLQUI = {
  code: "CHOLQUI",
  ref: "CHQ-001",
  name: "Proyecto Cholqui",
  formerName: "Distrito Franco / Gianfranco",
  commodity: "Cu-Au-Ag",
  stage: "Exploración avanzada",
  operator: "Volcania Minerals SpA",
  location: "Cholqui, Cajón de Panamá, Melipilla, Región Metropolitana, Chile",
  region: "Melipilla · Región Metropolitana",
  country: "Chile",
  center: { lat: -33.8543, lng: -71.043 },
  crs: "UTM PSAD'56 Zona 19H (EPSG 24879) — reproyectado a WGS84",
  areaHa: 5000,
  pedimentos: 20,
  pertenencias: 15,
  access: "~30 min de la Ruta 78; sin comunidades cercanas según antecedentes del titular",
  liveUrl: "/live/franco",
  contact: {
    name: "Ernesto Egert Errázuriz",
    email: "egerternesto@gmail.com",
    phone: "+56 9 6609 1332",
  },
} as const;

/** Faena vecina en producción — evidencia de continuidad, NO producción propia. */
export const LAS_MINITAS = {
  name: "Mina Las Minitas",
  holder: "Sociedad Servicios RG Minerals SpA · RUT 77.066.786-0",
  throughputTMonth: 15000,
  areaHa: 40,
  lat: -33.83408,
  lng: -71.02465,
  note: "Operación de un tercero sobre la misma estructura geológica; el proyecto la rodea.",
} as const;

/** Puntos de observación y muestreo del prospecto (PSAD'56 19H → WGS84). */
export const CHOLQUI_POINTS: CholquiPoint[] = [
  { code: "P-1", name: "Manto La Maza", utmE: 311173, utmN: 6252495, lat: -33.85429, lng: -71.04307 },
  { code: "P-2", name: "Veta La Maza S", utmE: 311197, utmN: 6252485, lat: -33.85439, lng: -71.04281 },
  { code: "P-3", name: "Veta La Maza Portezuelo", utmE: 311195, utmN: 6252520, lat: -33.85407, lng: -71.04283 },
  { code: "P-4", name: "Loma El Litre", utmE: 310637, utmN: 6252013, lat: -33.85854, lng: -71.04896 },
  { code: "P-5", name: "Cascada El Infiernillo", utmE: 311195, utmN: 6252325, lat: -33.85583, lng: -71.04287 },
  { code: "P-6", name: "Cuesta Ancha", utmE: 310935, utmN: 6253214, lat: -33.84777, lng: -71.04549 },
  { code: "P-7", name: "Vetilla contacto calizas", utmE: 310790, utmN: 6254005, lat: -33.84061, lng: -71.04688 },
  { code: "P-8", name: "Los Huevos", utmE: 313282, utmN: 6254140, lat: -33.83984, lng: -71.01994 },
  { code: "P-9", name: "Qda. La Maza", utmE: 311418, utmN: 6252561, lat: -33.85374, lng: -71.04041 },
  { code: "P-10", name: "Veta La Maza", utmE: 311314, utmN: 6252642, lat: -33.85299, lng: -71.04152 },
  { code: "P-13", name: "Cuesta Ancha veta", utmE: 310935, utmN: 6253214, lat: -33.84777, lng: -71.04549 },
  { code: "P-15", name: "Las Hoyadas", utmE: 311359, utmN: 6248708, lat: -33.88846, lng: -71.04187 },
  { code: "P-16", name: "Las Hoyadas", utmE: 311345, utmN: 6248714, lat: -33.8884, lng: -71.04202 },
  { code: "P-17", name: "Placeta del Padre", utmE: 311656, utmN: 6249726, lat: -33.87934, lng: -71.03845 },
  { code: "P-18", name: "Placeta del Padre", utmE: 311593, utmN: 6249748, lat: -33.87913, lng: -71.03912 },
  { code: "P-19", name: "Placeta del Padre", utmE: 311567, utmN: 6249745, lat: -33.87915, lng: -71.0394 },
  { code: "P-20", name: "Los Tres Morros", utmE: 308879, utmN: 6250179, lat: -33.87475, lng: -71.06836 },
];

/** Evidencia geológica declarada en el prospecto. */
export const CHOLQUI_GEOLOGY = {
  litologia: "Fm. Veta Negra (Kvn), Fm. Lo Prado (Klp), Fm. Horqueta (Jh)",
  estilo: "Vetas y mantos Cu · Au-Cu · Cu-Ag con control estructural",
  mineralogia:
    "Calcopirita, bornita, calcosina, covelina, malaquita, crisocola y óxidos de cobre en fracturas",
  autores: "Juan Arcos Vidal Ph.D. · Andrés Leman Vargas",
  observaciones: 29,
  cuerpos: 5,
  muestrasLab: 4,
} as const;

/** Escenarios económicos preliminares — ILUSTRATIVOS (ciclo 25 meses). */
export const CHOLQUI_SCENARIOS: CholquiScenario[] = [
  { grade: 1.5, label: "1,5 % Cu", revenueUsd: 15_910_000, costUsd: 10_220_000, marginUsd: 5_630_000, paybackMonth: 9 },
  { grade: 2.0, label: "2,0 % Cu", revenueUsd: 23_230_000, costUsd: 10_950_000, marginUsd: 12_220_000, paybackMonth: 5 },
  { grade: 2.5, label: "2,5 % Cu", revenueUsd: 30_550_000, costUsd: 11_680_000, marginUsd: 18_810_000, paybackMonth: 4 },
  { grade: 3.0, label: "3,0 % Cu", revenueUsd: 37_870_000, costUsd: 12_420_000, marginUsd: 25_400_000, paybackMonth: 2 },
];

export const CHOLQUI_ASSUMPTIONS: Array<[string, string]> = [
  ["Mineral procesado", "166.500 t en 25 períodos mensuales"],
  ["Rampa de producción", "1.500 → 15.000 t/mes"],
  ["Razón estéril / mineral (REM)", "1,5"],
  ["Tarifa de venta", "Tarifa ENAMI nov-2025 · tipo de cambio 940 CLP/US$"],
  ["Costo mina en régimen", "~US$ 187 por tonelada movida"],
  ["Inversión inicial", "CLP 243.984.290 (~US$ 260 mil), incluye camino de 8,5 km"],
  ["VAN / TIR", "No calculados en la fuente — pendiente de modelo financiero"],
];

/** Ficha de datos con procedencia explícita (nunca presentar como certificado). */
export const CHOLQUI_FACTS: Array<{
  section: string;
  label: string;
  value: string;
  provenance: Procedencia;
  source: string;
}> = [
  { section: "Activo", label: "Superficie", value: "~5.000 ha (20 pedimentos + 15 pertenencias)", provenance: "Declarado", source: "Titular" },
  { section: "Activo", label: "Ubicación", value: "Cholqui, Melipilla, R.M.", provenance: "Declarado", source: "IGM Cholqui E-73 1:50.000" },
  { section: "Legal", label: "Titular", value: "Volcania Minerals SpA", provenance: "A verificar", source: "Acreditación de dominio" },
  { section: "Geología", label: "Litología", value: CHOLQUI_GEOLOGY.litologia, provenance: "Declarado", source: "Informe geológico Leman / Arcos" },
  { section: "Geología", label: "Estilo de mineralización", value: CHOLQUI_GEOLOGY.estilo, provenance: "Declarado", source: "Prospecto Cholqui (2025)" },
  { section: "Cobre", label: "Muestreo de superficie", value: "4 puntos analizados en laboratorio certificado", provenance: "A verificar", source: "Informes de laboratorio" },
  { section: "Cobre", label: "Faena vecina en producción", value: "Las Minitas ~15.000 t/mes (tercero)", provenance: "Certificado", source: "RG Minerals SpA" },
  { section: "Económico", label: "Escenarios de flujo", value: "1,5 % / 2,0 % / 2,5 % / 3,0 % Cu", provenance: "Declarado", source: "Planillas Eva. Eco." },
  { section: "Económico", label: "Vecino estratégico", value: "Colinda con pertenencias de Yamana Gold", provenance: "Declarado", source: "Plano de pertenencias" },
];

export const CHOLQUI_CAVEATS: string[] = [
  "No existe estimación de recursos ni reservas bajo un estándar reconocido (NI 43-101 / JORC). Nada en esta ficha debe leerse como recurso o reserva.",
  "Las leyes provienen de muestreo de superficie (4 puntos a laboratorio certificado), no de sondaje: no permiten inferir tonelaje, continuidad ni ley promedio.",
  "La producción de Mina Las Minitas es de un tercero (RG Minerals SpA); se cita como evidencia de continuidad de la estructura, no como producción propia.",
  "El dominio de las pertenencias está pendiente de validación contra la acreditación de dominio.",
  "Los escenarios de 1,5 % a 3,0 % Cu son hipótesis de sensibilidad, ilustrativas, sin VAN ni TIR en la fuente; el margen mostrado es utilidad acumulada no descontada.",
];

/** Términos referenciales de la ronda — base de conversación, no oferta pública. */
export const CHOLQUI_ROUND = {
  valuationLowUsd: 4_000_000,
  valuationHighUsd: 6_000_000,
  valuationMethod: "Comparables + flujo a leyes 1,5–2,5 % Cu",
  roundSizeUsd: 1_000_000,
  minTicketUsd: 25_000,
  instrument: "Equity SpA",
  equityOfferedPct: 15,
  horizonYears: 4,
  useOfFunds: [
    { label: "Muestreo y sondaje de confirmación", pct: 40 },
    { label: "Ingeniería y plan minero", pct: 25 },
    { label: "Patentes y catastro", pct: 15 },
    { label: "Estudios, permisos y QP", pct: 15 },
    { label: "Administración", pct: 5 },
  ],
  milestones: [
    { when: "T3 2026", what: "Gamma-espectrometría 1:10.000, mapeo y zanjas (Cuesta Ancha)" },
    { when: "T4 2026", what: "Campaña de sondaje de confirmación de leyes" },
    { when: "T1 2027", what: "Modelo geológico 3D y estimación de recursos" },
    { when: "T2 2027", what: "Estudios metalúrgicos y plan minero" },
  ],
} as const;

export const CHOLQUI_HIGHLIGHTS: string[] = [
  "Cu-Au-Ag en zona central de Chile, a ~30 min de la Ruta 78 y sin comunidades cercanas",
  "~5.000 ha (20 pedimentos + 15 pertenencias) rodeando a Mina Las Minitas, en producción",
  "29 observaciones de terreno y 5 cuerpos mineralizados descritos por geólogos independientes",
  "Colinda con pertenencias de Yamana Gold en el mismo corredor estructural",
];

export function fmtUsdM(n: number): string {
  return `US$ ${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 2 })} M`;
}

export function fmtUsd(n: number): string {
  return `US$ ${n.toLocaleString("es-CL", { maximumFractionDigits: 0 })}`;
}
