/**
 * PROYECTO CHOLQUI (ex "Gianfranco / Distrito Franco") — FUENTE ÚNICA DE VERDAD.
 *
 * Todo lo que se muestra en el live view (/live/cholqui), en la ficha de
 * inversión (/proyectos/ficha/cholqui) y en el PDF descargable sale de aquí.
 *
 * Fuentes documentales reales (sin datos sintéticos):
 *  - Prospecto "Cholqui" (Juan Arcos Vidal Ph.D. / Andrés Leman Vargas):
 *    puntos de observación y muestreo, litología, mineralogía bajo microscopio,
 *    potencial conceptual y recomendaciones de exploración.
 *  - Informe de Ensayo AG2463714, Andes Analytical Assay (muestras P1–P3).
 *  - Análisis económico Proyecto Cholqui (planillas por ley).
 *  - Circular ENAMI N°27 — tarifas julio 2026 (óxidos, lixiviación).
 *  - Contrato de suministro de rocas y Anexo N°1 (flujo de áridos).
 *  - Certificados RFG: dominio, avalúos, gravámenes y embargo TGR.
 *  - Resumen ejecutivo de financiamiento ENAMI, 22-07-2026.
 *
 * NO existe estimación de recursos ni reservas bajo estándar reconocido
 * (CH 20235 / NI 43-101 / JORC / S-K 1300) y las fuentes NO contienen VAN ni
 * TIR. Los escenarios de ley son sensibilidad tarifaria, no leyes promedio.
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
  /** Ley de Cu soluble hipotética del escenario, en %. */
  grade: number;
  label: string;
  /** Tarifa ENAMI aplicable, CLP por tonelada métrica seca. */
  tariffClpTms: number;
  /** Ingresos brutos del plan de 166.500 t, CLP. */
  revenueClp: number;
  /** Costos operacionales del modelo entregado, CLP. */
  costClp: number;
  /** Superávit operacional antes de inversión inicial, CLP. */
  marginClp: number;
  /** Mes de equilibrio acumulado — sólo documentado para el caso base. */
  paybackMonth: number | null;
};

export type CholquiAssay = {
  sample: string;
  laboratoryCode?: string;
  location: string;
  cuTotalPct: number;
  cuSolublePct: number;
  auGpt: number;
  agPpm: number;
  reportId: string;
  lab: string;
  reportDate: string;
};

export type CholquiAssayReport = {
  id: string;
  lab: string;
  applicant: string;
  receivedDate: string;
  reportDate: string;
  samples: number;
  sampleCodes: readonly string[];
  source: string;
  note: string;
};

export const CHOLQUI = {
  code: "CHOLQUI",
  ref: "CHQ-001",
  name: "Proyecto Cholqui",
  formerName: "Distrito Franco / Gianfranco",
  commodity: "Cu-Au-Ag",
  stage: "Exploración · muestreo de superficie certificado",
  operator: "Volcania Minerals SpA",
  location: "Cholqui, Cajón de Panamá, Melipilla, Región Metropolitana, Chile",
  region: "Melipilla · Región Metropolitana",
  country: "Chile",
  center: { lat: -33.8543, lng: -71.043 },
  crs: "UTM PSAD'56 Zona 19H (EPSG 24879) — reproyectado a WGS84",
  cartography:
    "IGM Cholqui E-73 (3345-7100) PSAD'56 1:50.000 · IGM SAD'69 Estero de Cholqui 1:25.000",
  areaHa: 5000,
  pedimentos: 20,
  pertenencias: 15,
  access: "~30 min de la Ruta 78; sin comunidades cercanas según antecedentes del titular",
  liveUrl: "/terminal/cholqui",
  contact: {
    name: "GeoCapitals",
    email: "contacto@geocapitals.com",
    phone: "+56 9 6218 4071",
  },
} as const;

/** Faena vecina en producción — evidencia de continuidad, NO producción propia. */
export const LAS_MINITAS = {
  name: "Mina Las Minitas",
  holder: "Sociedad Servicios RG Minerals SpA · RUT 77.066.786-0",
  throughputTMonth: 15000,
  areaHa: 40,
  // PSAD'56 19H N 6.254.650 / E 311.970 — confirmado por dos fuentes independientes
  // (presentación del proyecto y Tabla 3 "Principales minas y ocurrencias", rol 552).
  // El valor anterior (-33.83408, -71.02465) estaba ~800 m al este del punto real.
  lat: -33.83501,
  lng: -71.034,
  note: "Operación de un tercero sobre la misma estructura geológica; el proyecto la rodea.",
} as const;

/** Puntos de observación y muestreo del prospecto (PSAD'56 19H → WGS84). */
export const CHOLQUI_POINTS: CholquiPoint[] = [
  {
    code: "P-1",
    name: "Manto La Maza — N20ºE/30ºSE, pot. 1,1–1,3 m",
    utmE: 311173,
    utmN: 6252495,
    lat: -33.85429,
    lng: -71.04307,
  },
  {
    code: "P-2",
    name: "Veta principal La Maza — N10ºW/90º, pot. 1,0–1,5 m",
    utmE: 311197,
    utmN: 6252485,
    lat: -33.85439,
    lng: -71.04281,
  },
  {
    code: "P-3",
    name: "Veta La Maza, portezuelo — N10ºW/65ºW",
    utmE: 311195,
    utmN: 6252520,
    lat: -33.85407,
    lng: -71.04283,
  },
  {
    code: "P-4",
    name: "Loma El Litre — acarreo de veta",
    utmE: 310637,
    utmN: 6252013,
    lat: -33.85854,
    lng: -71.04896,
  },
  {
    code: "P-5",
    name: "Cascada El Infiernillo — veta N15ºE/90º, pot. 0,60 m",
    utmE: 311195,
    utmN: 6252325,
    lat: -33.85583,
    lng: -71.04287,
  },
  {
    code: "P-6",
    name: "Cuesta Ancha — desmonte de carbonatos",
    utmE: 310935,
    utmN: 6253214,
    lat: -33.84777,
    lng: -71.04549,
  },
  {
    code: "P-7",
    name: "Contacto calizas / ocoítas — vetilla N15ºE/35-38ºE",
    utmE: 310790,
    utmN: 6254005,
    lat: -33.84061,
    lng: -71.04688,
  },
  {
    code: "P-8",
    name: "Los Huevos — acarreo de veta cuarzosa",
    utmE: 313282,
    utmN: 6254140,
    lat: -33.83984,
    lng: -71.01994,
  },
  {
    code: "P-9",
    name: "Quebrada La Maza — veta cuarzosa",
    utmE: 311418,
    utmN: 6252561,
    lat: -33.85374,
    lng: -71.04041,
  },
  {
    code: "P-10",
    name: "Veta La Maza en quebrada La Maza",
    utmE: 311314,
    utmN: 6252642,
    lat: -33.85299,
    lng: -71.04152,
  },
  {
    code: "P-13",
    name: "Cuesta Ancha — veta N08ºW/90º, pot. 1 m",
    utmE: 310935,
    utmN: 6253214,
    lat: -33.84777,
    lng: -71.04549,
  },
  {
    code: "P-15",
    name: "Las Hoyadas — picado en granodiorita sericitizada",
    utmE: 311359,
    utmN: 6248708,
    lat: -33.88846,
    lng: -71.04187,
  },
  {
    code: "P-16",
    name: "Las Hoyadas — acarreo de veta cuarzosa sericitizada",
    utmE: 311345,
    utmN: 6248714,
    lat: -33.8884,
    lng: -71.04202,
  },
  {
    code: "P-17",
    name: "Placeta del Padre — zona de alteración argílica",
    utmE: 311656,
    utmN: 6249726,
    lat: -33.87934,
    lng: -71.03845,
  },
  {
    code: "P-18",
    name: "Placeta del Padre — vetilla N55ºE, pot. 0,6 m",
    utmE: 311593,
    utmN: 6249748,
    lat: -33.87913,
    lng: -71.03912,
  },
  {
    code: "P-19",
    name: "Placeta del Padre — vetilla N50ºE/90º, pot. 1,5–2,0 m",
    utmE: 311567,
    utmN: 6249745,
    lat: -33.87915,
    lng: -71.0394,
  },
  {
    code: "P-20",
    name: "Los Tres Morros — pique, veta N65ºW/90º, pot. 2 m (polimetálica)",
    utmE: 308879,
    utmN: 6250179,
    lat: -33.87475,
    lng: -71.06836,
  },
];

/**
 * Ensayos químicos certificados — Informe de Ensayo AG2463714,
 * Andes Analytical Assay. Muestras puntuales de superficie: NO permiten
 * estimar ley media de mina, dilución, continuidad ni recuperación.
 */
export const CHOLQUI_ASSAY_REPORT = {
  id: "AG2463714",
  lab: "Andes Analytical Assay",
  applicant: "Antecedentes históricos Proyecto Cholqui",
  receivedDate: "No informada en el antecedente disponible",
  reportDate: "No informada en el antecedente disponible",
  samples: 3,
  sampleCodes: ["P1", "P2", "P3"],
  source: "Informe de Ensayo AG2463714",
  note: "Muestras puntuales de superficie del sector La Maza.",
} as const satisfies CholquiAssayReport;

/** Informes FGF recibidos el 23-09-2026 como capturas del documento firmado. */
export const CHOLQUI_FGF_REPORTS = [
  {
    id: "74705",
    lab: "FGF Análisis Mineros",
    applicant: "Inversiones de Martino SpA",
    receivedDate: "07-01-2025",
    reportDate: "22-01-2025",
    samples: 3,
    sampleCodes: ["P-8", "P-9", "P-10"],
    source: "Informe de Análisis FGF N.º 74705",
    note: "Resultados firmados; las muestras fueron tomadas por el solicitante.",
  },
  {
    id: "75299",
    lab: "FGF Análisis Mineros",
    applicant: "Inversiones de Martino SpA",
    receivedDate: "04-02-2025",
    reportDate: "07-02-2025",
    samples: 1,
    sampleCodes: ["P-20"],
    source: "Informe de Análisis FGF N.º 75299",
    note: "Resultado firmado; la muestra fue tomada por el solicitante.",
  },
] as const satisfies readonly CholquiAssayReport[];

export const CHOLQUI_ASSAY_REPORTS: readonly CholquiAssayReport[] = [
  CHOLQUI_ASSAY_REPORT,
  ...CHOLQUI_FGF_REPORTS,
];

export const CHOLQUI_ASSAYS: CholquiAssay[] = [
  {
    sample: "P1",
    location: "Manto La Maza",
    cuTotalPct: 1.781,
    cuSolublePct: 1.682,
    auGpt: 0.04,
    agPpm: 38,
    reportId: "AG2463714",
    lab: "Andes Analytical Assay",
    reportDate: "No informada",
  },
  {
    sample: "P2",
    location: "Veta principal La Maza",
    cuTotalPct: 7.187,
    cuSolublePct: 6.054,
    auGpt: 0.08,
    agPpm: 15,
    reportId: "AG2463714",
    lab: "Andes Analytical Assay",
    reportDate: "No informada",
  },
  {
    sample: "P3",
    location: "Veta principal La Maza",
    cuTotalPct: 16.227,
    cuSolublePct: 14.351,
    auGpt: 0.25,
    agPpm: 54,
    reportId: "AG2463714",
    lab: "Andes Analytical Assay",
    reportDate: "No informada",
  },
  {
    sample: "P-8",
    laboratoryCode: "830601",
    location: "Los Huevos — acarreo de veta cuarzosa",
    cuTotalPct: 0.96,
    cuSolublePct: 0.86,
    auGpt: 0.07,
    agPpm: 3,
    reportId: "74705",
    lab: "FGF Análisis Mineros",
    reportDate: "22-01-2025",
  },
  {
    sample: "P-9",
    laboratoryCode: "830602",
    location: "Quebrada La Maza — veta cuarzosa",
    cuTotalPct: 2.62,
    cuSolublePct: 2.39,
    auGpt: 0.05,
    agPpm: 118,
    reportId: "74705",
    lab: "FGF Análisis Mineros",
    reportDate: "22-01-2025",
  },
  {
    sample: "P-10",
    laboratoryCode: "830603",
    location: "Veta La Maza en quebrada La Maza",
    cuTotalPct: 4.18,
    cuSolublePct: 3.87,
    auGpt: 0.03,
    agPpm: 85,
    reportId: "74705",
    lab: "FGF Análisis Mineros",
    reportDate: "22-01-2025",
  },
  {
    sample: "P-20",
    laboratoryCode: "833934",
    location: "Los Tres Morros — veta polimetálica",
    cuTotalPct: 4.97,
    cuSolublePct: 3.93,
    auGpt: 1,
    agPpm: 21,
    reportId: "75299",
    lab: "FGF Análisis Mineros",
    reportDate: "07-02-2025",
  },
];

/** Razón Cu soluble / Cu total por muestra (favorable a ruta de lixiviación). */
export function solubleRatioPct(a: CholquiAssay): number {
  return (a.cuSolublePct / a.cuTotalPct) * 100;
}

/** Potencial geológico conceptual del prospecto — NO es recurso ni reserva. */
export const CHOLQUI_CONCEPTUAL = {
  tonnes: 60_750,
  formula: "300 m (largo) × 50 m (alto) × 1,5 m (potencia) × 1,5 (p.e.) × 1,5 (factor)",
  sector: "La Maza",
  product: "Cobre oxidado apto para lixiviación",
  note: "Medición inferida del Prospecto Cholqui. No corresponde a recurso ni reserva bajo CH 20235, NI 43-101, JORC ni S-K 1300.",
} as const;

/** Evidencia geológica documentada en el prospecto. */
export const CHOLQUI_GEOLOGY = {
  litologia:
    "Fm. Veta Negra (Kvn, ocoítas), Fm. Lo Prado (Klp superior/medio/inferior), Fm. Horqueta (Jh), granodioritas-tonalitas y pórfidos dioríticos",
  estilo:
    "Vetas cuarzosas y mantos Cu · Au-Cu · Cu-Ag con control estructural, más zonas de alteración hidrotermal argílica y sericítica",
  mineralogia:
    "Calcopirita, tenorita, malaquita, atacamita, azurita, calcosina, bornita, covelina, baritina, argentita, galena, esfalerita y menas grises argentíferas; oro y plata libres observados bajo microscopio",
  autores: "Juan Arcos Vidal Ph.D. · Andrés Leman Vargas",
  observaciones: 29,
  cuerpos: 5,
  muestrasLab: 7,
  cuerposDetalle: [
    "Las Minitas — mineralización en cuerpos lutíticos y ocoíticos",
    "La Maza — vetas cuarzosas con calcopirita, plata, menas grises y baritina",
    "Las Guías — vetas ocoíticas con calcosina, bornita, plata y trazas de oro",
    "Placeta del Padre – Las Hoyadas — alteración argílica y sericítica en intrusivos",
    "Los Tres Morros — mineralización polimetálica (punto P-20)",
  ],
} as const;

/** Trabajos de exploración recomendados por el prospecto. */
export const CHOLQUI_EXPLORATION_PLAN: string[] = [
  "Gamma-espectrometría escala 1:10.000 sobre las franjas Lo Prado Superior – Veta Negra",
  "Mapeo geológico al Este de la veta La Maza",
  "Zanja en Cuesta Ancha para definir la presencia del cuerpo mineralizado",
  "Estudios en el portezuelo de Horcones de Piedra",
  "Búsqueda de continuidad del mineral en Los Tres Morros",
  "Análisis químicos de carbonatos y de vetas negras / lutitas carbonosas por tierras raras",
];

/** Referencia tarifaria ENAMI — Circular N°27, julio 2026. */
export const CHOLQUI_ENAMI = {
  circular: "Circular ENAMI N°27 — tarifas julio 2026",
  baseTariffClpTms: 171_886,
  baseGradePct: 2.5,
  scaleClpPerPct: 82_315,
  copperPriceUsdLb: 6.15721,
  fxClpUsd: 916.97,
  sxewTariff15ClpTms: 92_738,
  flotationTariff15ClpTms: 117_405,
  taxWithholdingPct: 4,
  note: "La tarifa no es el pago final: se ajusta por consumo de ácido, humedad, impurezas, muestreo, ensayes, diferencias de ley, transporte, recepción efectiva y retención tributaria de 4 %.",
} as const;

export const CHOLQUI_PLAN_TONNES = 166_500;
export const CHOLQUI_OPEX_CLP = 8_911_198_950;
export const CHOLQUI_INITIAL_CAPEX_CLP = 242_132_990;

/**
 * Sensibilidad tarifaria sobre el plan entregado (166.500 t en 24 meses).
 * Ingresos = tarifa ENAMI julio 2026 × 166.500 t. Los costos operacionales son
 * los del modelo entregado y se mantienen constantes entre escenarios.
 */
export const CHOLQUI_SCENARIOS: CholquiScenario[] = [
  {
    grade: 1.5,
    label: "1,5 % Cu sol.",
    tariffClpTms: 89_571,
    revenueClp: 14_913_571_500,
    costClp: CHOLQUI_OPEX_CLP,
    marginClp: 6_002_372_550,
    paybackMonth: 9,
  },
  {
    grade: 2.0,
    label: "2,0 % Cu sol.",
    tariffClpTms: 130_728,
    revenueClp: 21_766_212_000,
    costClp: CHOLQUI_OPEX_CLP,
    marginClp: 12_855_013_050,
    paybackMonth: null,
  },
  {
    grade: 2.5,
    label: "2,5 % Cu sol.",
    tariffClpTms: 171_886,
    revenueClp: 28_619_019_000,
    costClp: CHOLQUI_OPEX_CLP,
    marginClp: 19_707_820_050,
    paybackMonth: null,
  },
  {
    grade: 3.0,
    label: "3,0 % Cu sol.",
    tariffClpTms: 213_044,
    revenueClp: 35_471_826_000,
    costClp: CHOLQUI_OPEX_CLP,
    marginClp: 26_560_627_050,
    paybackMonth: null,
  },
];

/** Escenario base efectivamente modelado (1,5 % Cu soluble). */
export const CHOLQUI_BASE_CASE = {
  gradePct: 1.5,
  tonnes: CHOLQUI_PLAN_TONNES,
  months: 24,
  revenueClp: 14_913_571_500,
  opexClp: CHOLQUI_OPEX_CLP,
  operatingSurplusClp: 6_002_372_550,
  netAfterCapexClp: 5_760_239_560,
  paybackMonth: 9,
  breakevenTMonth: 2_341,
  ramp: "1.500 → 15.000 t/mes",
} as const;

export const CHOLQUI_ASSUMPTIONS: Array<[string, string]> = [
  ["Mineral procesado", "166.500 t en 24 meses (plan entregado)"],
  ["Rampa de producción", "1.500 → 15.000 t/mes"],
  ["Producto", "Óxidos de cobre para lixiviación; venta a ENAMI"],
  ["Tarifa base", "CLP 89.571/tms a 1,5 % Cu soluble (Circular ENAMI N°27, julio 2026)"],
  ["Escala tarifaria", "CLP 171.886/tms base 2,5 % Cu; CLP 82.315/tms por cada 1 % Cu"],
  ["Precio y tipo de cambio ENAMI", "US$ 6,15721/lb Cu · CLP 916,97/US$"],
  ["Costos operacionales", "CLP 8.911.198.950 en el ciclo (modelo entregado, sin depurar)"],
  ["Inversión inicial", "CLP 242.132.990 — mina, camino, asesorías y contingencia"],
  ["Punto de equilibrio", "~2.341 t/mes a tarifa actual"],
  ["VAN / TIR", "No existen en la fuente — pendiente de modelo financiero auditado"],
];

/** Brechas materiales detectadas en la revisión de julio 2026. */
export const CHOLQUI_GAPS: string[] = [
  "El plan de 166.500 t excede 2,74 veces el potencial conceptual de 60.750 t: no debe proyectarse deuda sobre toneladas no demostradas.",
  "Tarifa desactualizada en el archivo económico original (CLP 65.438/t de nov-2025 vs CLP 89.571/t de julio 2026).",
  "Arriendo de camiones registrado como 167 unidades × CLP 600.000/mes mientras el plan minero indica 2 a 5 camiones: unidad por aclarar.",
  "Sin ensayos metalúrgicos de consumo de ácido, recuperación, granulometría, cinética de lixiviación ni variabilidad.",
  "Faltan permisos, patentes, cierre, seguros, topografía, explosivos, administración, capital de trabajo y costo financiero.",
  "Ruta logística sin agencia o planta ENAMI receptora identificada, distancia, tarifa de transporte ni ley mínima de recepción.",
  "Discrepancia de titularidad: la presentación declara 20 pedimentos y 15 pertenencias; el contrato comercial enumera 10 pertenencias.",
];

/** Estructura de financiamiento propuesta (resumen ejecutivo 22-07-2026). */
export const CHOLQUI_FINANCING = {
  lineClp: 450_000_000,
  minimumNeedClp: 379_421_840,
  rampLossesClp: 137_288_850,
  tranche1Clp: 250_000_000,
  tranche2Clp: 200_000_000,
  tranche1Use:
    "Saneamiento legal, ingeniería de corto plazo, habilitación de acceso, campaña de muestreo/sondajes y lote piloto",
  tranche2Condition:
    "Sólo tras aceptación comercial ENAMI, conciliación de títulos, aprobación del plan minero e inventario demostrado para al menos 12 meses",
} as const;

/** Garantías documentadas (avalúo fiscal, no tasación comercial). */
export const CHOLQUI_GUARANTEES: Array<{
  asset: string;
  holder: string;
  appraisalClp: number | null;
  status: string;
}> = [
  {
    asset: "Lote 1, Rol 16-32, Isla de Maipo",
    holder: "Inversiones RFG SpA",
    appraisalClp: 124_141_101,
    status: "Sin hipoteca informada en certificado",
  },
  {
    asset: "Lote 2, Rol 16-33, Isla de Maipo",
    holder: "Inversiones RFG SpA",
    appraisalClp: 124_141_101,
    status: "Embargo vigente a favor de TGR — no elegible",
  },
  {
    asset: "Predio agrícola Rol 119-40, 10,76 ha",
    holder: "50 % Inversiones RFG SpA",
    appraisalClp: 188_882_984,
    status: "Valor atribuible; requiere revisar copropiedad",
  },
  {
    asset: "25 acciones de agua Canal Valdés",
    holder: "Inversiones RFG SpA",
    appraisalClp: null,
    status: "Dominio vigente, sin gravámenes; sin tasación aportada",
  },
];

export const CHOLQUI_GUARANTEE_TOTALS = {
  documentedClp: 437_165_186,
  freeOfLiensClp: 313_024_085,
} as const;

/** Contrato de áridos — flujo secundario, no take-or-pay. */
export const CHOLQUI_ARIDOS = {
  start: "22 de febrero de 2026",
  minVolumeM3Month: 20_000,
  priceClpM3: 6_500,
  nominalMonthlyClp: 130_000_000,
  nominal24mClp: 3_120_000_000,
  modality: "Derecho a puerta, precio + IVA",
  caveat:
    "El Anexo N°1 deja sin efecto la obligación de pago del volumen mínimo si el cliente no retira el material: no es take-or-pay ni flujo firme para cubrir deuda.",
} as const;

/** Ficha de datos con procedencia explícita. */
export const CHOLQUI_FACTS: Array<{
  section: string;
  label: string;
  value: string;
  provenance: Procedencia;
  source: string;
}> = [
  {
    section: "Activo",
    label: "Superficie",
    value: "~5.000 ha (20 pedimentos + 15 pertenencias)",
    provenance: "Declarado",
    source: "Presentación del titular",
  },
  {
    section: "Activo",
    label: "Ubicación",
    value: "Cholqui, Cajón de Panamá, Melipilla, R.M.",
    provenance: "Declarado",
    source: "Prospecto Cholqui · IGM E-73 1:50.000",
  },
  {
    section: "Legal",
    label: "Titular",
    value: "Volcania Minerals SpA",
    provenance: "A verificar",
    source: "Acreditación de dominio",
  },
  {
    section: "Legal",
    label: "Discrepancia de pertenencias",
    value: "Presentación: 15 pertenencias · Contrato comercial: 10",
    provenance: "A verificar",
    source: "Revisión legal 22-07-2026",
  },
  {
    section: "Geología",
    label: "Litología",
    value: "Fm. Veta Negra, Fm. Lo Prado, Fm. Horqueta e intrusivos granodioríticos",
    provenance: "Declarado",
    source: "Prospecto Cholqui (Arcos / Leman)",
  },
  {
    section: "Geología",
    label: "Potencial conceptual",
    value: "60.750 t de Cu oxidado inferidas en La Maza",
    provenance: "Declarado",
    source: "Prospecto Cholqui — no es recurso",
  },
  {
    section: "Cobre",
    label: "Cu total en 7 muestras",
    value: "0,960–16,227 % Cu total",
    provenance: "Certificado",
    source: "Informes AG2463714, FGF 74705 y FGF 75299",
  },
  {
    section: "Cobre",
    label: "Cu soluble en 7 muestras",
    value: "0,860–14,351 % Cu soluble (razón soluble 79–94 %)",
    provenance: "Certificado",
    source: "Informes AG2463714, FGF 74705 y FGF 75299",
  },
  {
    section: "Oro-Plata",
    label: "Au / Ag en muestras",
    value: "Au 0,03–1,00 g/t · Ag 3–118 g/t",
    provenance: "Certificado",
    source: "Informes AG2463714, FGF 74705 y FGF 75299",
  },
  {
    section: "Cobre",
    label: "Faena vecina en producción",
    value: "Las Minitas ~15.000 t/mes (tercero)",
    provenance: "Declarado",
    source: "Presentación del titular · RG Minerals SpA",
  },
  {
    section: "Económico",
    label: "Tarifa ENAMI 1,5 % Cu soluble",
    value: "CLP 89.571/tms",
    provenance: "Certificado",
    source: "Circular ENAMI N°27, julio 2026",
  },
  {
    section: "Económico",
    label: "Plan de producción",
    value: "166.500 t en 24 meses (1.500 → 15.000 t/mes)",
    provenance: "Declarado",
    source: "Análisis económico Proyecto Cholqui (ley 1,5 %)",
  },
  {
    section: "Legal",
    label: "Garantías documentadas",
    value: "CLP 437.165.186 de avalúo fiscal (CLP 313.024.085 libres de embargo)",
    provenance: "A verificar",
    source: "Certificados RFG, avalúos, gravámenes y TGR",
  },
  {
    section: "Comercial",
    label: "Contrato de áridos",
    value: "20.000 m³/mes a CLP 6.500/m³ + IVA — no take-or-pay",
    provenance: "Declarado",
    source: "Contrato de suministro de rocas y Anexo N°1",
  },
];

export const CHOLQUI_CAVEATS: string[] = [
  "No existe estimación de recursos ni reservas bajo un estándar reconocido (CH 20235 / NI 43-101 / JORC / S-K 1300). Las 60.750 t son potencial geológico conceptual del prospecto.",
  "Las leyes provienen de siete muestras puntuales de superficie en tres informes (AG2463714, FGF 74705 y FGF 75299): no permiten estimar ley media de mina, dilución, continuidad, recuperación metalúrgica ni variabilidad.",
  "El plan económico de 166.500 t supera 2,74 veces el tonelaje conceptual informado; el inventario debe ampliarse con topografía, mapeo, canales, zanjas y sondajes antes de comprometer capital.",
  "La producción de Mina Las Minitas es de un tercero (RG Minerals SpA); se cita como evidencia de continuidad de la estructura, no como producción propia.",
  "La titularidad presenta discrepancia entre la presentación (15 pertenencias) y el contrato comercial (10 pertenencias); requiere matriz única de dominio, vigencia y patentes.",
  "Las cifras económicas son ilustrativas a tarifa ENAMI julio 2026 y no incorporan ajustes metalúrgicos, impuestos, gastos financieros, permisos, cierre ni seguros. No hay VAN ni TIR en la fuente.",
  "Los avalúos fiscales de las garantías no equivalen a tasación comercial ni a valor de realización; el Lote 2 (Rol 16-33) mantiene embargo vigente a favor de TGR.",
];

/** Términos referenciales de la ronda — base de conversación, no oferta pública. */
export const CHOLQUI_ROUND = {
  valuationLowUsd: 4_000_000,
  valuationHighUsd: 6_000_000,
  valuationMethod: "Comparables + flujo a tarifa ENAMI 1,5–2,5 % Cu soluble",
  roundSizeUsd: 1_000_000,
  minTicketUsd: 25_000,
  instrument: "Equity SpA",
  equityOfferedPct: 15,
  horizonYears: 4,
  useOfFunds: [
    { label: "Sondajes y ampliación de inventario (La Maza)", pct: 40 },
    { label: "Ensayos metalúrgicos y plan minero", pct: 20 },
    { label: "Saneamiento legal, títulos y patentes", pct: 20 },
    { label: "Topografía, mapeo, canales y zanjas", pct: 15 },
    { label: "Administración", pct: 5 },
  ],
  milestones: [
    {
      when: "0–15 días",
      what: "Matriz de pertenencias, vigencias, patentes y contratos; saneamiento del embargo TGR",
    },
    {
      when: "0–30 días",
      what: "Topografía, mapeo geológico-estructural, canales y protocolo QA/QC",
    },
    {
      when: "15–45 días",
      what: "Sondajes prioritarios en La Maza y ensayos metalúrgicos (ácido, recuperación, cinética)",
    },
    {
      when: "30–60 días",
      what: "Empadronamiento ENAMI, carta de aceptación comercial y lote piloto",
    },
    {
      when: "45–90 días",
      what: "Plan minero, modelo financiero auditado, tasaciones y contratos de garantía",
    },
  ],
} as const;

export const CHOLQUI_HIGHLIGHTS: string[] = [
  "Cu-Au-Ag en zona central de Chile, a ~30 min de la Ruta 78 y sin comunidades cercanas",
  "Siete análisis puntuales de superficie: 0,96–16,23 % Cu total, 0,86–14,35 % Cu soluble, Au hasta 1,00 g/t y Ag hasta 118 g/t",
  "~5.000 ha (20 pedimentos + 15 pertenencias) rodeando a Mina Las Minitas, faena de un tercero en producción",
  "Ruta de monetización directa a ENAMI: CLP 89.571/tms a 1,5 % Cu soluble (Circular N°27, julio 2026)",
];

export function fmtUsdM(n: number): string {
  return `US$ ${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 2 })} M`;
}

export function fmtUsd(n: number): string {
  return `US$ ${n.toLocaleString("es-CL", { maximumFractionDigits: 0 })}`;
}

export function fmtClp(n: number): string {
  return `CLP ${n.toLocaleString("es-CL", { maximumFractionDigits: 0 })}`;
}

export function fmtClpM(n: number): string {
  return `CLP ${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 0 })} M`;
}
