/**
 * Estructura institucional común a TODOS los documentos Geocapitals
 * (memorándums, simulaciones, certificados, fichas y decks):
 * pleca tricolor, membrete, secciones numeradas, filas término/valor,
 * sello de verificación con QR y pie con folio. Una sola fuente.
 */
import type jsPDF from "jspdf";
import { GC_BRAND, GC_COLOR, type RGB } from "./tokens";
import { drawMark, fill, font, ink, stroke } from "./kit";

export const IM_NAVY: RGB = [13, 43, 62];
export const IM_GOLD: RGB = [185, 138, 47];
export const IM_RULE: RGB = [199, 208, 216];

export type Frame = { w: number; h: number; m: number };

export function rule(
  doc: jsPDF,
  f: Frame,
  y: number,
  c: RGB = IM_RULE,
  lw = 0.5,
  x1?: number,
  x2?: number,
) {
  stroke(doc, c);
  doc.setLineWidth(lw);
  doc.line(x1 ?? f.m, y, x2 ?? f.w - f.m, y);
}

/** Pleca tricolor milimétrica superior (navy · pizarra · oro). */
export function pleca(doc: jsPDF, w: number) {
  fill(doc, IM_NAVY);
  doc.rect(0, 0, w * 0.55, 3, "F");
  fill(doc, GC_COLOR.slate);
  doc.rect(w * 0.55, 0, w * 0.3, 3, "F");
  fill(doc, IM_GOLD);
  doc.rect(w * 0.85, 0, w * 0.15, 3, "F");
}

/** Membrete + pie con folio. Igual en toda la familia documental. */
export function letterhead(
  doc: jsPDF,
  f: Frame,
  o: {
    unit: string;
    ref: string;
    version: string;
    page: number;
    total: number;
    issued: string;
    deferFooter?: boolean;
    classification?: string;
  },
) {
  fill(doc, GC_COLOR.white);
  doc.rect(0, 0, f.w, f.h, "F");
  pleca(doc, f.w);
  const mw = drawMark(doc, f.m, 26, 18);
  font(doc, "body", "bold", 9);
  ink(doc, IM_NAVY);
  doc.text(GC_BRAND.name, f.m + mw + 7, 38);
  font(doc, "body", "normal", 7);
  ink(doc, GC_COLOR.slate);
  doc.text(o.unit, f.m + mw + 7, 47);
  doc.text(o.classification ?? "ESTRICTAMENTE PRIVADO Y CONFIDENCIAL", f.w - f.m, 38, {
    align: "right",
    charSpace: 0.4,
  });
  doc.text(`Ref. ${o.ref} · ${o.version}`, f.w - f.m, 47, { align: "right" });
  rule(doc, f, 58);
  if (!o.deferFooter) folio(doc, f, o);
}

/** Emit the institutional footer once pagination is final. */
export function folio(doc: jsPDF, f: Frame, o: { page: number; total: number; issued: string }) {
  rule(doc, f, f.h - 44);
  font(doc, "body", "normal", 6.6);
  ink(doc, GC_COLOR.slate);
  doc.text(`${GC_BRAND.name} · ${GC_BRAND.site} · ${GC_BRAND.email}`, f.m, f.h - 31);
  doc.text(`Emitido ${o.issued}`, f.w / 2, f.h - 31, { align: "center" });
  doc.text(`Página ${o.page} de ${o.total}`, f.w - f.m, f.h - 31, { align: "right" });
}

export function section(doc: jsPDF, f: Frame, y: number, num: string, label: string): number {
  font(doc, "body", "bold", 7.4);
  ink(doc, IM_GOLD);
  doc.text(num, f.m, y);
  const labelOffset = Math.max(22, doc.getTextWidth(num) + 10);
  ink(doc, IM_NAVY);
  doc.text(label.toUpperCase(), f.m + labelOffset, y, { charSpace: 0.6 });
  rule(doc, f, y + 5, IM_NAVY, 0.8);
  return y + 18;
}

export function kvRow(doc: jsPDF, f: Frame, y: number, k: string, v: string, labelW = 150): number {
  const cw = f.w - f.m * 2;
  font(doc, "body", "normal", 8.4);
  const lines = doc.splitTextToSize(v, cw - labelW - 8) as string[];
  font(doc, "body", "bold", 7.6);
  ink(doc, GC_COLOR.slate);
  doc.text(k, f.m, y);
  font(doc, "body", "normal", 8.4);
  ink(doc, GC_COLOR.ink);
  doc.text(lines, f.m + labelW, y);
  const h = Math.max(1, lines.length) * 11;
  rule(doc, f, y + h - 4);
  return y + h + 6;
}

/** Sello de verificación con QR pequeño. Devuelve el nuevo y. */
export function verificationSeal(
  doc: jsPDF,
  f: Frame,
  y: number,
  o: { qr: string; title: string; body: string; url: string; ref: string },
): number {
  const cw = f.w - f.m * 2;
  const boxH = 92;
  stroke(doc, IM_NAVY);
  doc.setLineWidth(0.6);
  doc.rect(f.m, y, cw, boxH);
  doc.addImage(o.qr, "PNG", f.m + 12, y + 12, 68, 68, undefined, "FAST");
  font(doc, "body", "bold", 8.4);
  ink(doc, IM_NAVY);
  doc.text(o.title, f.m + 96, y + 24);
  font(doc, "body", "normal", 7.8);
  ink(doc, GC_COLOR.inkSoft);
  doc.text((doc.splitTextToSize(o.body, cw - 110) as string[]).slice(0, 3), f.m + 96, y + 38);
  font(doc, "body", "normal", 7);
  ink(doc, GC_COLOR.slate);
  doc.text(`${o.url.replace(/^https?:\/\//, "")}  ·  Ref. ${o.ref}`, f.m + 96, y + 80);
  return y + boxH + 22;
}
