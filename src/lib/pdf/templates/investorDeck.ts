/**
 * Plantilla global A — Investor Deck 16:9.
 * Presentación apaisada para comités de inversión y family offices:
 * portada hero, resumen en cuadrantes, figura cartográfica, gráficos
 * vectoriales de análisis y estructura de la ronda.
 */
import type jsPDF from "jspdf";
import { GC_BRAND, GC_COLOR, GC_PAGE } from "../brand/tokens";
import {
  barChart,
  brandQr,
  bullets,
  donutChart,
  donutLegend,
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
import { blockMetaLine, mainBlocks } from "../narrative";

const { w: W, h: H, m: M } = GC_PAGE.deck;
const CW = W - M * 2;

export async function renderInvestorDeck(doc: jsPDF, model: ProjectDoc): Promise<void> {
  const qr = await brandQr(model.liveUrl, 480);
  const issued = new Date().toLocaleDateString("es-CL", { dateStyle: "long" });
  let slide = 0;

  const newSlide = (eyebrowLabel: string, heading: string) => {
    if (slide > 0) doc.addPage([W, H], "landscape");
    slide += 1;
    fill(doc, GC_COLOR.paper);
    doc.rect(0, 0, W, H, "F");
    const markW = drawMark(doc, M, 26, 16);
    font(doc, "body", "bold", 8);
    ink(doc, GC_COLOR.ink);
    doc.text(GC_BRAND.name, M + markW + 6, 38);
    font(doc, "body", "normal", 7.5);
    ink(doc, GC_COLOR.slate);
    doc.text(`${model.code} · ${model.name}`, W - M, 38, { align: "right" });
    stroke(doc, GC_COLOR.hairline);
    doc.setLineWidth(0.6);
    doc.line(M, 50, W - M, 50);
    eyebrow(doc, M, 82, eyebrowLabel);
    title(doc, M, 112, heading, 25, CW * 0.75);
    // pie
    stroke(doc, GC_COLOR.hairline);
    doc.line(M, H - 34, W - M, H - 34);
    font(doc, "body", "normal", 7);
    ink(doc, GC_COLOR.slate);
    doc.text(`${model.docVersion} · ${issued} · Documento confidencial`, M, H - 20);
    doc.text(String(slide), W - M, H - 20, { align: "right" });
  };

  /* ---------- 1. Portada hero ---------- */
  slide = 1;
  fill(doc, GC_COLOR.ink);
  doc.rect(0, 0, W, H, "F");
  fill(doc, GC_COLOR.cobalt);
  doc.rect(0, H - 10, W * 0.42, 10, "F");
  fill(doc, GC_COLOR.copper);
  doc.rect(W * 0.42, H - 10, W * 0.18, 10, "F");

  const hMarkW = drawMark(doc, M, M, 34);
  font(doc, "body", "bold", 12);
  ink(doc, GC_COLOR.paper);
  doc.text(GC_BRAND.name, M + hMarkW + 10, M + 22);
  font(doc, "body", "normal", 7.5);
  ink(doc, GC_COLOR.cobaltSoft);
  doc.text(GC_BRAND.tagline, M + hMarkW + 10, M + 34);

  font(doc, "display", "bold", 52);
  ink(doc, GC_COLOR.paper);
  doc.splitTextToSize(model.name, CW * 0.62).forEach((l: string, i: number) => {
    doc.text(l, M, 226 + i * 52);
  });
  font(doc, "body", "normal", 12);
  ink(doc, GC_COLOR.cobaltSoft);
  doc.splitTextToSize(model.subtitle, CW * 0.58).forEach((l: string, i: number) => {
    doc.text(l, M, 268 + i * 17);
  });

  // Tags
  let tx = M;
  model.tags.forEach((tag) => {
    font(doc, "body", "bold", 7.6);
    const tw = doc.getTextWidth(tag.toUpperCase()) + 18;
    stroke(doc, GC_COLOR.slate);
    doc.setLineWidth(0.6);
    doc.rect(tx, 330, tw, 19);
    ink(doc, GC_COLOR.paper);
    doc.text(tag.toUpperCase(), tx + 9, 343);
    tx += tw + 8;
  });

  font(doc, "body", "normal", 8.5);
  ink(doc, GC_COLOR.slate);
  doc.text(model.location, M, 386);
  doc.text(`${model.docVersion} · ${issued}`, M, 400);

  // QR sobre papel a la derecha
  fill(doc, GC_COLOR.paper);
  doc.rect(W - M - 190, 196, 190, 214, "F");
  doc.addImage(qr, "PNG", W - M - 175, 212, 160, 160, undefined, "FAST");
  font(doc, "body", "bold", 8);
  ink(doc, GC_COLOR.ink);
  doc.text("VER LIVE MAP", W - M - 95, 390, { align: "center" });
  font(doc, "body", "normal", 6.8);
  ink(doc, GC_COLOR.slate);
  doc.text(model.liveUrl.replace(/^https?:\/\//, ""), W - M - 95, 400, { align: "center" });

  font(doc, "body", "normal", 7);
  ink(doc, GC_COLOR.slate);
  doc.text(
    "Documento de trabajo. No constituye oferta pública de valores ni estimación de recursos o reservas.",
    M,
    H - 26,
  );

  /* ---------- 2. Resumen ejecutivo ---------- */
  newSlide("Resumen ejecutivo", "La oportunidad en cuatro cifras");
  const kpiH = kpiGrid(doc, {
    x: M,
    y: 140,
    w: CW,
    items: model.kpis.slice(0, 4),
    cols: 4,
    rowH: 96,
    valueSize: 24,
  });
  bullets(doc, M, 140 + kpiH + 42, model.thesis.slice(0, 4), CW * 0.72, 10);

  /* ---------- 3. Ubicación y catastro ---------- */
  if (model.map) {
    newSlide("Ubicación", model.map.title);
    const mapX = M;
    const mapY = 140;
    const mapW = CW * 0.66;
    const mapH = H - 140 - 82;
    if (model.map.imageDataUrl) {
      // The report uses the same satellite GIS rendered in the Live Map.
      doc.addImage(model.map.imageDataUrl, "JPEG", mapX, mapY, mapW, mapH, undefined, "FAST");
      stroke(doc, GC_COLOR.hairline);
      doc.setLineWidth(0.8);
      doc.rect(mapX, mapY, mapW, mapH);
      font(doc, "body", "normal", 6.5);
      ink(doc, GC_COLOR.slate);
      const source = [model.map.imagery, model.map.source, model.map.crs]
        .filter(Boolean)
        .join(" · ");
      doc.text(doc.splitTextToSize(source, mapW)[0], mapX, mapY + mapH + 12);
    } else {
      scatterMap(doc, {
        x: mapX,
        y: mapY,
        w: mapW,
        h: mapH,
        points: model.map.points,
        polygons: model.map.polygons,
        labelTop: 6,
      });
    }
    const rx = M + CW * 0.66 + 24;
    const rw = CW - CW * 0.66 - 24;
    let ry = 150;
    if (model.map.caption) ry += paragraph(doc, rx, ry, model.map.caption, rw, 9) + 16;
    ry += bullets(
      doc,
      rx,
      ry,
      model.map.points
        .slice(0, 5)
        .map((p) =>
          p.value != null
            ? `${p.label} — ${p.value.toFixed(2).replace(".", ",")} ${model.map?.valueUnit ?? "% Cu total"}`
            : `${p.label} — punto de control`,
        ),

      rw,
      8.4,
    );
    qrBlock(doc, {
      x: rx,
      y: Math.min(ry + 10, H - 160),
      size: 92,
      qr,
      caption: "Ver live map",
      sub: "Mapa interactivo y data room",
    });
  }

  /* ---------- 4. Análisis / gráfico ---------- */
  if (model.chart) {
    newSlide("Evidencia analítica", model.chart.title);
    barChart(doc, {
      x: M,
      y: 146,
      w: CW * 0.62,
      h: H - 146 - 80,
      data: model.chart.data,
      labelA: model.chart.labelA,
      labelB: model.chart.labelB,
      unit: model.chart.unit,
    });
    const rx = M + CW * 0.62 + 30;
    const rw = CW - CW * 0.62 - 30;
    if (model.chart.caption) paragraph(doc, rx, 160, model.chart.caption, rw, 9);
  }

  /* ---------- 5..n. Secciones marcadas para deck ---------- */
  for (const section of model.sections.filter((s) => s.deck)) {
    newSlide(section.eyebrow, section.title);
    let y = 150;
    if (section.lead) y += paragraph(doc, M, y, section.lead, CW * 0.78, 10) + 16;
    for (const block of mainBlocks(section)) {
      if (y > H - 110) break;
      if (block.kind === "narrative" || block.kind === "text") {
        y += paragraph(doc, M, y, block.body, CW * 0.78, 9.5) + 8;
        const meta = blockMetaLine(block);
        if (meta) y += paragraph(doc, M, y, meta, CW * 0.78, 6.8, GC_COLOR.slate) + 8;
      }
      if (block.kind === "finding") {
        y += noticeBox(doc, M, y, CW * 0.78, [block.body], `Hallazgo · ${block.title}`) + 10;
      }
      if (block.kind === "evidence") {
        y +=
          noticeBox(
            doc,
            M,
            y,
            CW * 0.78,
            [block.body],
            `Evidencia · ${block.label} · ${block.provenance}`,
          ) + 10;
      }
      if (block.kind === "gap") {
        const lines = block.action ? [block.body, `Acción: ${block.action}`] : [block.body];
        y += noticeBox(doc, M, y, CW * 0.78, lines, `Data gap · ${block.title}`) + 10;
      }
      if (block.kind === "recommendation") {
        const heading = block.priority
          ? `Recomendación · ${block.priority.toUpperCase()} · ${block.title}`
          : `Recomendación · ${block.title}`;
        y += noticeBox(doc, M, y, CW * 0.78, [block.body], heading) + 10;
      }
      if (block.kind === "figure" || block.kind === "map") {
        const format = block.imageDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
        const imageW = CW * 0.72;
        const imageH = 210;
        doc.addImage(block.imageDataUrl, format, M, y, imageW, imageH, undefined, "FAST");
        stroke(doc, GC_COLOR.hairline);
        doc.setLineWidth(0.7);
        doc.rect(M, y, imageW, imageH);
        y += imageH + 10;
        if (block.caption)
          y += paragraph(doc, M, y, block.caption, imageW, 7.6, GC_COLOR.slate) + 8;
      }
      if (block.kind === "bullets") y += bullets(doc, M, y, block.items, CW * 0.78, 9.5) + 8;
      if (block.kind === "kv") {
        y +=
          editorialTable(doc, {
            x: M,
            y,
            w: CW * 0.88,
            head: ["Concepto", "Detalle"],
            rows: block.items.map(([k, v]) => [k, v]),
            widths: [CW * 0.3, CW * 0.58],
            size: 8.2,
          }) + 14;
      }
      if (block.kind === "table") {
        y +=
          editorialTable(doc, {
            x: M,
            y,
            w: CW,
            head: block.head,
            rows: block.rows.slice(0, 8),
            widths: block.widths?.map((p) => CW * p),
            size: 8,
          }) + 14;
      }
    }
  }

  /* ---------- Ronda y uso de fondos ---------- */
  if (model.allocation) {
    newSlide("Estructura de la ronda", model.allocation.title);
    donutChart(doc, {
      cx: M + 150,
      cy: 300,
      r: 110,
      slices: model.allocation.slices,
      centerTop: model.allocation.centerTop,
      centerSub: model.allocation.centerSub,
    });
    const lx = M + 310;
    const lw = 280;
    const legendH = donutLegend(doc, lx, 200, lw, model.allocation.slices);
    if (model.allocation.caption)
      paragraph(doc, lx, 200 + legendH + 16, model.allocation.caption, lw, 8.4);
    if (model.milestones?.length) {
      const mx = lx + lw + 40;
      const mw = W - M - mx;
      eyebrow(doc, mx, 196, "Hitos");
      let my = 214;
      model.milestones.slice(0, 5).forEach((ms) => {
        font(doc, "body", "bold", 8);
        ink(doc, GC_COLOR.cobalt);
        doc.text(ms.when, mx, my);
        my += 11;
        my += paragraph(doc, mx, my, ms.what, mw, 8) + 10;
      });
    }
  }

  /* ---------- Cierre: advertencias y contacto ---------- */
  newSlide("Advertencias", "Base de información y limitaciones");
  const boxH = noticeBox(
    doc,
    M,
    146,
    CW * 0.62,
    model.disclaimers.slice(0, 6),
    "Limitaciones materiales",
  );
  const cx = M + CW * 0.62 + 30;
  eyebrow(doc, cx, 160, "Contacto");
  let cy = 180;
  font(doc, "body", "normal", 9);
  ink(doc, GC_COLOR.inkSoft);
  if (model.contact?.name) {
    doc.text(model.contact.name, cx, cy);
    cy += 14;
  }
  if (model.contact?.email) {
    doc.text(model.contact.email, cx, cy);
    cy += 14;
  }
  if (model.contact?.phone) {
    doc.text(model.contact.phone, cx, cy);
    cy += 14;
  }
  doc.text(`${GC_BRAND.email} · WhatsApp ${GC_BRAND.whatsapp}`, cx, cy + 6);
  qrBlock(doc, {
    x: cx,
    y: Math.max(cy + 30, 146 + boxH - 130),
    size: 104,
    qr,
    caption: "Live map y data room",
    sub: model.liveUrl.replace(/^https?:\/\//, ""),
  });
}
