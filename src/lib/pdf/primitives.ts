import type jsPDF from "jspdf";

/* ============================================================
   NI 43-101 PDF PRIMITIVES
   Layout: A4 portrait, helvetica, vector text only.
   ============================================================ */

export const PAGE = {
  width: 210,
  height: 297,
  margin: 18,
  contentTop: 28, // below header
  contentBottom: 280, // above footer
};

export const COLORS = {
  text: [30, 26, 22] as [number, number, number],
  muted: [110, 100, 92] as [number, number, number],
  hint: [150, 138, 128] as [number, number, number],
  gold: [13, 43, 62] as [number, number, number],
  goldDark: [13, 43, 62] as [number, number, number],
  rule: [200, 192, 184] as [number, number, number],
  paper: [255, 255, 255] as [number, number, number],
  panel: [245, 242, 236] as [number, number, number],
  accentBg: [236, 240, 250] as [number, number, number],
  warnBg: [253, 240, 215] as [number, number, number],
  warn: [184, 110, 20] as [number, number, number],
  warnDark: [120, 70, 10] as [number, number, number],
};

export type PdfState = {
  doc: jsPDF;
  cursorY: number;
  pageNum: number;
  // Counters
  sectionN: number;
  subN: number;
  figureN: number;
  tableN: number;
  // TOC entries: {label, level (1|2|0=front), page}
  toc: { label: string; level: 0 | 1 | 2; page: number; ref?: string }[];
  // Allow temporarily disabling chrome (cover page).
  chromeEnabled: boolean;
};

export function createState(doc: jsPDF): PdfState {
  return {
    doc,
    cursorY: PAGE.contentTop,
    pageNum: 1,
    sectionN: 0,
    subN: 0,
    figureN: 0,
    tableN: 0,
    toc: [],
    chromeEnabled: true,
  };
}

export function setRGB(doc: jsPDF, kind: "text" | "draw" | "fill", c: [number, number, number]) {
  if (kind === "text") doc.setTextColor(c[0], c[1], c[2]);
  if (kind === "draw") doc.setDrawColor(c[0], c[1], c[2]);
  if (kind === "fill") doc.setFillColor(c[0], c[1], c[2]);
}

export function drawHeader(s: PdfState) {
  if (!s.chromeEnabled) return;
  const { doc } = s;
  setRGB(doc, "text", COLORS.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("GEOCAPITALS", PAGE.margin, 12);
  setRGB(doc, "text", COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("· Informes de proyectos · Estrictamente confidencial", PAGE.margin + 24, 12);
  doc.setFontSize(7.5);
  doc.text("Informe Técnico NI 43-101", PAGE.width - PAGE.margin, 12, { align: "right" });
  setRGB(doc, "draw", COLORS.rule);
  doc.setLineWidth(0.3);
  doc.line(PAGE.margin, 15, PAGE.width - PAGE.margin, 15);
}

export function drawFooter(s: PdfState, totalPages?: number) {
  if (!s.chromeEnabled) return;
  const { doc } = s;
  setRGB(doc, "draw", COLORS.rule);
  doc.setLineWidth(0.3);
  doc.line(PAGE.margin, 285, PAGE.width - PAGE.margin, 285);
  setRGB(doc, "text", COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(
    "GEOCAPITALS · geocapitals.com · Preliminar, pendiente de revisión QP/CP",
    PAGE.margin,
    290,
  );
  const pageTxt = totalPages ? `Pág. ${s.pageNum} de ${totalPages}` : `Pág. ${s.pageNum}`;
  doc.text(pageTxt, PAGE.width - PAGE.margin, 290, { align: "right" });
  doc.text(new Date().toLocaleDateString("es-CL"), PAGE.width / 2, 290, { align: "center" });
}

/** Add a new page, redraw chrome, reset cursor. */
export function newPage(s: PdfState) {
  s.doc.addPage();
  s.pageNum += 1;
  s.cursorY = PAGE.contentTop;
  drawHeader(s);
  drawFooter(s);
}

/** Ensure at least `needed` mm of vertical space remain; otherwise new page. */
export function ensureSpace(s: PdfState, needed: number) {
  if (s.cursorY + needed > PAGE.contentBottom) newPage(s);
}

export function h1(s: PdfState, label: string) {
  s.sectionN += 1;
  s.subN = 0;
  ensureSpace(s, 18);
  // Page break before each H1 except first (cleaner like NI 43-101).
  if (s.cursorY > PAGE.contentTop + 5) {
    newPage(s);
  }
  const { doc } = s;
  setRGB(doc, "fill", COLORS.gold);
  doc.rect(PAGE.margin, s.cursorY - 4, 2, 8, "F");
  setRGB(doc, "text", COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${s.sectionN}. ${label.toUpperCase()}`, PAGE.margin + 5, s.cursorY + 2);
  s.cursorY += 7;
  setRGB(doc, "draw", COLORS.gold);
  doc.setLineWidth(0.6);
  doc.line(PAGE.margin, s.cursorY, PAGE.margin + 40, s.cursorY);
  s.cursorY += 6;
  s.toc.push({ label: `${s.sectionN}. ${label}`, level: 1, page: s.pageNum });
}

export function h2(s: PdfState, label: string) {
  s.subN += 1;
  ensureSpace(s, 12);
  const { doc } = s;
  setRGB(doc, "text", COLORS.goldDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${s.sectionN}.${s.subN}  ${label}`, PAGE.margin, s.cursorY);
  s.cursorY += 6;
  s.toc.push({ label: `${s.sectionN}.${s.subN}  ${label}`, level: 2, page: s.pageNum });
}

export function p(s: PdfState, text: string, opts: { size?: number; gap?: number } = {}) {
  const size = opts.size ?? 9.5;
  const gap = opts.gap ?? 3;
  const { doc } = s;
  setRGB(doc, "text", COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(text, PAGE.width - PAGE.margin * 2) as string[];
  const lineH = size * 0.42;
  for (const line of lines) {
    ensureSpace(s, lineH + 1);
    doc.text(line, PAGE.margin, s.cursorY);
    s.cursorY += lineH;
  }
  s.cursorY += gap;
}

export function bullet(s: PdfState, items: string[], opts: { size?: number } = {}) {
  const size = opts.size ?? 9.5;
  const { doc } = s;
  setRGB(doc, "text", COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  const lineH = size * 0.42;
  for (const item of items) {
    const lines = doc.splitTextToSize(item, PAGE.width - PAGE.margin * 2 - 5) as string[];
    ensureSpace(s, lineH * lines.length + 1);
    setRGB(doc, "text", COLORS.gold);
    doc.text("•", PAGE.margin + 1, s.cursorY);
    setRGB(doc, "text", COLORS.text);
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], PAGE.margin + 5, s.cursorY);
      s.cursorY += lineH;
    }
  }
  s.cursorY += 2;
}

export function calloutBox(s: PdfState, label: string, body: string) {
  const { doc } = s;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(body, PAGE.width - PAGE.margin * 2 - 8) as string[];
  const boxH = 6 + lines.length * 4 + 3;
  ensureSpace(s, boxH + 3);
  setRGB(doc, "fill", COLORS.accentBg);
  doc.rect(PAGE.margin, s.cursorY, PAGE.width - PAGE.margin * 2, boxH, "F");
  setRGB(doc, "fill", COLORS.gold);
  doc.rect(PAGE.margin, s.cursorY, 1.5, boxH, "F");
  setRGB(doc, "text", COLORS.goldDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(label.toUpperCase(), PAGE.margin + 4, s.cursorY + 5);
  setRGB(doc, "text", COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let y = s.cursorY + 9;
  for (const ln of lines) {
    doc.text(ln, PAGE.margin + 4, y);
    y += 4;
  }
  s.cursorY += boxH + 4;
}

/** Amber warning callout for missing/pending data. */
export function warningBox(s: PdfState, label: string, body: string) {
  const { doc } = s;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(body, PAGE.width - PAGE.margin * 2 - 8) as string[];
  const boxH = 6 + lines.length * 4 + 3;
  ensureSpace(s, boxH + 3);
  setRGB(doc, "fill", COLORS.warnBg);
  doc.rect(PAGE.margin, s.cursorY, PAGE.width - PAGE.margin * 2, boxH, "F");
  setRGB(doc, "fill", COLORS.warn);
  doc.rect(PAGE.margin, s.cursorY, 1.5, boxH, "F");
  setRGB(doc, "text", COLORS.warnDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`! ${label.toUpperCase()}`, PAGE.margin + 4, s.cursorY + 5);
  setRGB(doc, "text", COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let y = s.cursorY + 9;
  for (const ln of lines) {
    doc.text(ln, PAGE.margin + 4, y);
    y += 4;
  }
  s.cursorY += boxH + 4;
}

/** Insert image as Figure N with caption. Returns figure number. */
export function figure(
  s: PdfState,
  imgDataUrl: string,
  caption: string,
  opts: { width?: number; height?: number } = {},
): number {
  s.figureN += 1;
  const w = opts.width ?? PAGE.width - PAGE.margin * 2;
  const h = opts.height ?? w * 0.62;
  ensureSpace(s, h + 12);
  const { doc } = s;
  doc.addImage(imgDataUrl, "JPEG", PAGE.margin, s.cursorY, w, h, undefined, "FAST");
  s.cursorY += h + 2;
  setRGB(doc, "text", COLORS.muted);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  const lines = doc.splitTextToSize(`Figura ${s.figureN}. ${caption}`, w) as string[];
  for (const ln of lines) {
    doc.text(ln, PAGE.margin, s.cursorY + 3);
    s.cursorY += 3.5;
  }
  s.cursorY += 5;
  return s.figureN;
}

/** Increment & return next table number (used by sections before autoTable). */
export function nextTableN(s: PdfState): number {
  s.tableN += 1;
  return s.tableN;
}

export function tableCaption(s: PdfState, caption: string) {
  const n = nextTableN(s);
  ensureSpace(s, 8);
  setRGB(s.doc, "text", COLORS.goldDark);
  s.doc.setFont("helvetica", "bold");
  s.doc.setFontSize(8.5);
  s.doc.text(`Tabla ${n}. ${caption}`, PAGE.margin, s.cursorY);
  s.cursorY += 4;
}
