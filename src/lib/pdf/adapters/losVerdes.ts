/**
 * Adaptador: snapshot canónico de Los Verdes – Tilama → modelo de documento global.
 * Solo usa datos efectivamente presentes en el reporte del proyecto.
 */
import { publicUrl } from "@/lib/publicUrl";
import type { TilamaReport } from "@/lib/tilama.functions";
import type { ProjectDoc } from "../model";

export const LOS_VERDES_DOC_VERSION = "v3.0";

const num = (v: number | null | undefined, dec = 2) =>
  v == null || Number.isNaN(Number(v))
    ? "—"
    : Number(v).toLocaleString("es-CL", { maximumFractionDigits: dec });

export function buildLosVerdesDoc(report: TilamaReport): ProjectDoc {
  const { project, stats, samples, targets, concessions, satAnomalies } = report;

  const topSamples = [...samples]
    .filter((s) => s.cu_pct != null)
    .sort((a, b) => (b.cu_pct ?? 0) - (a.cu_pct ?? 0))
    .slice(0, 10);

  const labs = Array.from(new Set(samples.map((s) => s.lab).filter(Boolean))) as string[];
  const topTargets = targets.slice(0, 10);

  return {
    code: project.code,
    name: project.name,
    subtitle: `${project.commodity ?? "Cu"} · Distrito de exploración con muestreo geoquímico sistemático`,
    commodity: project.commodity ?? "Cu",
    stage: "Exploración · muestreo de superficie",
    location: [project.region, project.country].filter(Boolean).join(", "),
    liveUrl: publicUrl("/terminal/losverdes"),
    docVersion: LOS_VERDES_DOC_VERSION,
    tags: [
      project.commodity ?? "Cu",
      `${stats.concessionsTotal} concesiones`,
      `${Math.round(stats.concessionsHa).toLocaleString("es-CL")} ha`,
      project.region ?? "Chile",
    ],
    kpis: [
      {
        label: "Muestras geoquímicas",
        value: String(stats.samplesTotal),
        note: labs.length ? `Laboratorio: ${labs.join(", ")}` : undefined,
      },
      {
        label: "Cu máximo en muestra",
        value: `${num(stats.cuMaxPct)} %`,
        note: `Promedio ${num(stats.cuAvgPct)} % Cu`,
      },
      {
        label: "Targets definidos",
        value: String(stats.targetsTotal),
        note: `${stats.targetsCritical} críticos · ${stats.targetsHigh} altos`,
      },
      {
        label: "Superficie catastral",
        value: `${Math.round(stats.concessionsHa).toLocaleString("es-CL")} ha`,
        note: `${stats.concessionsTotal} concesiones`,
      },
      {
        label: "Anomalías satelitales",
        value: String(stats.satTotal),
        note: `${stats.satHigh} severidad alta`,
      },
      {
        label: "Au / Ag máximos",
        value: `${num(stats.auMaxGpt, 3)} g/t · ${num(stats.agMaxGpt, 1)} g/t`,
        note: "Valores puntuales de superficie",
      },
    ],
    thesis: [
      `Distrito con ${stats.samplesTotal} muestras de superficie georreferenciadas y trazables a laboratorio.`,
      `Ley máxima de ${num(stats.cuMaxPct)} % Cu y promedio de ${num(stats.cuAvgPct)} % Cu sobre el conjunto muestreado.`,
      `${stats.targetsTotal} blancos de exploración priorizados, ${stats.targetsCritical} de ellos críticos, apoyados en ${stats.satTotal} anomalías satelitales.`,
      `Catastro consolidado de ${stats.concessionsTotal} concesiones sobre ${Math.round(stats.concessionsHa).toLocaleString("es-CL")} ha.`,
    ],
    chart: {
      title: "Diez muestras de mayor ley de cobre",
      labelA: "Cu (%)",
      unit: "% Cu",
      data: topSamples.map((s) => ({ label: s.sample_code, a: Number(s.cu_pct ?? 0) })),
      caption:
        "Muestras puntuales de superficie. No permiten estimar ley media de mina, dilución, continuidad ni recuperación metalúrgica; se presentan como indicio exploratorio.",
    },
    map: {
      title: "Muestreo y blancos de exploración",
      caption: `Puntos de muestreo georreferenciados (UTM 19S reproyectado a WGS84). El tamaño representa la ley de Cu; los puntos destacados son blancos prioritarios.`,
      points: [
        ...samples
          .filter((s) => s.cu_pct != null)
          .slice(0, 160)
          .map((s) => ({ label: s.sample_code, lat: s.lat, lng: s.lng, value: Number(s.cu_pct) })),
        ...topTargets
          .filter((t) => t.lat != null && t.lng != null)
          .map((t) => ({ label: t.code, lat: Number(t.lat), lng: Number(t.lng), highlight: true })),
      ],
    },
    sections: [
      {
        eyebrow: "Catastro",
        title: "Concesiones del distrito",
        deck: true,
        lead: `${stats.concessionsTotal} concesiones sobre ${Math.round(stats.concessionsHa).toLocaleString("es-CL")} ha.`,
        blocks: [
          {
            kind: "table",
            head: ["Código", "Nombre", "Tipo", "Estado", "ha"],
            widths: [0.16, 0.34, 0.16, 0.18, 0.16],
            rows: concessions
              .slice(0, 20)
              .map((c) => [
                c.code,
                c.name,
                c.concession_type ?? "—",
                c.status ?? "—",
                num(c.area_ha, 1),
              ]),
          },
        ],
      },
      {
        eyebrow: "Blancos",
        title: "Targets priorizados",
        deck: true,
        blocks: [
          {
            kind: "table",
            head: ["Código", "Nombre", "Tipo", "Prioridad", "Score"],
            widths: [0.16, 0.34, 0.18, 0.16, 0.16],
            rows: topTargets.map((t) => [
              t.code,
              t.name,
              t.target_type ?? "—",
              t.priority ?? "—",
              t.score == null ? "—" : num(t.score, 1),
            ]),
          },
        ],
      },
      {
        eyebrow: "Satelital",
        title: "Anomalías espectrales",
        blocks: [
          {
            kind: "table",
            head: ["Índice", "Severidad", "Score", "Área (ha)"],
            widths: [0.3, 0.24, 0.22, 0.24],
            rows: satAnomalies
              .slice(0, 12)
              .map((a) => [
                a.index_code,
                a.severity ?? "—",
                a.score == null ? "—" : num(a.score, 2),
                num(a.area_ha, 1),
              ]),
          },
        ],
      },
      {
        eyebrow: "Muestreo",
        title: "Resultados de laboratorio destacados",
        blocks: [
          {
            kind: "table",
            head: ["Muestra", "Tipo", "Cu %", "Au g/t", "Ag g/t", "Laboratorio"],
            widths: [0.17, 0.17, 0.14, 0.14, 0.14, 0.24],
            rows: topSamples.map((s) => [
              s.sample_code,
              s.sample_type ?? "—",
              num(s.cu_pct),
              num(s.au_gpt, 3),
              num(s.ag_gpt, 1),
              s.lab ?? "—",
            ]),
          },
        ],
      },
    ],
    disclaimers: [
      "No existe estimación de recursos ni reservas bajo un estándar reconocido (CH 20235 / NI 43-101 / JORC / S-K 1300).",
      "Las leyes provienen de muestras puntuales de superficie: no representan ley media de mina, dilución, continuidad ni recuperación.",
      "Las anomalías satelitales son indicios espectrales que requieren verificación en terreno.",
      "El catastro debe validarse contra la fuente registral vigente antes de cualquier decisión de inversión.",
      "Documento de trabajo; no constituye oferta pública de valores ni recomendación de inversión.",
    ],
  };
}
