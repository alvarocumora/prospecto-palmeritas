/**
 * Ficha editorial de proyecto A4.
 * Primera hoja: resumen listo para compartir. Si la tesis, las advertencias
 * o las notas técnicas exceden el espacio, se agregan hojas de notas completas.
 * Nunca se esconde el texto sobrante detrás del pie de página.
 */
import type jsPDF from "jspdf";
import { GC_BRAND, GC_COLOR, GC_PAGE } from "../brand/tokens";
import {
  barChart,
  brandQr,
  drawMark,
  eyebrow,
  fill,
  font,
  ink,
  scatterMap,
  stroke,
} from "../brand/kit";
import type { ProjectDoc } from "../model";

const { w: W, h: H, m: M } = GC_PAGE.a4;
const CW = W - M * 2;
const FOOTER_Y = H - 38;
const LAST_CONTENT_Y = H - 58;
type Note = { heading: string; text: string };

function oneLine(doc: jsPDF, text: string, width: number): string {
  const lines = doc.splitTextToSize(text, width) as string[];
  return lines.length > 1 ? lines[0].replace(/[\s,;]+$/, "") + "…" : (lines[0] ?? "");
}

function drawFooter(doc: jsPDF, page: number, total: number, model: ProjectDoc) {
  stroke(doc, GC_COLOR.hairline);
  doc.setLineWidth(0.7);
  doc.line(M, FOOTER_Y, W - M, FOOTER_Y);
  font(doc, "body", "normal", 7.5);
  ink(doc, GC_COLOR.slate);
  doc.text(GC_BRAND.name + " · " + model.code + " · " + model.docVersion, M, FOOTER_Y + 15);
  doc.text(GC_BRAND.site + "    " + page + " / " + total, W - M, FOOTER_Y + 15, {
    align: "right",
  });
}

function renderKpis(doc: jsPDF, model: ProjectDoc, notes: Note[]) {
  const cols = 3;
  const cellW = CW / cols;
  const rowH = 71;
  const top = 184;
  const items = model.kpis.slice(0, 6);
  items.forEach((item, index) => {
    const x = M + (index % cols) * cellW;
    const y = top + Math.floor(index / cols) * rowH;
    fill(doc, GC_COLOR.white);
    stroke(doc, GC_COLOR.hairline);
    doc.setLineWidth(0.5);
    doc.rect(x, y, cellW, rowH, "FD");
    const tx = x + 12;
    const textW = cellW - 24;
    font(doc, "body", "bold", 7.5);
    ink(doc, GC_COLOR.slate);
    const labels = (doc.splitTextToSize(item.label.toUpperCase(), textW) as string[]).slice(0, 2);
    labels.forEach((line, i) => doc.text(line, tx, y + 14 + i * 9));
    if ((doc.splitTextToSize(item.label.toUpperCase(), textW) as string[]).length > 2) {
      notes.push({ heading: "Indicador: " + item.label, text: item.label });
    }

    font(doc, "display", "bold", 15);
    let valueLines = doc.splitTextToSize(item.value, textW) as string[];
    if (valueLines.length > 1) {
      font(doc, "display", "bold", 11.5);
      valueLines = doc.splitTextToSize(item.value, textW) as string[];
    }
    valueLines.slice(0, 2).forEach((line, i) => doc.text(line, tx, y + 44 + i * 13));
    if (valueLines.length > 2) {
      notes.push({ heading: "Valor: " + item.label, text: item.value });
    }
    if (item.note) {
      if (valueLines.length === 1) {
        font(doc, "body", "normal", 7.5);
        ink(doc, GC_COLOR.slate);
        doc.text(oneLine(doc, item.note, textW), tx, y + 62);
      }
      if ((doc.splitTextToSize(item.note, textW) as string[]).length > 1 || valueLines.length > 1) {
        notes.push({ heading: "Nota: " + item.label, text: item.note });
      }
    }
  });
}

function renderThesis(doc: jsPDF, model: ProjectDoc, notes: Note[]) {
  font(doc, "body", "normal", 8.7);
  const bullets = model.thesis.slice(0, 3);
  const allLines = bullets.map((text) => doc.splitTextToSize(text, CW - 13) as string[]);
  const budget = 7;
  let used = 0;
  let y = 364;
  let overflow = false;
  for (const lines of allLines) {
    if (used + lines.length > budget) {
      overflow = true;
      break;
    }
    fill(doc, GC_COLOR.cobalt);
    doc.rect(M, y - 5, 3, 3, "F");
    font(doc, "body", "normal", 8.7);
    ink(doc, GC_COLOR.inkSoft);
    lines.forEach((line, j) => doc.text(line, M + 12, y + j * 11));
    used += lines.length;
    y += lines.length * 11 + 4;
  }
  if (overflow || model.thesis.length > 3) {
    notes.push({
      heading: "Tesis completa",
      text: model.thesis.map((item, i) => String(i + 1) + ". " + item).join("\n"),
    });
    font(doc, "body", "bold", 7.5);
    ink(doc, GC_COLOR.cobalt);
    doc.text("La tesis continúa en las notas del documento.", M, 452);
  }
}

function renderFigure(doc: jsPDF, model: ProjectDoc, notes: Note[]) {
  const x = M;
  const y = 480;
  const figW = 308;
  const figH = 136;
  const qrX = x + figW + 16;
  const qrW = CW - figW - 16;

  fill(doc, GC_COLOR.white);
  stroke(doc, GC_COLOR.hairline);
  doc.setLineWidth(0.7);
  doc.rect(x, y, figW, figH, "FD");
  if (model.map?.imageDataUrl) {
    const mime = model.map.imageDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(model.map.imageDataUrl, mime, x, y, figW, figH, undefined, "FAST");
    stroke(doc, GC_COLOR.hairline);
    doc.rect(x, y, figW, figH);
  } else if (model.chart?.data.length) {
    barChart(doc, {
      x: x + 4,
      y: y + 3,
      w: figW - 10,
      h: figH - 7,
      data: model.chart.data.slice(0, 8),
      labelA: model.chart.labelA,
      labelB: model.chart.labelB,
      unit: model.chart.unit,
    });
  } else if (model.map?.points.length) {
    scatterMap(doc, {
      x,
      y,
      w: figW,
      h: figH,
      points: model.map.points,
      polygons: model.map.polygons,
      labelTop: 3,
    });
  } else {
    font(doc, "body", "normal", 9);
    ink(doc, GC_COLOR.slate);
    doc.text("Visualización no disponible en esta ficha.", x + 14, y + figH / 2);
  }
  fill(doc, GC_COLOR.white);
  stroke(doc, GC_COLOR.hairline);
  doc.rect(qrX, y, qrW, figH, "FD");
  return { qrX, qrW, figY: y, figH, figW, notes };
}

function renderExtraPages(doc: jsPDF, notes: Note[]) {
  if (!notes.length) return;
  const startPage = () => {
    doc.addPage();
    fill(doc, GC_COLOR.paper);
    doc.rect(0, 0, W, H, "F");
    fill(doc, GC_COLOR.ink);
    doc.rect(0, 0, W, 82, "F");
    font(doc, "body", "bold", 15);
    ink(doc, GC_COLOR.white);
    doc.text("NOTAS, FUENTES Y ADVERTENCIAS", M, 50);
    return 112;
  };
  let y = startPage();
  for (const note of notes) {
    if (y > LAST_CONTENT_Y - 45) y = startPage();
    font(doc, "body", "bold", 9.5);
    ink(doc, GC_COLOR.cobalt);
    doc.text(note.heading.toUpperCase(), M, y);
    y += 17;
    font(doc, "body", "normal", 8.8);
    ink(doc, GC_COLOR.inkSoft);
    const lines = doc.splitTextToSize(note.text, CW) as string[];
    for (const line of lines) {
      if (y > LAST_CONTENT_Y - 11) y = startPage();
      font(doc, "body", "normal", 8.8);
      ink(doc, GC_COLOR.inkSoft);
      doc.text(line, M, y);
      y += 12;
    }
    y += 22;
  }
}

export async function renderOnePager(doc: jsPDF, model: ProjectDoc): Promise<void> {
  const notes: Note[] = [];
  const qr = await brandQr(model.liveUrl, 420);
  const issued = new Date().toLocaleDateString("es-CL", { dateStyle: "medium" });
  fill(doc, GC_COLOR.paper);
  doc.rect(0, 0, W, H, "F");

  // Portada de marca: texto nítido y jerarquía editorial.
  fill(doc, GC_COLOR.ink);
  doc.rect(0, 0, W, 151, "F");
  fill(doc, GC_COLOR.cobalt);
  doc.rect(0, 151, W * 0.35, 4, "F");
  const markW = drawMark(doc, M, 24, 24);
  font(doc, "body", "bold", 10);
  ink(doc, GC_COLOR.paper);
  doc.text(GC_BRAND.name, M + markW + 8, 39);
  font(doc, "body", "normal", 7.5);
  ink(doc, GC_COLOR.cobaltSoft);
  doc.text(GC_BRAND.tagline, M + markW + 8, 51);
  font(doc, "body", "normal", 7.5);
  ink(doc, GC_COLOR.cobaltSoft);
  doc.text(oneLine(doc, model.code + " · " + model.docVersion + " · " + issued, 190), W - M, 40, {
    align: "right",
  });
  font(doc, "display", "bold", 24);
  ink(doc, GC_COLOR.paper);
  const nameLines = doc.splitTextToSize(model.name, CW - 22) as string[];
  nameLines.slice(0, 2).forEach((line, i) => doc.text(line, M, 93 + i * 25));
  if (nameLines.length > 2) notes.push({ heading: "Nombre completo del proyecto", text: model.name });
  font(doc, "body", "normal", 8.5);
  ink(doc, GC_COLOR.cobaltSoft);
  doc.text(
    oneLine(doc, model.subtitle + " · " + model.location, CW),
    M,
    nameLines.length > 1 ? 143 : 126,
  );

  eyebrow(doc, M, 172, "Cifras clave · antecedentes declarados o referenciales");
  renderKpis(doc, model, notes);
  eyebrow(doc, M, 350, "Tesis de inversión");
  renderThesis(doc, model, notes);
  eyebrow(doc, M, 469, model.map ? "Ubicación y evidencia cartográfica" : "Análisis del proyecto");
  const fig = renderFigure(doc, model, notes);

  const qrSize = 92;
  doc.addImage(
    qr,
    "PNG",
    fig.qrX + (fig.qrW - qrSize) / 2,
    fig.figY + 8,
    qrSize,
    qrSize,
    undefined,
    "FAST",
  );
  font(doc, "body", "bold", 8);
  ink(doc, GC_COLOR.ink);
  doc.text("ABRIR FICHA Y MAPA", fig.qrX + fig.qrW / 2, fig.figY + 110, {
    align: "center",
  });
  font(doc, "body", "normal", 7.5);
  ink(doc, GC_COLOR.slate);
  const cleanUrl = model.liveUrl.replace(/^https?:\/\//, "");
  doc.text(oneLine(doc, cleanUrl, fig.qrW - 12), fig.qrX + fig.qrW / 2, fig.figY + 125, { align: "center" });

  const source =
    [model.map?.source, model.map?.imagery, model.map?.crs].filter(Boolean).join(" · ") ||
    "Fuente y metodología en informe técnico";
  font(doc, "body", "normal", 7.5);
  ink(doc, GC_COLOR.slate);
  doc.text(oneLine(doc, "Fuente: " + source, CW), M, 629);
  if ((doc.splitTextToSize(source, CW - 36) as string[]).length > 1) {
    notes.push({ heading: "Fuente cartográfica", text: source });
  }
  if (model.map?.caption) notes.push({ heading: "Nota cartográfica", text: model.map.caption });
  if (model.chart?.caption) notes.push({ heading: "Nota de análisis", text: model.chart.caption });

  fill(doc, GC_COLOR.paperDeep);
  doc.rect(M, 645, CW, 60, "F");
  fill(doc, GC_COLOR.cobalt);
  doc.rect(M, 645, 3, 60, "F");
  font(doc, "body", "bold", 8);
  ink(doc, GC_COLOR.cobalt);
  doc.text("CONTACTO Y SIGUIENTE PASO", M + 15, 664);
  font(doc, "body", "normal", 8.5);
  ink(doc, GC_COLOR.ink);
  const direct = [model.contact?.name, model.contact?.email, model.contact?.phone]
    .filter(Boolean)
    .join(" · ");
  doc.text(oneLine(doc, direct || GC_BRAND.email, CW - 30), M + 15, 679);
  font(doc, "body", "normal", 8);
  ink(doc, GC_COLOR.inkSoft);
  doc.text(oneLine(doc, GC_BRAND.site + " · " + GC_BRAND.email, CW - 30), M + 15, 695);
  if ((doc.splitTextToSize(direct, CW - 30) as string[]).length > 1) {
    notes.push({ heading: "Datos de contacto", text: direct });
  }

  eyebrow(doc, M, 725, "Riesgos y alcance");
  font(doc, "body", "normal", 7.7);
  ink(doc, GC_COLOR.inkSoft);
  const legalText = [
    ...model.disclaimers.filter(Boolean),
    "Documento comercial: no constituye oferta pública de valores. La inversión minera es ilíquida y puede causar pérdida total de capital.",
  ].join(" ");
  const legalLines = doc.splitTextToSize(legalText, CW) as string[];
  const legalMax = 6;
  const shown = legalLines.slice(0, legalLines.length > legalMax ? legalMax - 1 : legalMax);
  shown.forEach((line, i) => doc.text(line, M, 739 + i * 10));
  if (legalLines.length > legalMax) {
    font(doc, "body", "bold", 7.7);
    ink(doc, GC_COLOR.cobalt);
    doc.text("Advertencias completas en las notas siguientes.", M, 739 + shown.length * 10);
    notes.push({ heading: "Advertencias completas", text: legalText });
  }

  renderExtraPages(doc, notes);
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    drawFooter(doc, page, total, model);
  }
  doc.setPage(1);
  doc.setProperties?.({ title: model.name + " — Factsheet " + model.docVersion });
}
