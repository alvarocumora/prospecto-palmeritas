/**
 * Research document builders from existing platform evidence. No synthetic
 * figures: no IRR, ROI, cash flows, resources, reserves or audited output.
 */
import { CHOLQUI, CHOLQUI_ASSAYS, CHOLQUI_ROUND } from "@/features/franco/data/cholqui";
import { DECK_TERMS } from "@/features/marketing/deck/deck2026";
import { FICHAS } from "@/lib/investor/fichas";
import cholquiImagery from "@/data/geo/cholqui_satellite_imagery.json";
import cholquiWorld from "@/assets/cholqui-world-imagery.jpg.asset.json";
import losverdesPert from "@/assets/deck/losverdes-pertenencias.jpg.asset.json";
import { findDiscrepancies, DOSSIER_CHOLQUI_SAMPLES } from "./discrepancies";
import type { ResearchDoc, ResearchFamily, ResearchParam, ResearchSource, RiskRow } from "./model";
import { FAMILY_LABEL } from "./model";

export type ResearchProject = "cholqui" | "losverdes";

const pct = (n: number, d = 2) =>
  `${n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const num = (n: number, d = 2) =>
  n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });

export const RESEARCH_VERSION = "v0.1-preview";

const COMMON_DISCLAIMERS = [
  "Documento de investigación interno en revisión. No constituye oferta pública de valores ni recomendación de inversión (Ley N° 18.045; NCG 336).",
  "No existen recursos ni reservas declarados bajo NI 43-101, JORC ni CH 20235. Ninguna Persona Calificada/Competente ha revisado este documento.",
  "Las cifras operativas, valorizaciones y colocaciones son declaradas por la operadora o referenciales; no han sido auditadas. Invertir en minería implica riesgo de pérdida total y baja liquidez.",
];

const SEPARATE_INSTRUMENT =
  "El mutuo con colateral inmobiliario (UF + tasa) es un instrumento distinto de la acción, con sus propios términos y advertencias; no forma parte de este documento.";

function cholquiSources(): ResearchSource[] {
  const reports = new Map<string, ResearchSource>();
  for (const a of CHOLQUI_ASSAYS) {
    const id = `lab-${a.reportId}`;
    if (!reports.has(id))
      reports.set(id, {
        id,
        label: `${a.lab} · informe ${a.reportId}`,
        period: a.reportDate,
        provenance: "MEDIDO",
      });
  }
  return [
    {
      id: "dossier",
      label: "Dossier comercial de la operadora",
      period: "Octubre 2026",
      provenance: "DECLARADO",
    },
    {
      id: "platform",
      label: "Términos referenciales registrados en la plataforma GeoCapitals",
      period: "Octubre 2026",
      provenance: "DECLARADO",
    },
    ...reports.values(),
    {
      id: "esri",
      label: `${cholquiImagery.source} · ${cholquiImagery.attribution}`,
      period: `Descarga ${cholquiImagery.retrievedAt}; adquisición no informada`,
      provenance: "REFERENCIAL",
    },
    {
      id: "igm",
      label: `Cartografía citada por el titular: ${CHOLQUI.cartography}`,
      period: "No informado",
      provenance: "OFICIAL",
    },
  ];
}

function cholquiDoc(family: ResearchFamily, issued: string): ResearchDoc {
  const disc = findDiscrepancies("cholqui");
  const conflict = (id: string) => (disc.some((d) => d.id === id) ? id : undefined);
  const cu = CHOLQUI_ASSAYS.map((a) => a.cuTotalPct).sort((a, b) => a - b);
  const max = cu[cu.length - 1];
  const min = cu[0];
  const median =
    cu.length % 2 ? cu[(cu.length - 1) / 2] : (cu[cu.length / 2 - 1] + cu[cu.length / 2]) / 2;
  const au = Math.max(...CHOLQUI_ASSAYS.map((a) => a.auGpt));
  const ag = Math.max(...CHOLQUI_ASSAYS.map((a) => a.agPpm));
  const n = CHOLQUI_ASSAYS.length;
  const sampleConflict = conflict("cholqui-sample-count");

  const params: ResearchParam[] = [
    {
      label: "Ubicación",
      value: "Melipilla, Región Metropolitana",
      provenance: "DECLARADO",
      sourceId: "dossier",
    },
    {
      label: "Superficie",
      value: `~${CHOLQUI.areaHa.toLocaleString("es-CL")} ha`,
      provenance: "DECLARADO",
      sourceId: "dossier",
      note: `${CHOLQUI.pedimentos} pedimentos + ${CHOLQUI.pertenencias} pertenencias`,
    },
    {
      label: "Etapa",
      value: "Explotación declarada",
      provenance: "DECLARADO",
      sourceId: "dossier",
      note: "Capacidad 5.000–15.000 t/mes no auditada",
    },
    {
      label: "Cu total máximo",
      value: pct(max),
      provenance: "MEDIDO",
      sourceId: "lab-AG2463714",
      note: "Máximo de muestras puntuales; no es ley media ni recurso",
      conflictId: sampleConflict,
    },
    {
      label: "Valorización",
      value: `USD ${CHOLQUI_ROUND.valuationLowUsd / 1e6}–${CHOLQUI_ROUND.valuationHighUsd / 1e6} M`,
      provenance: "REFERENCIAL",
      sourceId: "dossier",
      note: "Referencia declarada; no es tasación ni auditoría",
    },
    {
      label: "Horizonte de negocio",
      value: `${CHOLQUI_ROUND.horizonYears} años`,
      provenance: "DECLARADO",
      sourceId: "dossier",
    },
  ];

  const roundConflict = conflict("cholqui-round-size");
  const terms: ResearchParam[] = [
    {
      label: "Instrumento",
      value: "Acciones preferentes · SpA",
      provenance: "DECLARADO",
      sourceId: "dossier",
    },
    {
      label: "Tamaño de la ronda",
      value: roundConflict ? "Dossier USD 1,5 M · plataforma USD 1,0 M" : "USD 1,5 M",
      provenance: "DECLARADO",
      sourceId: "dossier",
      conflictId: roundConflict,
    },
    {
      label: "Acciones / precio",
      value: `${DECK_TERMS.shares.toLocaleString("es-CL")} × USD ${DECK_TERMS.shareUsd}`,
      provenance: "DECLARADO",
      sourceId: "dossier",
      conflictId: roundConflict,
    },
    {
      label: "Ticket mínimo",
      value: `USD ${DECK_TERMS.minUsd.toLocaleString("es-CL")} · ${DECK_TERMS.minShares} acciones`,
      provenance: "DECLARADO",
      sourceId: "dossier",
      conflictId: conflict("cholqui-min-ticket"),
    },
    {
      label: "Colocación declarada",
      value: `${DECK_TERMS.cholquiPlacement} %`,
      provenance: "DECLARADO",
      sourceId: "dossier",
      note: "No es efectivo recaudado",
    },
  ];

  const risks: RiskRow[] = [
    {
      area: "Geológico",
      risk: `Solo ${n} muestras puntuales superficiales; sin continuidad, ley media ni recursos`,
      level: "Alto",
      status: "Muestreo sistemático y sondajes pendientes",
    },
    {
      area: "Operacional",
      risk: "Capacidad 5.000–15.000 t/mes declarada, sin auditoría de producción",
      level: "Alto",
      status: "Requiere registros de despacho y liquidaciones ENAMI",
    },
    {
      area: "Legal / títulos",
      risk: "Pedimentos y pertenencias en saneamiento según uso de fondos",
      level: "Medio",
      status: "Estudio de títulos pendiente",
    },
    {
      area: "Mercado",
      risk: "Precio del cobre y tarifa del poder comprador",
      level: "Medio",
      status: "Exposición sin cobertura informada",
    },
    {
      area: "Liquidez",
      risk: "Acciones no transables en bolsa; salidas no garantizadas",
      level: "Alto",
      status: "Inherente al instrumento",
    },
    {
      area: "Datos",
      risk: `${disc.filter((d) => d.blocking).length} discrepancias entre dossier y plataforma`,
      level: disc.some((d) => d.blocking) ? "Alto" : "Bajo",
      status: disc.some((d) => d.blocking) ? "Bloquea exportación pública" : "Sin conflictos",
    },
  ];

  return {
    family,
    code: `GC-RS-CHQ-${family.toUpperCase().slice(0, 4)}-2026-10`,
    title: FAMILY_LABEL[family],
    category:
      family === "technical"
        ? "Evidencia técnica · Pre-due diligence"
        : "Research · Minería de cobre · Equity SPV",
    projectName: "Cholqui",
    subtitle: `${CHOLQUI.commodity.replace(/-/g, "–")} · Melipilla, Región Metropolitana`,
    issued,
    version: RESEARCH_VERSION,
    classification: "BORRADOR INTERNO · NO DISTRIBUIR",
    draft: true,
    thesis:
      "Cholqui es un activo de cobre oxidado con faena declarada en explotación a una hora de Santiago. El caso de inversión descansa en la logística y en leyes puntuales altas en superficie; aún no existe evidencia de continuidad ni de ley media, por lo que el capital financia principalmente validación.",
    findings: [
      `${n} análisis puntuales registrados, de ${num(min)} a ${num(max)} % Cu total (mediana ${num(median)} %).`,
      `Oro hasta ${num(au)} g/t y plata hasta ${ag} g/t en las mismas muestras.`,
      `Superficie declarada de ~${CHOLQUI.areaHa.toLocaleString("es-CL")} ha con ${CHOLQUI.pedimentos} pedimentos y ${CHOLQUI.pertenencias} pertenencias.`,
    ],
    strengths: [
      "Acceso por Ruta 78 y cercanía a puertos y poder comprador.",
      "Ensayes de laboratorios externos con informe identificable.",
    ],
    uncertainties: [
      "Sin recursos ni reservas; el máximo de 16 % no representa ley explotable.",
      "Producción y colocación son declaradas, no verificadas.",
      "Tamaño de la ronda y número de muestras difieren entre fuentes.",
    ],
    nextSteps: [
      "Confirmar términos de la ronda con la emisora.",
      "Muestreo sistemático de canales y sondajes en La Maza.",
      "Estudio de títulos y registro de despachos.",
    ],
    params,
    terms,
    termsIssuer: "Valle Escondido SpA",
    assays: {
      head: ["Muestra", "Ubicación", "Cu T %", "Cu S %", "Au g/t", "Ag g/t", "Informe"],
      rows: CHOLQUI_ASSAYS.map((a) => [
        a.sample,
        a.location,
        num(a.cuTotalPct),
        num(a.cuSolublePct),
        num(a.auGpt),
        String(a.agPpm),
        a.reportId,
      ]),
      numericCols: [2, 3, 4, 5],
      sourceIds: [...new Set(CHOLQUI_ASSAYS.map((a) => `lab-${a.reportId}`))],
      note: `Muestras puntuales superficiales seleccionadas por el titular. El dossier cita ${DOSSIER_CHOLQUI_SAMPLES}; la plataforma registra ${n}. No son leyes medias ni representan el depósito.`,
    },
    assayStats: [
      {
        label: "N° muestras (plataforma)",
        value: String(n),
        provenance: "MEDIDO",
        sourceId: "lab-AG2463714",
        conflictId: sampleConflict,
      },
      {
        label: "Cu total mín. / mediana / máx.",
        value: `${num(min)} / ${num(median)} / ${num(max)} %`,
        provenance: "MEDIDO",
        sourceId: "lab-AG2463714",
        note: "Estadística descriptiva, no estimación",
      },
      {
        label: "Au máx. · Ag máx.",
        value: `${num(au)} g/t · ${ag} g/t`,
        provenance: "MEDIDO",
        sourceId: "lab-AG2463714",
      },
    ],
    map: {
      imageUrl: cholquiWorld.url,
      aspect: 1,
      caption:
        "Mosaico satelital del entorno del proyecto. Contexto visual: no aporta cotas ni evidencia de mineralización.",
      sourceId: "esri",
      crs: cholquiImagery.crs,
      extent: cholquiImagery.bbox.map((v) => v.toFixed(4)).join(", "),
      retrieved: cholquiImagery.retrievedAt,
      acquisition: cholquiImagery.acquisitionDate ?? "No informada",
      attribution: cholquiImagery.attribution,
    },
    risks,
    dueDiligence: [
      { item: "Revisión por Persona Calificada (QP/CP)", status: "No designada" },
      { item: "Estudio de títulos de pedimentos y pertenencias", status: "Pendiente" },
      { item: "Auditoría de producción y despachos", status: "Pendiente" },
      { item: "Estados financieros de la emisora", status: "No recibidos" },
      {
        item: "Confirmación de tamaño de ronda y n° de muestras",
        status: roundConflict || sampleConflict ? "Bloqueante" : "Confirmado",
      },
    ],
    sources: cholquiSources(),
    discrepancies: disc,
    disclaimers: COMMON_DISCLAIMERS,
    separateInstrumentNote: SEPARATE_INSTRUMENT,
  };
}

function losVerdesDoc(family: ResearchFamily, issued: string): ResearchDoc {
  const lv = FICHAS.losverdes;
  const disc = findDiscrepancies("losverdes");
  const has = (id: string) => (disc.some((d) => d.id === id) ? id : undefined);
  return {
    family,
    code: `GC-RS-LVT-${family.toUpperCase().slice(0, 4)}-2026-10`,
    title: FAMILY_LABEL[family],
    category: "Research · Minería de cobre · Equity SPV",
    projectName: "Los Verdes – Tilama",
    subtitle: "Cu–Mo según ficha · Los Vilos, Choapa, Coquimbo",
    issued,
    version: RESEARCH_VERSION,
    classification: "BORRADOR INTERNO · NO DISTRIBUIR",
    draft: true,
    thesis:
      "Distrito multi-titular integrado bajo un contrato marco, con base de venta pactada y renta a titulares ligada a producción. La integración contractual y la producción siguen declaradas y pendientes de verificación.",
    findings: [
      "22 pertenencias integradas según catastro del proyecto.",
      "Base de venta pactada USD 8 M (monto contractual, no tasación).",
    ],
    strengths: [
      "Salida contractual definida para el distrito.",
      "Renta del 10 % alinea a titulares con producción.",
    ],
    uncertainties: [
      "Asociación de polígonos pendiente de verificación contractual.",
      "Mínimo y tamaño de la ronda difieren entre fuentes.",
    ],
    nextSteps: ["Confirmar ticket mínimo con la emisora.", "Verificar contratos con titulares."],
    params: [
      { label: "Ubicación", value: lv.region, provenance: "DECLARADO", sourceId: "dossier" },
      {
        label: "Superficie integrada",
        value: "3.303 ha",
        provenance: "DECLARADO",
        sourceId: "catastro",
      },
      {
        label: "Valorización",
        value: `USD ${lv.valuationUsd.low / 1e6}–${lv.valuationUsd.high / 1e6} M`,
        provenance: "REFERENCIAL",
        sourceId: "dossier",
        note: "Referencia declarada; no es tasación",
      },
      {
        label: "Venta pactada",
        value: "USD 8 M",
        provenance: "DECLARADO",
        sourceId: "dossier",
        note: "Monto contractual",
      },
      {
        label: "Horizonte",
        value: `${lv.horizonYears} años`,
        provenance: "DECLARADO",
        sourceId: "dossier",
      },
      {
        label: "Commodity",
        value: lv.commodity.replace("-", "–"),
        provenance: "DECLARADO",
        sourceId: "platform",
        conflictId: has("losverdes-commodity"),
      },
    ],
    terms: [
      {
        label: "Instrumento",
        value: "Acciones preferentes · SpA",
        provenance: "DECLARADO",
        sourceId: "dossier",
      },
      {
        label: "Tamaño de la ronda",
        value: "USD 1,5 M",
        provenance: "DECLARADO",
        sourceId: "dossier",
        conflictId: has("losverdes-round-size"),
      },
      {
        label: "Ticket mínimo",
        value: `Dossier USD ${DECK_TERMS.minUsd.toLocaleString("es-CL")} · plataforma USD ${lv.minTicketUsd.toLocaleString("es-CL")}`,
        provenance: "DECLARADO",
        sourceId: "dossier",
        conflictId: has("losverdes-min-ticket"),
      },
      {
        label: "Colocación declarada",
        value: `${DECK_TERMS.tilamaPlacement} %`,
        provenance: "DECLARADO",
        sourceId: "dossier",
        note: "No es efectivo recaudado",
      },
    ],
    termsIssuer: "Valle Escondido SpA",
    map: {
      imageUrl: losverdesPert.url,
      aspect: 1.6,
      caption: "Pertenencias del catastro del proyecto sobre mosaico satelital. Contexto visual.",
      sourceId: "catastro",
      crs: "No informado",
      extent: "No informado",
      retrieved: "No informado",
      acquisition: "No informada",
      attribution: "Imagen: Esri World Imagery · Polígonos: catastro del proyecto",
    },
    risks: [
      {
        area: "Contractual",
        risk: "Integración multi-titular declarada, no verificada",
        level: "Alto",
        status: "Revisión de contratos pendiente",
      },
      {
        area: "Geológico",
        risk: "Sin recursos ni reservas certificados",
        level: "Alto",
        status: "Pendiente",
      },
      { area: "Liquidez", risk: "Acciones no transables", level: "Alto", status: "Inherente" },
      {
        area: "Datos",
        risk: "Ticket mínimo y ronda difieren entre fuentes",
        level: "Alto",
        status: "Bloquea exportación pública",
      },
    ],
    dueDiligence: [
      { item: "Contratos con titulares", status: "Pendiente" },
      { item: "QP/CP", status: "No designada" },
    ],
    sources: [
      {
        id: "dossier",
        label: "Dossier comercial de la operadora",
        period: "Octubre 2026",
        provenance: "DECLARADO",
      },
      {
        id: "platform",
        label: "Ficha de inversión registrada en la plataforma",
        period: "Octubre 2026",
        provenance: "DECLARADO",
      },
      {
        id: "catastro",
        label: "Polígonos del catastro del proyecto sobre Esri World Imagery",
        period: "No informado",
        provenance: "OFICIAL",
      },
    ],
    discrepancies: disc,
    disclaimers: COMMON_DISCLAIMERS,
    separateInstrumentNote: SEPARATE_INSTRUMENT,
  };
}

export type Availability = { ok: true } | { ok: false; reason: string };

export function availability(family: ResearchFamily, project: ResearchProject): Availability {
  if (family === "quarterly")
    return {
      ok: false,
      reason:
        "Datos insuficientes: no existen reportes trimestrales verificados de producción, despachos ni caja.",
    };
  if (family === "statement")
    return {
      ok: false,
      reason:
        "La cartola del inversionista se emite solo desde su wallet con sus posiciones reales; no se genera aquí para no exponer datos privados.",
    };
  if (project === "losverdes" && family !== "factsheet")
    return {
      ok: false,
      reason: "Datos insuficientes en la plataforma para este documento de Los Verdes – Tilama.",
    };
  return { ok: true };
}

export function buildResearchDoc(
  family: ResearchFamily,
  project: ResearchProject,
  issued = new Date().toLocaleDateString("es-CL", { dateStyle: "long" }),
): ResearchDoc | null {
  if (!availability(family, project).ok) return null;
  return project === "cholqui" ? cholquiDoc(family, issued) : losVerdesDoc(family, issued);
}
