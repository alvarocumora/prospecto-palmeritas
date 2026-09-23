/**
 * Plantilla global B — One-Pager Factsheet (A4 vertical).
 * Una sola página pensada para envío por correo o WhatsApp: encabezado
 * de marca, seis métricas, tesis en tres líneas, figura de análisis,
 * QR grande y contacto directo.
 */
import type jsPDF from "jspdf";
import { GC_BRAND, GC_COLOR, GC_PAGE } from "../brand/tokens";
import {
  barChart,
  brandQr,
  bullets,
  drawMark,
  eyebrow,
  fill,
  font,
  ink,
  kpiGrid,
  paragraph,
  scatterMap,
  stroke,
  title,
} from "../brand/kit";
import type { ProjectDoc } from "../model";

const { w: W, h: H, m: M } = GC_PAGE.a4;
const CW = W - M * 2;

export async function renderOnePager(doc: jsPDF, model: ProjectDoc): Promise<void> {
  const qr = await brandQr(model.liveUrl, 420);
  const issued = new Date().toLocaleDateString("es-CL", { dateStyle: "long" });

  fill(doc, GC_COLOR.paper);
  doc.rect(0, 0, W, H, "F");

  // Banda superior en tinta
  fill(doc, GC_COLOR.ink);
  doc.rect(0, 0, W, 132, "F");
  fill(doc, GC_COLOR.cobalt);
  doc.rect(0, 132, W * 0.38, 5, "F");

  const markW = drawMark(doc, M, 26, 24);
  font(doc, "body", "bold", 10);
  ink(doc, GC_COLOR.paper);
  doc.text(GC_BRAND.name, M + markW + 8, 42);
  font(doc, "body", "normal", 7);
  ink(doc, GC_COLOR.cobaltSoft);
  doc.text(GC_BRAND.tagline, M + markW + 8, 52);
  font(doc, "body", "normal", 7);
  ink(doc, GC_COLOR.slate);
  doc.text(`${model.code} · ${model.docVersion} · ${issued}`, W - M, 42, { align: "right" });

  font(doc, "display", "bold", 27);
  ink(doc, GC_COLOR.paper);
  doc.text(doc.splitTextToSize(model.name, CW * 0.72)[0], M, 92);
  font(doc, "body", "normal", 8.6);
  ink(doc, GC_COLOR.cobaltSoft);
  const heroLine = `${model.subtitle} · ${model.location}`;
  const heroFit = doc.splitTextToSize(heroLine, CW * 0.72) as string[];
  doc.text(heroFit.length > 1 ? `${heroFit[0].replace(/[,\s·]+$/, "")}…` : heroFit[0], M, 110);


  let y = 164;
  eyebrow(doc, M, y, "Cifras clave");
  y += 14;
  y += kpiGrid(doc, { x: M, y, w: CW, items: model.kpis.slice(0, 6), cols: 3, rowH: 66, valueSize: 15 }) + 26;

  eyebrow(doc, M, y, "Tesis");
  y += 14;
  y += bullets(doc, M, y, model.thesis.slice(0, 3), CW, 8.6) + 16;

  // Figura: gráfico si existe, si no mini-mapa
  const figH = 168;
  if (model.chart) {
    eyebrow(doc, M, y, "Análisis");
    y += 12;
    barChart(doc, {
      x: M,
      y,
      w: CW * 0.6,
      h: figH,
      data: model.chart.data.slice(0, 8),
      labelA: model.chart.labelA,
      labelB: model.chart.labelB,
      unit: model.chart.unit,
    });
  } else if (model.map) {
    eyebrow(doc, M, y, "Ubicación");
    y += 12;
    scatterMap(doc, { x: M, y, w: CW * 0.6, h: figH, points: model.map.points, labelTop: 3 });
  } else {
    y += 12;
  }

  // Columna derecha: QR grande + contacto
  const rx = M + CW * 0.6 + 24;
  const rw = W - M - rx;
  fill(doc, GC_COLOR.white);
  stroke(doc, GC_COLOR.hairline);
  doc.setLineWidth(0.7);
  doc.rect(rx, y, rw, figH, "FD");
  doc.addImage(qr, "PNG", rx + (rw - 104) / 2, y + 14, 104, 104, undefined, "FAST");
  font(doc, "body", "bold", 8);
  ink(doc, GC_COLOR.ink);
  doc.text("VER LIVE MAP", rx + rw / 2, y + 134, { align: "center" });
  font(doc, "body", "normal", 6.6);
  ink(doc, GC_COLOR.slate);
  doc.text(doc.splitTextToSize(model.liveUrl.replace(/^https?:\/\//, ""), rw - 16)[0], rx + rw / 2, y + 146, {
    align: "center",
  });

  y += figH + 24;
  if (model.chart?.caption) {
    y += paragraph(doc, M, y, model.chart.caption, CW, 7.8, GC_COLOR.slate) + 10;
  }

  // Bloque de contacto
  fill(doc, GC_COLOR.paperDeep);
  doc.rect(M, y, CW, 56, "F");
  fill(doc, GC_COLOR.cobalt);
  doc.rect(M, y, 2.6, 56, "F");
  font(doc, "body", "bold", 7.6);
  ink(doc, GC_COLOR.cobalt);
  doc.text("CONTACTO", M + 14, y + 17);
  font(doc, "body", "normal", 8.4);
  ink(doc, GC_COLOR.inkSoft);
  const contactLine = [model.contact?.name, model.contact?.email, model.contact?.phone].filter(Boolean).join("  ·  ");
  doc.text(contactLine || `${GC_BRAND.email}`, M + 14, y + 33);
  doc.text(`${GC_BRAND.site}  ·  ${GC_BRAND.email}  ·  WhatsApp ${GC_BRAND.whatsapp}`, M + 14, y + 47);
  y += 70;

  // Advertencia condensada
  font(doc, "body", "normal", 6.8);
  ink(doc, GC_COLOR.slate);
  const legal = model.disclaimers[0] ?? "";
  doc.splitTextToSize(
    `Advertencia: ${legal} Documento de trabajo; no constituye oferta pública de valores.`,
    CW
  ).slice(0, 3).forEach((l: string, i: number) => doc.text(l, M, Math.min(y + i * 9, H - 52)));

  stroke(doc, GC_COLOR.hairline);
  doc.setLineWidth(0.6);
  doc.line(M, H - 40, W - M, H - 40);
  font(doc, "body", "normal", 6.8);
  ink(doc, GC_COLOR.slate);
  doc.text(`${GC_BRAND.name} · ${model.code} · ${model.docVersion}`, M, H - 27);
  doc.text(GC_BRAND.site, W - M, H - 27, { align: "right" });

  // Título invisible de accesibilidad / metadatos
  doc.setProperties?.({ title: `${model.name} — Factsheet ${model.docVersion}` });
  void title;
}
