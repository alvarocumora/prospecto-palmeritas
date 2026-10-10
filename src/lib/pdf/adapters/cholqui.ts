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
import { getToki2ReportContext } from "@/lib/cholqui/toki2ReportContext";
import type { ProjectDoc } from "../model";
import { cholquiGeoscienceSections } from "./cholquiGeoscience";

export const CHOLQUI_DOC_VERSION = "v4.1";

export function buildCholquiDoc(): ProjectDoc {
  const cuMax = Math.max(...CHOLQUI_ASSAYS.map((a) => a.cuTotalPct));
  const cuMin = Math.min(...CHOLQUI_ASSAYS.map((a) => a.cuTotalPct));
  const ratios = CHOLQUI_ASSAYS.map(solubleRatioPct);
  const ratioMin = Math.min(...ratios);
  const ratioMax = Math.max(...ratios);
  const toki2 = getToki2ReportContext();

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
      ...(toki2
        ? [
            {
              status: "DERIVED" as const,
              provenance: "DERIVED" as const,
              label: "Toki 2 · planificación DEM",
              detail: `${toki2.areaHa.toLocaleString("es-CL")} ha con ${toki2.controlPoints.length} puntos base de levantamiento. El screening topográfico usa Copernicus GLO-30 en el módulo operativo; las métricas DEM sólo entran al informe cuando existe una corrida/snapshot versionado.`,
              confidence: "medium" as const,
              source: "GeoCapitals · Toki 2 DEM field planning module",
            },
          ]
        : []),
      {
        status: "PENDING_DD",
        provenance: "PENDING_DD",
        label: "Metalurgia y recursos",
        detail:
          "Sin ensayos metalúrgicos de recuperación/consumo de ácido y sin estimación de recursos bajo estándar reconocido.",
        confidence: "low",
      },
    ],
    milestones: CHOLQUI_ROUND.milestones.map((m) => ({ when: m.when, what: m.what })),
    sections: [
      ...cholquiGeoscienceSections(),
      {
        eyebrow: "Geología",
        title: "Modelo geológico y mineralización",
        deck: true,
        lead: CHOLQUI_GEOLOGY.estilo,
        blocks: [
          {
            kind: "narrative",
            body: `La litología descrita comprende ${CHOLQUI_GEOLOGY.litologia}. La mineralogía observada incluye ${CHOLQUI_GEOLOGY.mineralogia}. Estos antecedentes describen el marco de exploración; no demuestran por sí solos continuidad, potencia ni ley media.`,
            provenance: "OBSERVED",
            confidence: "medium",
            source: "Registro geológico del proyecto",
          },
          {
            kind: "evidence",
            label: "Observaciones de terreno",
            body: `${CHOLQUI_GEOLOGY.observaciones} observaciones de terreno sustentan la descripción geológica disponible.`,
            provenance: "OBSERVED",
            confidence: "medium",
            source: "Registro de observaciones de terreno",
          },
          {
            kind: "finding",
            title: "Cuerpos y controles descritos",
            body: CHOLQUI_GEOLOGY.cuerposDetalle.join(" "),
            provenance: "INTERPRETED",
            confidence: "medium",
            source: "Síntesis geológica del proyecto",
          },
          {
            kind: "evidence",
            label: "Potencial conceptual La Maza",
            body: `Se documenta un potencial geológico conceptual de ${CHOLQUI_CONCEPTUAL.tonnes.toLocaleString("es-CL")} t en ${CHOLQUI_CONCEPTUAL.sector}, calculado como ${CHOLQUI_CONCEPTUAL.formula}. ${CHOLQUI_CONCEPTUAL.note}`,
            provenance: "INTERPRETED",
            confidence: "low",
            source: "Prospecto Cholqui — no es recurso",
          },
        ],
      },
      {
        eyebrow: "Laboratorio",
        title: "Trazabilidad de los análisis",
        blocks: [
          {
            kind: "narrative",
            body: `El dataset analítico utilizado en este documento contiene ${CHOLQUI_ASSAYS.length} muestras puntuales de superficie respaldadas por ${CHOLQUI_ASSAY_REPORTS.length} informes de laboratorio. Los resultados son evidencia geoquímica localizada y no una estimación de ley media del depósito.`,
            provenance: "CERTIFIED",
            confidence: "high",
            source: CHOLQUI_ASSAY_REPORTS.map((report) => report.id).join(", "),
          },
          {
            kind: "evidence",
            label: "Ensayes certificados",
            body: `El cobre total observado en las muestras se ubica entre ${cuMin.toFixed(2).replace(".", ",")} % y ${cuMax.toFixed(2).replace(".", ",")} %, con razón Cu soluble/total entre ${ratioMin.toFixed(0)} % y ${ratioMax.toFixed(0)} %.`,
            provenance: "CERTIFIED",
            confidence: "high",
            source: CHOLQUI_ASSAY_REPORTS.map((report) => report.id).join(", "),
          },
          {
            kind: "finding",
            title: "Lectura técnica",
            body: "La respuesta analítica justifica continuar la validación geológica y metalúrgica, pero el muestreo puntual no permite inferir continuidad tridimensional, dilución, recuperación ni ley media de mina.",
            provenance: "INTERPRETED",
            confidence: "medium",
          },
          {
            kind: "appendixTable",
            title: "Informes de laboratorio",
            head: ["Informe", "Laboratorio", "Solicitante", "Muestras", "Fecha informe"],
            widths: [0.16, 0.24, 0.26, 0.14, 0.2],
            provenance: "CERTIFIED",
            source: "Informes de laboratorio del proyecto",
            rows: CHOLQUI_ASSAY_REPORTS.map((report) => [
              report.id,
              report.lab,
              report.applicant,
              String(report.samples),
              report.reportDate,
            ]),
          },
          {
            kind: "appendixTable",
            title: "Resultados analíticos completos",
            head: ["Muestra", "Sector", "Cu total %", "Cu sol. %", "Au g/t", "Ag ppm"],
            widths: [0.12, 0.38, 0.14, 0.14, 0.11, 0.11],
            provenance: "CERTIFIED",
            source: CHOLQUI_ASSAY_REPORTS.map((report) => report.id).join(", "),
            rows: CHOLQUI_ASSAYS.map((assay) => [
              assay.sample.replace(/^P-?/, "P-"),
              assay.location,
              assay.cuTotalPct.toFixed(2).replace(".", ","),
              assay.cuSolublePct.toFixed(2).replace(".", ","),
              assay.auGpt.toFixed(2).replace(".", ","),
              String(assay.agPpm),
            ]),
          },
        ],
      },
      {
        eyebrow: "Escenario operacional",
        title: "Ruta de monetización a ENAMI",
        deck: true,
        profiles: ["investment"],
        lead: "Escenario comercial separado de la evidencia geológica.",
        blocks: [
          {
            kind: "narrative",
            body: `El escenario base entregado por el titular considera ${CHOLQUI_BASE_CASE.tonnes.toLocaleString("es-CL")} t en ${CHOLQUI_BASE_CASE.months} meses, con rampa ${CHOLQUI_BASE_CASE.ramp} y ${CHOLQUI_BASE_CASE.gradePct} % de Cu soluble. Las cifras son ilustrativas y no corresponden a VAN o TIR auditados.`,
            provenance: "SCENARIO",
            confidence: "low",
            source: "Escenario base entregado por el titular",
          },
          {
            kind: "evidence",
            label: "Supuestos económicos",
            body: "Los supuestos de producción, precio, tarifa, logística y costos permanecen separados de la evidencia técnica y requieren due diligence antes de una decisión de capital.",
            provenance: "SCENARIO",
            confidence: "low",
          },
          {
            kind: "appendixTable",
            title: "Supuestos del escenario operacional",
            head: ["Concepto", "Detalle"],
            widths: [0.34, 0.66],
            provenance: "SCENARIO",
            source: "Escenario base entregado por el titular",
            rows: CHOLQUI_ASSUMPTIONS.map(([key, value]) => [key, value]),
          },
        ],
      },
      ...(toki2
        ? [
            {
              eyebrow: "Ground truth",
              title: "Toki 2 · programa de levantamiento geológico",
              blocks: [
                {
                  kind: "narrative" as const,
                  body: `La concesión ${toki2.name} (rol ${toki2.rol}) cubre aproximadamente ${toki2.areaHa.toLocaleString("es-CL")} ha. El programa utiliza nueve estaciones base derivadas de la geometría canónica de la concesión: ocho controles perimetrales y una estación central. Su objetivo es levantar litología, estructuras, alteración, mineralización visible, accesibilidad y condiciones para trabajo posterior.`,
                  provenance: "DOCUMENTARY" as const,
                  confidence: "medium" as const,
                  source: "Catastro SERNAGEOMIN cargado en GeoCapitals",
                },
                {
                  kind: "evidence" as const,
                  label: "Screening satelital actual",
                  body: `El pase Sentinel-2 actualmente cargado contiene ${toki2.satelliteAnomaliesInside} anomalías cuyo centroide cae dentro de Toki 2. Este conteo es evidencia derivada de teledetección y no confirma ni descarta mineralización.`,
                  provenance: "DERIVED" as const,
                  confidence: "medium" as const,
                  source:
                    [toki2.satelliteProvider, toki2.satelliteRunId].filter(Boolean).join(" · ") ||
                    "GeoCapitals satellite candidates",
                },
                {
                  kind: "finding" as const,
                  title: "Lectura de terreno requerida",
                  body: "La ausencia de una anomalía espectral interna no es evidencia de ausencia de mineralización. Cobertura vegetal, sombra topográfica, resolución de Sentinel-2 y mineralización estructural sin expresión superficial obligan a validar el sector mediante mapeo y muestreo.",
                  provenance: "INTERPRETED" as const,
                  confidence: "medium" as const,
                },
                {
                  kind: "recommendation" as const,
                  title: "Campaña inicial Toki 2",
                  body: "Ejecutar control perimetral y accesos, traverse N–S, traverse E–O, seguimiento de estructuras y muestreo selectivo. En cada estación registrar GPS, fotografía, litología, alteración, mineralización visible, rumbo, manteo, potencia, acceso y pendiente local.",
                  priority: "high" as const,
                },
                {
                  kind: "gap" as const,
                  title: "Volumen y tonelaje todavía no habilitados",
                  body: "El DEM permite caracterizar geometría superficial, pendiente y relieve. No existe base suficiente para estimar toneladas mineralizadas hasta delimitar un cuerpo geológico, medir potencia y continuidad y disponer de una densidad sustentada.",
                  action:
                    "Completar ground-truth y, si se define un cuerpo, versionar la geometría 3D y la densidad antes de habilitar cualquier escenario volumétrico.",
                },
                {
                  kind: "appendixTable" as const,
                  title: "Puntos base de levantamiento Toki 2",
                  head: ["Punto", "Objetivo", "Latitud", "Longitud"],
                  widths: [0.14, 0.46, 0.2, 0.2],
                  provenance: "PROPOSED" as const,
                  source: "Geometría canónica Toki 2 · GeoCapitals",
                  rows: toki2.controlPoints.map((point) => [
                    point.code,
                    point.purpose,
                    point.lat.toFixed(6),
                    point.lng.toFixed(6),
                  ]),
                },
              ],
            },
          ]
        : []),
      {
        eyebrow: "Brechas",
        title: "Materias pendientes antes de comprometer capital",
        blocks: [
          {
            kind: "narrative",
            body: "Las siguientes brechas se mantienen explícitas para evitar que una ausencia de datos sea reemplazada por una conclusión automática o por texto generado.",
            provenance: "PENDING_DD",
            confidence: "low",
          },
          ...CHOLQUI_GAPS.map((gap, index) => ({
            kind: "gap" as const,
            title: `Brecha material ${index + 1}`,
            body: gap,
          })),
          {
            kind: "recommendation",
            title: "Cerrar brechas antes de escalar el compromiso",
            body: "Priorizar verificación legal, metalurgia, topografía, logística y demostración de inventario antes de convertir escenarios comerciales en decisiones de inversión.",
            priority: "high",
          },
        ],
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
