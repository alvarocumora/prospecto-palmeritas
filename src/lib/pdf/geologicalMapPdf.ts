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
import { unitColor } from "@/components/geoscene/analysisTools";
import type { GeologyMapSummary } from "@/components/geoscene/geologyMapSummary";

/** Mapa geológico institucional: vista capturada del visor + leyenda de la carta oficial. */
export async function buildGeologicalMapPdf(o: {
  projectName: string;
  image: string | null;
  viewNote: string;
  summary: GeologyMapSummary;
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
    drawHeader(doc, { w, m, left: "Mapa geológico", right: issued });
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
  y += title(doc, m, y + 8, "Mapa geológico", 22, cw) + 6;
  const s = o.summary;
  y +=
    paragraph(
      doc,
      m,
      y,
      [
        s.sheets.length ? `Carta oficial: ${s.sheets.join(" · ")}` : "Sin carta oficial en la zona",
        `${s.units.length} unidad(es) · ${s.faultsCount} falla(s) · ${s.structuresMeasured} estructura(s) medida(s)`,
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
  y = ensure(y, 100);
  eyebrow(doc, m, y + 8, "Leyenda · unidades geológicas");
  y += 18;
  if (s.units.length) {
    for (const u of s.units) {
      y = ensure(y, 16);
      const [r, g, b] = unitColor(u.code);
      doc.setFillColor(r, g, b);
      doc.rect(m, y - 8, 9, 9, "F");
      y +=
        paragraph(
          doc,
          m + 14,
          y,
          [u.code, u.nombre, u.edad, u.litologia].filter(Boolean).join(" · "),
          cw - 14,
          8.5,
        ) + 4;
    }
    y += 6;
  } else {
    y +=
      paragraph(doc, m, y, "Sin unidades de carta oficial dentro del área del proyecto.", cw, 9) +
      10;
  }
  y = ensure(y, 140);
  eyebrow(doc, m, y + 8, "Evidencia estructural");
  y += 18;
  y +=
    editorialTable(doc, {
      x: m,
      y,
      w: cw,
      widths: [cw * 0.42, cw * 0.18, cw * 0.4],
      head: ["Capa", "Elementos", "Procedencia"],
      rows: [
        [
          "Fallas carta geológica",
          String(s.faultsCount),
          "OFICIAL · SERNAGEOMIN · escala 1:100.000",
        ],
        [
          "Estructuras medidas en terreno",
          `${s.structuresMeasured} (${s.structuresWithDip} con manteo)`,
          "MEDIDO en terreno",
        ],
      ],
    }) + 12;
  if (s.gaps.length) {
    y = ensure(y, 60);
    y += bullets(doc, m, y + 8, s.gaps, cw, 8.5) + 6;
  }
  y = ensure(y, 90);
  noticeBox(
    doc,
    m,
    y + 10,
    cw,
    [
      "Cartografía regional (1:100.000, SERNAGEOMIN/CIGeo); los contactos no tienen precisión de detalle del prospecto.",
      "Las fallas y unidades mostradas son trazas regionales oficiales; no reemplazan estructuras medidas en terreno.",
      "Documento informativo; no constituye informe técnico NI 43-101/JORC ni declara recursos o reservas.",
    ],
    "Aviso de alcance",
  );
  drawFooter(doc, { w, h, m, left: o.projectName, page });
  return doc.output("blob");
}
