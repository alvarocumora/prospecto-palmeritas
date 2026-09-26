/**
 * Adaptador: antecedentes canónicos de Cholqui → modelo de documento global.
 * No inventa cifras: toda la información proviene de `features/franco/data/cholqui`.
 */
import { publicUrl } from "@/lib/publicUrl";
import {
  CHOLQUI,
  CHOLQUI_ASSAYS,
  CHOLQUI_ASSAY_REPORTS,
  CHOLQUI_ASSUMPTIONS,
  CHOLQUI_BASE_CASE,
  CHOLQUI_CAVEATS,
  CHOLQUI_CONCEPTUAL,
  CHOLQUI_ENAMI,
  CHOLQUI_GAPS,
  CHOLQUI_GEOLOGY,
  CHOLQUI_HIGHLIGHTS,
  CHOLQUI_POINTS,
  CHOLQUI_ROUND,
  LAS_MINITAS,
  fmtClp,
  fmtUsd,
  solubleRatioPct,
} from "@/features/franco/data/cholqui";
import type { ProjectDoc } from "../model";

export const CHOLQUI_DOC_VERSION = "v3.0";

export function buildCholquiDoc(): ProjectDoc {
  const cuMax = Math.max(...CHOLQUI_ASSAYS.map((a) => a.cuTotalPct));
  const cuMin = Math.min(...CHOLQUI_ASSAYS.map((a) => a.cuTotalPct));
  const ratios = CHOLQUI_ASSAYS.map(solubleRatioPct);
  const ratioMin = Math.min(...ratios);
  const ratioMax = Math.max(...ratios);

  return {
    reportProfile: "technical",
    code: CHOLQUI.code,
    name: CHOLQUI.name,
    subtitle: `${CHOLQUI.commodity} · ${CHOLQUI.stage}`,
    commodity: CHOLQUI.commodity,
    stage: CHOLQUI.stage,
    location: CHOLQUI.location,
    liveUrl: publicUrl(CHOLQUI.liveUrl),
    docVersion: CHOLQUI_DOC_VERSION,
    tags: [
      CHOLQUI.commodity,
      `~${CHOLQUI.areaHa.toLocaleString("es-CL")} ha`,
      `${CHOLQUI.pedimentos} pedimentos · ${CHOLQUI.pertenencias} pertenencias`,
      CHOLQUI.region,
    ],
    kpis: [
      {
        label: "Superficie",
        value: `${CHOLQUI.areaHa.toLocaleString("es-CL")} ha`,
        note: `${CHOLQUI.pedimentos} pedimentos + ${CHOLQUI.pertenencias} pertenencias`,
      },
      {
        label: "Cu total en muestras",
        value: `${cuMin.toFixed(2).replace(".", ",")}–${cuMax.toFixed(2).replace(".", ",")} %`,
        note: `${CHOLQUI_ASSAYS.length} muestras puntuales de superficie`,
      },
      {
        label: "Razón Cu soluble",
        value: `${ratioMin.toFixed(0)}–${ratioMax.toFixed(0)} %`,
        note: "Favorable a ruta de lixiviación",
      },

      {
        label: "Ronda referencial",
        value: `${fmtUsd(CHOLQUI_ROUND.roundSizeUsd)}`,
        note: `${CHOLQUI_ROUND.equityOfferedPct} % equity · ticket mínimo ${fmtUsd(CHOLQUI_ROUND.minTicketUsd)}`,
      },
      {
        label: "Tarifa ENAMI 1,5 % Cu sol.",
        value: `${fmtClp(89_571)}/tms`,
        note: CHOLQUI_ENAMI.circular,
      },
      {
        label: "Faena vecina (tercero)",
        value: `${LAS_MINITAS.throughputTMonth.toLocaleString("es-CL")} t/mes`,
        note: LAS_MINITAS.name,
      },
    ],
    thesis: CHOLQUI_HIGHLIGHTS,
    chart: {
      title: "Cobre total frente a cobre soluble por muestra",
      labelA: "Cu total (%)",
      labelB: "Cu soluble (%)",
      unit: "% en peso",
      data: CHOLQUI_ASSAYS.map((a) => ({
        label: a.sample.replace(/^P-?/, "P-"),
        a: a.cuTotalPct,
        b: a.cuSolublePct,
      })),
      caption: `Siete muestras puntuales de superficie certificadas en ${CHOLQUI_ASSAY_REPORTS.length} informes de laboratorio (${CHOLQUI_ASSAY_REPORTS.map((r) => r.id).join(", ")}). La razón soluble/total de ${ratioMin.toFixed(0)}–${ratioMax.toFixed(0)} % es el argumento metalúrgico central: no permite estimar ley media de mina, dilución, continuidad ni recuperación.`,
    },
    allocation: {
      title: "Uso de fondos de la ronda",
      centerTop: fmtUsd(CHOLQUI_ROUND.roundSizeUsd),
      centerSub: `${CHOLQUI_ROUND.equityOfferedPct} % equity`,
      slices: CHOLQUI_ROUND.useOfFunds.map((u) => ({ label: u.label, pct: u.pct })),
      caption: `Instrumento: ${CHOLQUI_ROUND.instrument}. Valorización referencial ${fmtUsd(CHOLQUI_ROUND.valuationLowUsd)}–${fmtUsd(CHOLQUI_ROUND.valuationHighUsd)} (${CHOLQUI_ROUND.valuationMethod}). Términos de conversación, no oferta pública.`,
    },
    map: {
      title: "Puntos de observación y muestreo",
      caption: `${CHOLQUI_POINTS.length} puntos de control levantados en ${CHOLQUI.crs}. El tamaño del círculo representa la ley de Cu total cuando la muestra fue analizada en laboratorio.`,
      valueUnit: "% Cu total",
      captureSelector: '[data-report-map="cholqui"]',
      source: "GeoCapitals Live Map",
      crs: "WGS84",
      imagery: "Esri World Imagery",
      points: [
        ...CHOLQUI_POINTS.map((p) => {
          const assay = CHOLQUI_ASSAYS.find(
            (a) => a.sample === p.code || a.sample === p.code.replace("-", ""),
          );
          return {
            label: p.code,
            lat: p.lat,
            lng: p.lng,
            value: assay?.cuTotalPct,
          };
        }),
        { label: LAS_MINITAS.name, lat: LAS_MINITAS.lat, lng: LAS_MINITAS.lng, highlight: true },
      ],
    },
    dataQuality: [
      {
        status: "PENDING_DD",
        provenance: "DOCUMENTARY",
        label: "Propiedad minera",
        detail: `${CHOLQUI.pedimentos} pedimentos y ${CHOLQUI.pertenencias} pertenencias declaradas; dominio y vigencia requieren matriz documental única.`,
        confidence: "medium",
      },
      {
        status: "VERIFIED",
        provenance: "CERTIFIED",
        label: "Ensayes de superficie",
        detail: `${CHOLQUI_ASSAYS.length} muestras puntuales respaldadas por ${CHOLQUI_ASSAY_REPORTS.length} informes de laboratorio.`,
        confidence: "high",
      },
      {
        status: "OBSERVED",
        provenance: "OBSERVED",
        label: "Geología de terreno",
        detail: `${CHOLQUI_GEOLOGY.observaciones} observaciones de terreno; no equivalen a continuidad ni ley media.`,
        confidence: "medium",
      },
      {
        status: "CONCEPTUAL",
        provenance: "INTERPRETED",
        label: "Potencial conceptual",
        detail: `${CHOLQUI_CONCEPTUAL.tonnes.toLocaleString("es-CL")} t en ${CHOLQUI_CONCEPTUAL.sector}; no es recurso ni reserva.`,
        confidence: "low",
      },
      {
        status: "PENDING_DD",
        provenance: "PENDING_DD",
        label: "Metalurgia y recursos",
        detail: "Sin ensayos metalúrgicos de recuperación/consumo de ácido y sin estimación de recursos bajo estándar reconocido.",
        confidence: "low",
      },
    ],
    milestones: CHOLQUI_ROUND.milestones.map((m) => ({ when: m.when, what: m.what })),
    sections: [
      {
        eyebrow: "Geología",
        title: "Modelo geológico y mineralización",
        deck: true,
        lead: CHOLQUI_GEOLOGY.estilo,
        blocks: [
          { kind: "text", body: `Litología: ${CHOLQUI_GEOLOGY.litologia}.` },
          { kind: "text", body: `Mineralogía observada: ${CHOLQUI_GEOLOGY.mineralogia}.` },
          { kind: "bullets", items: [...CHOLQUI_GEOLOGY.cuerposDetalle] },
          {
            kind: "text",
            body: `Potencial geológico conceptual del sector ${CHOLQUI_CONCEPTUAL.sector}: ${CHOLQUI_CONCEPTUAL.tonnes.toLocaleString("es-CL")} t (${CHOLQUI_CONCEPTUAL.formula}). ${CHOLQUI_CONCEPTUAL.note}`,
          },
        ],
      },
      {
        eyebrow: "Laboratorio",
        title: "Trazabilidad de los análisis",
        blocks: [
          {
            kind: "table",
            head: ["Informe", "Laboratorio", "Solicitante", "Muestras", "Fecha informe"],
            widths: [0.16, 0.24, 0.26, 0.14, 0.2],
            rows: CHOLQUI_ASSAY_REPORTS.map((r) => [
              r.id,
              r.lab,
              r.applicant,
              String(r.samples),
              r.reportDate,
            ]),
          },
          {
            kind: "table",
            head: ["Muestra", "Sector", "Cu total %", "Cu sol. %", "Au g/t", "Ag ppm"],
            widths: [0.12, 0.38, 0.14, 0.14, 0.11, 0.11],
            rows: CHOLQUI_ASSAYS.map((a) => [
              a.sample.replace(/^P-?/, "P-"),
              a.location,
              a.cuTotalPct.toFixed(2).replace(".", ","),
              a.cuSolublePct.toFixed(2).replace(".", ","),
              a.auGpt.toFixed(2).replace(".", ","),
              String(a.agPpm),
            ]),
          },
        ],
      },
      {
        eyebrow: "Escenario operacional",
        title: "Ruta de monetización a ENAMI",
        deck: true,
        lead: `Escenario base entregado por el titular: ${CHOLQUI_BASE_CASE.tonnes.toLocaleString("es-CL")} t en ${CHOLQUI_BASE_CASE.months} meses con rampa ${CHOLQUI_BASE_CASE.ramp}, a ${CHOLQUI_BASE_CASE.gradePct} % de Cu soluble. Cifras ilustrativas, sin VAN ni TIR auditados.`,
        blocks: [{ kind: "kv", items: CHOLQUI_ASSUMPTIONS }],
      },
      {
        eyebrow: "Brechas",
        title: "Materias pendientes antes de comprometer capital",
        blocks: [{ kind: "bullets", items: CHOLQUI_GAPS }],
      },
    ],
    disclaimers: CHOLQUI_CAVEATS,
    contact: {
      name: CHOLQUI.contact.name,
      email: CHOLQUI.contact.email,
      phone: CHOLQUI.contact.phone,
    },
  };
}
