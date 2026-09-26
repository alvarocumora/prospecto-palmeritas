/**
 * Plantilla global C — Dossier Técnico (A4 vertical).
 * Formato editorial para revisión técnica y due diligence: portada sobria,
 * índice, secciones numeradas con figuras y tablas ligeras, y anexo de
 * advertencias. Sustituye el volcado de tablas por bloques legibles.
 */
import type jsPDF from "jspdf";
import { GC_BRAND, GC_COLOR, GC_PAGE } from "../brand/tokens";
import {
  barChart,
  brandQr,
  bullets,
  donutChart,
  donutLegend,
  drawFooter,
  drawHeader,
  drawMark,
  editorialTable,
  eyebrow,
  fill,
  font,
  ink,
  kpiGrid,
  noticeBox,
  paragraph,
  qrBlock,
  scatterMap,
  stroke,
  title,
} from "../brand/kit";
import type { ProjectDoc } from "../model";

const { w: W, h: H, m: M } = GC_PAGE.a4;
const CW = W - M * 2;
const TOP = 74;
const BOTTOM = H - 56;

export async function renderTechnicalBrief(doc: jsPDF, model: ProjectDoc): Promise<void> {
  const qr = await brandQr(model.liveUrl, 420);
  const issued = new Date().toLocaleDateString("es-CL", { dateStyle: "long" });
  let page = 1;
  let y = TOP;

  const chrome = () => {
    fill(doc, GC_COLOR.paper);
    doc.rect(0, 0, W, H, "F");
    drawHeader(doc, {
      w: W,
      m: M,
      left: `${model.code} · ${model.name}`,
      right: `Dossier técnico ${model.docVersion}`,
    });
    drawFooter(doc, { w: W, h: H, m: M, left: `${issued} · Documento confidencial`, page });
  };

  const nextPage = () => {
    doc.addPage("a4", "portrait");
    page += 1;
    chrome();
    y = TOP;
  };

  const need = (space: number) => {
    if (y + space > BOTTOM) nextPage();
  };

  /* ---------- Portada ---------- */
  fill(doc, GC_COLOR.paper);
  doc.rect(0, 0, W, H, "F");
  fill(doc, GC_COLOR.ink);
  doc.rect(0, 0, W, 240, "F");
  fill(doc, GC_COLOR.cobalt);
  doc.rect(0, 240, W * 0.34, 5, "F");

  const markW = drawMark(doc, M, 44, 30);
  font(doc, "body", "bold", 11);
  ink(doc, GC_COLOR.paper);
  doc.text(GC_BRAND.name, M + markW + 9, 64);
  font(doc, "body", "normal", 7);
  ink(doc, GC_COLOR.cobaltSoft);
  doc.text(GC_BRAND.tagline, M + markW + 9, 75);

  font(doc, "display", "bold", 30);
  ink(doc, GC_COLOR.paper);
  doc
    .splitTextToSize(model.name, CW)
    .forEach((l: string, i: number) => doc.text(l, M, 150 + i * 32));
  font(doc, "body", "normal", 9);
  ink(doc, GC_COLOR.cobaltSoft);
  doc.text(doc.splitTextToSize(model.subtitle, CW)[0], M, 200);
  font(doc, "body", "normal", 8);
  ink(doc, GC_COLOR.slate);
  doc.text(model.location, M, 218);

  y = 280;
  y +=
    kpiGrid(doc, {
      x: M,
      y,
      w: CW,
      items: model.kpis.slice(0, 4),
      cols: 2,
      rowH: 66,
      valueSize: 16,
    }) + 28;
  eyebrow(doc, M, y, "Alcance");
  y += 14;
  y +=
    paragraph(
      doc,
      M,
      y,
      "Este documento reúne los antecedentes disponibles del proyecto, distinguiendo hechos verificados, resultados de muestreo, interpretación geológica, hipótesis y escenarios. No sustituye un informe bajo un estándar reconocido.",
      CW,
      9,
    ) + 20;
  qrBlock(doc, {
    x: M,
    y,
    size: 96,
    qr,
    caption: "Live map público",
    sub: model.liveUrl.replace(/^https?:\/\//, ""),
  });
  font(doc, "body", "normal", 7.4);
  ink(doc, GC_COLOR.slate);
  doc.text(`${model.docVersion} · emitido el ${issued}`, M + 120, y + 20);
  doc.text(`${GC_BRAND.site} · ${GC_BRAND.email}`, M + 120, y + 34);
  doc.text(`WhatsApp ${GC_BRAND.whatsapp}`, M + 120, y + 48);

  /* ---------- Cuerpo ---------- */
  nextPage();

  eyebrow(doc, M, y, "01 · Resumen");
  y += 16;
  y += title(doc, M, y, "Tesis del proyecto", 17, CW) + 10;
  y += bullets(doc, M, y, model.thesis, CW, 9) + 18;

  if (model.dataQuality?.length) {
    need(150);
    eyebrow(doc, M, y, "02 · Evidence & Confidence");
    y += 16;
    y += title(doc, M, y, "Qué sabemos y con qué nivel de confianza", 17, CW) + 10;
    y +=
      editorialTable(doc, {
        x: M,
        y,
        w: CW,
        head: ["Evidencia", "Clase", "Estado", "Detalle"],
        rows: model.dataQuality.map((item) => [
          item.label,
          item.provenance ?? item.status,
          item.confidence?.toUpperCase() ?? "—",
          item.detail,
        ]),
        widths: [CW * 0.2, CW * 0.16, CW * 0.12, CW * 0.52],
        size: 7.4,
      }) + 18;
  }

  if (model.map) {
    need(260);
    eyebrow(doc, M, y, `${model.dataQuality?.length ? "03" : "02"} · Ubicación y puntos de control`);
    y += 16;
    y += title(doc, M, y, model.map.title, 17, CW) + 12;
    if (model.map.imageDataUrl) {
      doc.addImage(model.map.imageDataUrl, "JPEG", M, y, CW, 220, undefined, "FAST");
      stroke(doc, GC_COLOR.hairline);
      doc.setLineWidth(0.7);
      doc.rect(M, y, CW, 220);
      y += 232;
      const source = [model.map.imagery, model.map.source, model.map.crs]
        .filter(Boolean)
        .join(" · ");
      y += paragraph(doc, M, y, source, CW, 6.8, GC_COLOR.slate) + 8;
      if (model.map.caption)
        y += paragraph(doc, M, y, model.map.caption, CW, 8, GC_COLOR.slate) + 12;
    } else {
      scatterMap(doc, {
        x: M,
        y,
        w: CW,
        h: 220,
        points: model.map.points,
        caption: model.map.caption,
        labelTop: 6,
      });
      const capLines = model.map.caption
        ? (doc.splitTextToSize(model.map.caption, CW) as string[]).length
        : 0;
      y += 220 + (capLines ? 6 + capLines * 9 + 14 : 14);
    }
  }

  if (model.chart) {
    need(260);
    eyebrow(doc, M, y, `${model.dataQuality?.length ? "04" : "03"} · Evidencia analítica`);
    y += 16;
    y += title(doc, M, y, model.chart.title, 17, CW) + 12;
    barChart(doc, {
      x: M,
      y,
      w: CW,
      h: 200,
      data: model.chart.data,
      labelA: model.chart.labelA,
      labelB: model.chart.labelB,
      unit: model.chart.unit,
    });
    y += 212;
    if (model.chart.caption)
      y += paragraph(doc, M, y, model.chart.caption, CW, 8.2, GC_COLOR.slate) + 14;
  }

  let n = model.dataQuality?.length ? 5 : 4;
  for (const section of model.sections) {
    need(120);
    eyebrow(doc, M, y, `${String(n).padStart(2, "0")} · ${section.eyebrow}`);
    y += 16;
    y += title(doc, M, y, section.title, 17, CW) + 10;
    if (section.lead) y += paragraph(doc, M, y, section.lead, CW, 9) + 12;
    for (const block of section.blocks) {
      if (block.kind === "text") {
        need(50);
        y += paragraph(doc, M, y, block.body, CW, 9) + 12;
      }
      if (block.kind === "bullets") {
        need(50);
        y += bullets(doc, M, y, block.items, CW, 9) + 10;
      }
      if (block.kind === "kv") {
        need(70);
        y +=
          editorialTable(doc, {
            x: M,
            y,
            w: CW,
            head: ["Concepto", "Detalle"],
            rows: block.items.map(([k, v]) => [k, v]),
            widths: [CW * 0.34, CW * 0.66],
          }) + 16;
      }
      if (block.kind === "table") {
        need(80);
        y +=
          editorialTable(doc, {
            x: M,
            y,
            w: CW,
            head: block.head,
            rows: block.rows,
            widths: block.widths?.map((p) => CW * p),
          }) + 16;
      }
    }
    n += 1;
  }

  if (model.allocation && model.reportProfile === "investment") {
    need(250);
    eyebrow(doc, M, y, `${String(n).padStart(2, "0")} · Estructura de la ronda`);
    y += 16;
    y += title(doc, M, y, model.allocation.title, 17, CW) + 14;
    donutChart(doc, {
      cx: M + 92,
      cy: y + 86,
      r: 78,
      slices: model.allocation.slices,
      centerTop: model.allocation.centerTop,
      centerSub: model.allocation.centerSub,
    });
    donutLegend(doc, M + 200, y + 34, CW - 200, model.allocation.slices);
    y += 190;
    if (model.allocation.caption)
      y += paragraph(doc, M, y, model.allocation.caption, CW, 8.2, GC_COLOR.slate) + 12;
    n += 1;
  }

  if (model.milestones?.length && model.reportProfile === "investment") {
    need(120);
    eyebrow(doc, M, y, `${String(n).padStart(2, "0")} · Hitos`);
    y += 16;
    y +=
      editorialTable(doc, {
        x: M,
        y,
        w: CW,
        head: ["Plazo", "Hito"],
        rows: model.milestones.map((ms) => [ms.when, ms.what]),
        widths: [CW * 0.22, CW * 0.78],
      }) + 18;
    n += 1;
  }

  need(160);
  eyebrow(doc, M, y, `${String(n).padStart(2, "0")} · Advertencias`);
  y += 16;
  y += title(doc, M, y, "Base de información y limitaciones", 17, CW) + 12;
  const boxH = noticeBox(doc, M, y, CW, model.disclaimers, "Limitaciones materiales");
  y += boxH + 18;

  // El bloque de contacto se ancla al pie de la última página con contenido.
  y = Math.min(Math.max(y, BOTTOM - 30), BOTTOM - 30);

  stroke(doc, GC_COLOR.hairline);
  doc.setLineWidth(0.6);
  doc.line(M, y, W - M, y);
  y += 12;

  font(doc, "body", "normal", 8);
  ink(doc, GC_COLOR.slate);
  doc.text(
    `Contacto: ${[model.contact?.name, model.contact?.email, model.contact?.phone].filter(Boolean).join(" · ")}`,
    M,
    y,
  );
  doc.text(`${GC_BRAND.site} · ${GC_BRAND.email} · WhatsApp ${GC_BRAND.whatsapp}`, M, y + 13);

  // Renumerar pies con el total real
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    fill(doc, GC_COLOR.paper);
    doc.rect(W - M - 60, H - 46, 60, 22, "F");
    font(doc, "body", "normal", 7.5);
    ink(doc, GC_COLOR.slate);
    doc.text(`${p} / ${total}`, W - M, H - 21, { align: "right" });
  }
  doc.setPage(total);
}
