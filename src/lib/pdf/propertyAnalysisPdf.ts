import { jsPDF } from "jspdf";
import {
  bullets,
  drawFooter,
  drawHeader,
  editorialTable,
  ensureBrandFonts,
  eyebrow,
  noticeBox,
  paperBackground,
  paragraph,
  title,
} from "./brand/kit";
import type { PropertySummary } from "@/components/geoscene/propertyAnalysis";
import type { PropertyEstimate } from "@/lib/geoscene/propertyEstimate.functions";

/** Ficha institucional de pertenencia: vista capturada, evidencia, estimación IA y avisos. */
export async function buildPropertyAnalysisPdf(o: {
  projectName: string;
  summary: PropertySummary;
  image: string | null;
  viewNote: string;
  estimate: PropertyEstimate | null;
}): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await ensureBrandFonts(doc);
  const w = doc.internal.pageSize.getWidth(),
    h = doc.internal.pageSize.getHeight(),
    m = 48,
    cw = w - 2 * m;
  const issued = new Date().toISOString().slice(0, 10);
  let page = 1;
  const start = () => {
    paperBackground(doc, w, h);
    drawHeader(doc, { w, m, left: "Ficha de pertenencia", right: issued });
  };
  const ensure = (y: number, need: number) => {
    if (y + need < h - 50) return y;
    drawFooter(doc, { w, h, m, left: o.projectName, page });
    doc.addPage();
    page++;
    start();
    return 70;
  };
  start();
  let y = 76;
  eyebrow(doc, m, y, o.projectName);
  y += 16;
  y += title(doc, m, y + 8, o.summary.property.label, 22, cw) + 6;
  const p = o.summary.property;
  y +=
    paragraph(
      doc,
      m,
      y,
      [
        `Titular: ${p.titular ?? "no informado"}`,
        `Situación: ${p.situacion ?? "no informada"}`,
        `Superficie: ${p.hectareas != null ? `${p.hectareas} ha` : "no informada"}`,
        "Fuente: catastro SERNAGEOMIN (OFICIAL)",
      ].join("  ·  "),
      cw,
      8.5,
    ) + 10;
  if (o.image) {
    const ih = cw * 0.56;
    doc.addImage(o.image, "JPEG", m, y, cw, ih);
    y += ih + 4;
    y += paragraph(doc, m, y + 6, o.viewNote, cw, 7.2) + 10;
  }
  y = ensure(y, 160);
  eyebrow(doc, m, y + 8, "Evidencia dentro de la pertenencia");
  y += 18;
  const s = o.summary;
  y +=
    editorialTable(doc, {
      x: m,
      y,
      w: cw,
      widths: [cw * 0.42, cw * 0.18, cw * 0.4],
      head: ["Capa", "Elementos", "Procedencia"],
      rows: [
        [
          "Firmas espectrales (EMIT/ASTER/Sentinel)",
          String(s.spectral.total),
          "MODELADO · hipótesis",
        ],
        ...s.spectral.byMineral
          .slice(0, 6)
          .map((b) => [
            `  · ${b.label}`,
            String(b.count),
            b.maxIntensity != null ? `intensidad máx. ${(b.maxIntensity * 100).toFixed(0)} %` : "—",
          ]),
        [
          "Estructuras medidas",
          `${s.structures.measured} (${s.structures.withDip} con manteo)`,
          "MEDIDO en terreno",
        ],
        ["Lineamientos Sentinel-1", String(s.lineaments), "INTERPRETADO"],
        [
          "Unidades carta geológica",
          s.officialUnits.map((u) => u.code).join(", ") || "0",
          "OFICIAL · SERNAGEOMIN",
        ],
        ["Fallas carta geológica", String(s.officialFaults), "OFICIAL · SERNAGEOMIN"],
        ["Anomalías geofísicas", String(s.geophysicsAnomalies), "Solo con archivo fuente"],
        ["Sondajes ejecutados", String(s.drillholes), "MEDIDO"],
      ],
    }) + 12;
  if (s.gaps.length) {
    y = ensure(y, 60);
    y += bullets(doc, m, y + 8, s.gaps, cw, 8.5) + 6;
  }
  y = ensure(y, 140);
  eyebrow(doc, m, y + 8, "Estimación por IA · interpretativa");
  y += 22;
  if (o.estimate) {
    const e = o.estimate;
    y +=
      paragraph(
        doc,
        m,
        y,
        `Prospectividad cualitativa: ${e.prospectivity} · Confianza: ${e.confidence}`,
        cw,
        10,
      ) + 6;
    for (const t of e.synthesis) {
      y = ensure(y, 40);
      y += paragraph(doc, m, y, t, cw, 9) + 4;
    }
    for (const [lab, list] of [
      ["Impulsores", e.drivers],
      ["Vacíos de información", e.gaps],
      ["Próximos pasos de verificación", e.nextSteps],
    ] as const) {
      if (!list.length) continue;
      y = ensure(y, 50);
      y += paragraph(doc, m, y + 4, lab, cw, 9.5) + 6;
      y += bullets(doc, m, y, [...list], cw, 8.5);
    }
  } else {
    y += paragraph(doc, m, y, "No se generó estimación por IA para esta ficha.", cw, 9) + 6;
  }
  y = ensure(y, 110);
  noticeBox(
    doc,
    m,
    y + 10,
    cw,
    [
      "Documento informativo; no constituye informe técnico NI 43-101/JORC ni declara recursos o reservas.",
      "Las firmas satelitales y la estimación por IA son interpretaciones para priorizar trabajo de terreno, no prueba de mineralización.",
      "Inversión minera de alto riesgo e iliquidez; verifique con una Persona Competente antes de decidir.",
    ],
    "Aviso de riesgo",
  );
  drawFooter(doc, { w, h, m, left: o.projectName, page });
  return doc.output("blob");
}
