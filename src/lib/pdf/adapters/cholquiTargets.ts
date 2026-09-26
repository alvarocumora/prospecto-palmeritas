/**
 * Adaptador: anomalías satelitales de Cholqui + malla de sondajes propuesta
 * → modelo de documento global de Geocapitals.
 *
 * Todo lo que entra aquí viene de la corrida satelital almacenada y del
 * cálculo determinista de `lib/cholqui/drillGrid`. No se inventan cifras y
 * cada capa conserva su etiqueta de procedencia.
 */
import { publicUrl } from "@/lib/publicUrl";
import { CHOLQUI, CHOLQUI_ASSAYS, CHOLQUI_POINTS, LAS_MINITAS } from "@/features/franco/data/cholqui";
import { indexLabel, type ProposedCollar } from "@/lib/cholqui/drillGrid";
import type { CholquiSatelliteTargets } from "@/lib/cholqui/satelliteTargets.functions";
import type { ProjectDoc } from "../model";

export const CHOLQUI_TARGETS_DOC_VERSION = "v1.0";

function num(value: number, digits = 0): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function nearestSample(lat: number, lng: number): { code: string; km: number } | null {
  let best: { code: string; km: number } | null = null;
  for (const p of CHOLQUI_POINTS) {
    const dLat = (p.lat - lat) * 111.32;
    const dLng = (p.lng - lng) * 111.32 * Math.cos((lat * Math.PI) / 180);
    const km = Math.sqrt(dLat * dLat + dLng * dLng);
    if (!best || km < best.km) best = { code: p.code, km };
  }
  return best;
}

function collarRows(collars: ProposedCollar[]): string[][] {
  return collars.map((c) => [
    c.code,
    `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`,
    `${c.azimuthDeg}°`,
    `${c.dipDeg}°`,
    `${num(c.depthM)} m`,
    c.priority,
  ]);
}

export function buildCholquiTargetsDoc(data: CholquiSatelliteTargets): ProjectDoc {
  const { anomalies, collars, summary } = data;
  const top = anomalies.slice(0, 12);

  return {
    code: `${CHOLQUI.code}-SAT`,
    name: `${CHOLQUI.name} — Targets satelitales`,
    subtitle: "Anomalías espectrales y malla de sondajes propuesta",
    commodity: CHOLQUI.commodity,
    stage: "Exploración · screening satelital Nivel 0",
    location: CHOLQUI.location,
    liveUrl: publicUrl(CHOLQUI.liveUrl),
    docVersion: CHOLQUI_TARGETS_DOC_VERSION,
    tags: [
      CHOLQUI.commodity,
      `${summary.anomalies} anomalías`,
      `${summary.collars} plataformas propuestas`,
      `${num(summary.totalMeters)} m`,
    ],
    kpis: [
      {
        label: "Anomalías detectadas",
        value: String(summary.anomalies),
        note: `${summary.indexes.length} índices espectrales`,
      },
      {
        label: "Puntaje máximo",
        value: summary.maxScore != null ? summary.maxScore.toFixed(2).replace(".", ",") : "s/d",
        note: "Realce relativo al fondo del AOI",
      },
      {
        label: "Plataformas propuestas",
        value: String(summary.collars),
        note: "Fase 1 conceptual, no comprometida",
      },
      {
        label: "Metraje propuesto",
        value: `${num(summary.totalMeters)} m`,
        note: "Sondaje diamantino, inclinación -60°",
      },
      {
        label: "Anomalías perforables",
        value: String(summary.drillable),
        note: "Puntaje sobre 0,55 y no cobertura vegetal",
      },
      {
        label: "Última detección",
        value: data.runDate || "s/d",
        note: "Corrida almacenada en la plataforma",
      },
    ],
    thesis: [
      `Se detectaron ${summary.anomalies} anomalías espectrales sobre el AOI de Cholqui, agrupadas en ${summary.indexes.length} índices (óxidos de hierro, arcillas Al-OH, alteración combinada y lineamientos estructurales).`,
      `De ellas, ${summary.drillable} superan el umbral de puntaje y se traducen en ${summary.collars} plataformas propuestas por ${num(summary.totalMeters)} m de sondaje diamantino.`,
      "El azimut de perforación es perpendicular al rumbo dominante N20E documentado en La Maza, para cortar la estructura en ángulo y medir potencia real.",
      "Una anomalía espectral es un indicio, no mineralización: ningún target sustituye mapeo, canaleta ni ensaye de laboratorio.",
    ],
    chart: {
      title: "Puntaje de las anomalías principales",
      labelA: "Puntaje (0–1)",
      unit: "puntaje relativo",
      data: top.map((a, i) => ({
        label: `A-${String(i + 1).padStart(2, "0")}`,
        a: a.score ?? 0,
      })),
      caption:
        "Puntaje de realce relativo al fondo del área de interés. No es ley, no es concentración y no es identificación mineral: Sentinel-2 usa bandas anchas y sólo permite afirmar anomalía en la razón de absorción.",
    },
    map: {
      title: "Anomalías y plataformas de sondaje propuestas",
      caption: `${anomalies.length} centroides de anomalía y ${collars.length} collares propuestos sobre el AOI. El tamaño del círculo representa el puntaje de la anomalía.`,
      valueUnit: "puntaje",
      source: "Geocapitals · corrida satelital almacenada",
      crs: "WGS84",
      imagery: "Sentinel-2 L2A",
      points: [
        ...anomalies.map((a, i) => ({
          label: `A-${String(i + 1).padStart(2, "0")}`,
          lat: a.lat,
          lng: a.lng,
          value: a.score ?? undefined,
        })),
        ...collars.map((c) => ({
          label: c.code.replace("CHQ-DDH-", "DDH"),
          lat: c.lat,
          lng: c.lng,
          highlight: true,
        })),
        { label: LAS_MINITAS.name, lat: LAS_MINITAS.lat, lng: LAS_MINITAS.lng, highlight: true },
      ],
    },
    dataQuality: [
      {
        status: "DERIVED",
        label: "Anomalías espectrales",
        detail:
          "Derivadas de razones de banda Sentinel-2. Indicio de alteración, sin verificación de terreno.",
      },
      {
        status: "CONCEPTUAL",
        label: "Malla de sondajes",
        detail:
          "Propuesta de exploración calculada sobre las anomalías. No es un programa comprometido ni una estimación de recursos.",
      },
      {
        status: "VERIFIED",
        label: "Ensayes de superficie",
        detail: `${CHOLQUI_ASSAYS.length} muestras puntuales con informe de laboratorio firmado.`,
      },
      {
        status: "PENDING_DD",
        label: "Topografía y permisos",
        detail:
          "Las coordenadas de collar son preliminares: requieren topografía, acceso, servidumbres y permisos sectoriales.",
      },
    ],
    sections: [
      {
        eyebrow: "Detección",
        title: "Anomalías espectrales sobre el AOI",
        deck: true,
        lead: "Cada anomalía se lista con su índice, severidad, puntaje y superficie. El orden es por puntaje descendente.",
        blocks: [
          {
            kind: "table",
            head: ["ID", "Índice", "Severidad", "Puntaje", "Área ha", "Muestra más cercana"],
            widths: [0.09, 0.32, 0.13, 0.12, 0.12, 0.22],
            rows: top.map((a, i) => {
              const near = nearestSample(a.lat, a.lng);
              return [
                `A-${String(i + 1).padStart(2, "0")}`,
                indexLabel(a.indexCode),
                a.severity,
                a.score != null ? a.score.toFixed(2).replace(".", ",") : "s/d",
                a.areaHa != null ? num(a.areaHa, 1) : "s/d",
                near ? `${near.code} a ${num(near.km, 1)} km` : "s/d",
              ];
            }),
          },
          {
            kind: "text",
            body: "Honestidad espectral: Sentinel-2 no identifica minerales. Lo defendible es anomalía en la razón de absorción compatible con óxidos de hierro o minerales de Al-OH. La identificación mineral exige sensores hiperespectrales y verificación de terreno.",
          },
        ],
      },
      {
        eyebrow: "Propuesta",
        title: "Malla de sondajes de fase 1",
        deck: true,
        lead: `${collars.length} plataformas por ${num(summary.totalMeters)} m de sondaje diamantino, con inclinación -60° y azimut perpendicular al rumbo dominante N20E.`,
        blocks: [
          {
            kind: "table",
            head: ["Sondaje", "Collar (lat, lon)", "Azimut", "Inclinación", "Profundidad", "Prioridad"],
            widths: [0.15, 0.28, 0.12, 0.15, 0.16, 0.14],
            rows: collarRows(collars),
          },
          {
            kind: "kv",
            items: [
              ["Método propuesto", "Sondaje diamantino con recuperación de testigo"],
              ["Inclinación", "-60° desde la horizontal"],
              ["Azimut", "110° / 290° según posición respecto al eje del distrito"],
              ["Espaciamiento", "Secciones transversales al rumbo N20E"],
              ["Metraje total", `${num(summary.totalMeters)} m`],
              ["Estándar de control", "Protocolo QA/QC con blancos, estándares y duplicados"],
            ],
          },
        ],
      },
      {
        eyebrow: "Objetivos",
        title: "Qué busca cada plataforma",
        blocks: [
          {
            kind: "table",
            head: ["Sondaje", "Índice que la origina", "Objetivo geológico"],
            widths: [0.15, 0.33, 0.52],
            rows: collars.map((c) => [c.code, indexLabel(c.indexCode), c.objective]),
          },
        ],
      },
      {
        eyebrow: "Antes de perforar",
        title: "Trabajos previos obligatorios",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Topografía de detalle y replanteo en terreno de cada collar propuesto.",
              "Mapeo geológico-estructural y canaletas sobre las anomalías de mayor puntaje.",
              "Verificación de servidumbres, accesos y permisos sectoriales de cada plataforma.",
              "Protocolo QA/QC definido y laboratorio acreditado contratado antes del primer metro.",
              "Revisión de la malla por persona competente una vez incorporado el mapeo de terreno.",
            ],
          },
        ],
      },
    ],
    disclaimers: [
      "Screening satelital Nivel 0 (Sentinel-2). No constituye recurso, reserva ni identificación mineral.",
      "Las anomalías espectrales son indicios que requieren verificación de terreno (mapeo y ensaye). No reemplazan estudios de detalle.",
      "La malla de sondajes es una propuesta conceptual derivada de las anomalías: no es un programa comprometido ni fue revisada por persona competente.",
      "No existe estimación de recursos ni reservas bajo un estándar reconocido (CH 20235 / NI 43-101 / JORC / S-K 1300) para el Proyecto Cholqui.",
      "Las coordenadas de collar son preliminares y están sujetas a topografía, acceso y permisos.",
      "Documento informativo: no constituye oferta pública de valores ni recomendación de inversión.",
    ],
    contact: {
      name: CHOLQUI.contact.name,
      email: CHOLQUI.contact.email,
      phone: CHOLQUI.contact.phone,
    },
  };
}
