// Generador de PDFs server-side (Worker-safe) con marca Geocapitals.
// Usa pdf-lib (JS puro, corre en Cloudflare Workers). Emite el documento con:
//  · Cabecera de marca (cobalto sobre papel hueso)
//  · Banda de confidencialidad
//  · Cuerpo justificado con wrapping automático
//  · Bloque de firma "Emitido por Geocapitals" (fecha ISO)
//  · Footer con referencia + página + contacto
//
// No reemplaza al renderer client-side (documents/pdf.ts, QR, watermark);
// es la copia oficial que se adjunta al mail como PDF real cuando la
// infraestructura de emails no soporta attachments binarios.

import {
  degrees,
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { GEOCAPITALS_MARK_PNG_BASE64, GEOCAPITALS_MARK_RATIO } from "./brandAssets";
import { verifyDocUrl } from "@/lib/publicUrl";

// Paleta Institutional Modernist (mismos tokens que el renderer web).
const PAPER = rgb(0.969, 0.961, 0.941);
const INK = rgb(0.102, 0.102, 0.18);
const INK_SOFT = rgb(0.29, 0.29, 0.369);
const COBALT = rgb(0.169, 0.29, 0.796);
const HAIRLINE = rgb(0.851, 0.831, 0.78);
const CONF_BG = rgb(1.0, 0.965, 0.905);
const CONF_BORDER = rgb(0.91, 0.78, 0.396);
const GOLD = rgb(0.792, 0.643, 0.235);

const PAGE_W = 595.28; // A4 puntos
const PAGE_H = 841.89;
const MARGIN_X = 54;
const FIRST_CONTENT_Y = PAGE_H - 156;
const NEXT_CONTENT_Y = PAGE_H - 74;
const MARGIN_BOTTOM = 86;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const CONFIDENTIAL_NOTE =
  "CONFIDENCIAL — Este documento y sus anexos son propiedad de Geocapitals y de las partes " +
  "identificadas. Contiene información sensible cubierta por acuerdo de confidencialidad. " +
  "Prohibida su reproducción, distribución o divulgación a terceros sin autorización escrita.";

export type ServerPdfInput = {
  title: string;
  reference: string;
  subtitle?: string;
  /** Bloques de texto — cada string es un párrafo. Soporta separadores "---". */
  body: string[];
  parties?: Array<{ role: string; name: string; email?: string; company?: string }>;
  emitter?: { name: string; role?: string; email?: string; signedAtISO?: string };
  /** Fecha de emisión visible (ISO YYYY-MM-DD). */
  issuedAtISO?: string;
  /** URL de validación pública para el QR. Por defecto verifyDocUrl(reference). */
  verifyUrl?: string;
};

/** Matriz de módulos del QR (bits 0/1), Worker-safe (qrcode.create, sin canvas). */
type QrMatrix = { size: number; bits: (0 | 1)[] } | null;

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  mark: PDFImage | null;
  qr: QrMatrix;
  cursorY: number;
  meta: { title: string; reference: string; pageNumber: number };
};

function shorten(text: string, max = 34) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function fmtDate(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
}

// Genera la matriz de módulos del QR sin canvas (Worker-safe). Devuelve null si
// el módulo no está disponible, para que el PDF se emita igual sin QR.
async function buildQrMatrix(url: string): Promise<QrMatrix> {
  try {
    const QR = await import("qrcode");
    const qr = QR.create(url, { errorCorrectionLevel: "M" });
    const size = qr.modules.size;
    const src = qr.modules.data as unknown as ArrayLike<number>;
    const bits: (0 | 1)[] = [];
    for (let i = 0; i < size * size; i++) bits.push(src[i] ? 1 : 0);
    return { size, bits };
  } catch {
    return null;
  }
}

// Dibuja el QR como cuadrados vectoriales (pdf-lib), sin imagen rasterizada.
function drawQrMatrix(
  page: PDFPage,
  qr: NonNullable<QrMatrix>,
  x: number,
  y: number,
  side: number,
) {
  const cell = side / qr.size;
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (!qr.bits[r * qr.size + c]) continue;
      page.drawRectangle({
        x: x + c * cell,
        // fila 0 arriba: y es el borde superior de la caja.
        y: y - (r + 1) * cell,
        width: cell + 0.3, // solape mínimo para evitar hairlines entre módulos
        height: cell + 0.3,
        color: INK,
      });
    }
  }
}

function drawPageFoundation(ctx: Ctx) {
  const { page, bold } = ctx;
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER });

  // Marco institucional: hoja de papel, filo tinta y acento cobalto.
  page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: INK });
  page.drawRectangle({ x: 0, y: PAGE_H - 8, width: PAGE_W * 0.26, height: 2, color: COBALT });
  page.drawRectangle({
    x: 30,
    y: 34,
    width: PAGE_W - 60,
    height: PAGE_H - 76,
    borderColor: HAIRLINE,
    borderWidth: 0.7,
  });
  page.drawRectangle({ x: 30, y: PAGE_H - 88, width: 2, height: 42, color: COBALT });

  const watermark = "GEOCAPITALS";
  const wmSize = 64;
  const wmW = bold.widthOfTextAtSize(watermark, wmSize);
  page.drawText(watermark, {
    x: PAGE_W / 2 - wmW / 2 + 18,
    y: PAGE_H / 2 - 18,
    size: wmSize,
    font: bold,
    color: COBALT,
    opacity: 0.035,
    rotate: degrees(32),
  });
}

function drawHeader(ctx: Ctx) {
  const { page, bold, font, mark, qr } = ctx;
  drawPageFoundation(ctx);

  if (ctx.meta.pageNumber > 1) {
    let compactBrandX = MARGIN_X;
    if (mark) {
      const markH = 18;
      const markW = markH * GEOCAPITALS_MARK_RATIO;
      page.drawImage(mark, { x: MARGIN_X, y: PAGE_H - 38, width: markW, height: markH });
      compactBrandX = MARGIN_X + markW + 8;
    }
    page.drawText("GEOCAPITALS", {
      x: compactBrandX,
      y: PAGE_H - 32,
      size: 8,
      font: bold,
      color: INK,
    });
    const refTxt = `REF · ${shorten(ctx.meta.reference, 44)}`;
    const miniQrSide = qr ? 24 : 0;
    const refRight = PAGE_W - MARGIN_X - (qr ? miniQrSide + 10 : 0);
    const refW = font.widthOfTextAtSize(refTxt, 8);
    page.drawText(refTxt, {
      x: refRight - refW,
      y: PAGE_H - 32,
      size: 8,
      font,
      color: INK_SOFT,
    });
    if (qr) {
      const qrX = PAGE_W - MARGIN_X - miniQrSide;
      const qrTop = PAGE_H - 20;
      page.drawRectangle({
        x: qrX - 3,
        y: qrTop - miniQrSide - 3,
        width: miniQrSide + 6,
        height: miniQrSide + 6,
        color: rgb(1, 1, 1),
        borderColor: HAIRLINE,
        borderWidth: 0.45,
      });
      drawQrMatrix(page, qr, qrX, qrTop, miniQrSide);
    }
    page.drawLine({
      start: { x: MARGIN_X, y: PAGE_H - 46 },
      end: { x: PAGE_W - MARGIN_X, y: PAGE_H - 46 },
      thickness: 0.5,
      color: HAIRLINE,
    });
    return;
  }

  // Cabecera principal: marca sobre papel, no bloque sólido; igual a la matriz institucional.
  let brandX = MARGIN_X;
  if (mark) {
    const markH = 36;
    const markW = markH * GEOCAPITALS_MARK_RATIO;
    page.drawImage(mark, { x: MARGIN_X, y: PAGE_H - 58, width: markW, height: markH });
    brandX = MARGIN_X + markW + 14;
  }
  page.drawText("GEOCAPITALS", {
    x: brandX,
    y: PAGE_H - 35,
    size: 14,
    font: bold,
    color: INK,
  });
  page.drawText("MINING INTELLIGENCE · DEALS · DOCUMENTATION", {
    x: brandX,
    y: PAGE_H - 49,
    size: 7.5,
    font,
    color: COBALT,
  });
  page.drawText("geocapitals.com · info@geocapitals.com", {
    x: brandX,
    y: PAGE_H - 61,
    size: 7,
    font,
    color: INK_SOFT,
  });

  const refTxt = `REF · ${ctx.meta.reference}`;
  const refW = font.widthOfTextAtSize(refTxt, 8);
  page.drawText(refTxt, {
    x: PAGE_W - MARGIN_X - refW,
    y: PAGE_H - 34,
    size: 8,
    font,
    color: INK_SOFT,
  });

  // Caja del QR de validación pública.
  const qrSide = 58;
  const qrBoxW = qrSide + 12;
  const qrBoxH = qrSide + 34;
  const qrBoxX = PAGE_W - MARGIN_X - qrBoxW;
  const qrBoxTop = PAGE_H - 68;
  if (qr) {
    page.drawRectangle({
      x: qrBoxX,
      y: qrBoxTop - qrBoxH,
      width: qrBoxW,
      height: qrBoxH,
      color: rgb(1, 1, 1),
      borderColor: HAIRLINE,
      borderWidth: 0.75,
    });
    drawQrMatrix(page, qr, qrBoxX + 6, qrBoxTop - 6, qrSide);
    const cx = qrBoxX + qrBoxW / 2;
    const topLegend = "VALIDAR EN";
    const bottomLegend = "GEOCAPITALS";
    page.drawText(topLegend, {
      x: cx - bold.widthOfTextAtSize(topLegend, 5.6) / 2,
      y: qrBoxTop - qrBoxH + 20,
      size: 5.6,
      font: bold,
      color: COBALT,
    });
    page.drawText(bottomLegend, {
      x: cx - bold.widthOfTextAtSize(bottomLegend, 5.6) / 2,
      y: qrBoxTop - qrBoxH + 12,
      size: 5.6,
      font: bold,
      color: COBALT,
    });
    const miniRef = shorten(ctx.meta.reference, 24);
    page.drawText(miniRef, {
      x: cx - font.widthOfTextAtSize(miniRef, 4.9) / 2,
      y: qrBoxTop - qrBoxH + 5,
      size: 4.9,
      font,
      color: INK_SOFT,
    });
  }

  // Banda de confidencialidad (angosta, deja el hueco del QR a la derecha).
  const cbY = PAGE_H - 112;
  const bandW = qr ? CONTENT_W - qrBoxW - 12 : CONTENT_W;
  page.drawRectangle({
    x: MARGIN_X,
    y: cbY,
    width: bandW,
    height: 26,
    color: CONF_BG,
    borderColor: CONF_BORDER,
    borderWidth: 0.75,
  });
  page.drawText("CONFIDENCIAL · Distribución restringida", {
    x: MARGIN_X + 10,
    y: cbY + 10,
    size: 9,
    font: bold,
    color: rgb(0.6, 0.42, 0.05),
  });
  // Sello dorado bajo la banda (acento de marca).
  page.drawRectangle({ x: MARGIN_X, y: cbY - 4, width: bandW, height: 1.5, color: GOLD });
}

function drawFooter(ctx: Ctx, totalPages: number) {
  const { page, font } = ctx;
  const y = 44;
  page.drawLine({
    start: { x: MARGIN_X, y: y + 22 },
    end: { x: PAGE_W - MARGIN_X, y: y + 22 },
    thickness: 0.5,
    color: HAIRLINE,
  });
  page.drawText("info@geocapitals.com · WhatsApp +56 9 6218 4071 · geocapitals.com", {
    x: MARGIN_X,
    y: y + 10,
    size: 8,
    font,
    color: INK_SOFT,
  });
  const pt = `Página ${ctx.meta.pageNumber} de ${totalPages}`;
  const w = font.widthOfTextAtSize(pt, 8);
  page.drawText(pt, {
    x: PAGE_W - MARGIN_X - w,
    y: y + 10,
    size: 8,
    font,
    color: INK_SOFT,
  });
  // Nota de confidencialidad al pie (dos líneas).
  const note = CONFIDENTIAL_NOTE;
  const lines = wrapText(note, font, 7.5, CONTENT_W);
  let ly = y - 4;
  for (const ln of lines.slice(0, 3)) {
    page.drawText(ln, { x: MARGIN_X, y: ly, size: 7.5, font, color: INK_SOFT });
    ly -= 9;
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = text.split(/\n/);
  const out: string[] = [];
  for (const p of paragraphs) {
    if (!p.trim()) {
      out.push("");
      continue;
    }
    const words = p.split(/\s+/);
    let line = "";
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      const width = font.widthOfTextAtSize(candidate, size);
      if (width > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.meta.pageNumber += 1;
  ctx.cursorY = NEXT_CONTENT_Y;
  drawHeader(ctx);
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.cursorY - needed < MARGIN_BOTTOM) newPage(ctx);
}

function drawParagraph(
  ctx: Ctx,
  text: string,
  opts: { bold?: boolean; size?: number; gap?: number } = {},
) {
  const size = opts.size ?? 10.5;
  const font = opts.bold ? ctx.bold : ctx.font;
  const lines = wrapText(text, font, size, CONTENT_W);
  const lineHeight = size * 1.45;
  for (const line of lines) {
    ensureSpace(ctx, lineHeight);
    ctx.page.drawText(line, {
      x: MARGIN_X,
      y: ctx.cursorY,
      size,
      font,
      color: INK,
    });
    ctx.cursorY -= lineHeight;
  }
  ctx.cursorY -= opts.gap ?? 6;
}

function drawH1(ctx: Ctx, text: string) {
  drawParagraph(ctx, text, { bold: true, size: 16, gap: 4 });
  // Regla cobalto bajo el título.
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.cursorY + 4 },
    end: { x: MARGIN_X + 60, y: ctx.cursorY + 4 },
    thickness: 1.5,
    color: COBALT,
  });
  ctx.cursorY -= 12;
}

function drawH2(ctx: Ctx, text: string) {
  ctx.cursorY -= 4;
  drawParagraph(ctx, text.toUpperCase(), { bold: true, size: 10, gap: 4 });
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.cursorY + 4 },
    end: { x: PAGE_W - MARGIN_X, y: ctx.cursorY + 4 },
    thickness: 0.5,
    color: HAIRLINE,
  });
  ctx.cursorY -= 8;
}

function drawKV(ctx: Ctx, rows: Array<[string, string | undefined]>) {
  const size = 10;
  const labelW = 160;
  for (const [k, v] of rows) {
    if (!v) continue;
    ensureSpace(ctx, 18);
    ctx.page.drawText(k, { x: MARGIN_X, y: ctx.cursorY, size, font: ctx.bold, color: INK_SOFT });
    const wrapped = wrapText(v, ctx.font, size, CONTENT_W - labelW);
    let y = ctx.cursorY;
    for (const line of wrapped) {
      ctx.page.drawText(line, {
        x: MARGIN_X + labelW,
        y,
        size,
        font: ctx.font,
        color: INK,
      });
      y -= size * 1.35;
    }
    ctx.cursorY = y - 2;
  }
  ctx.cursorY -= 4;
}

function drawSignatureBlock(ctx: Ctx, emitter: NonNullable<ServerPdfInput["emitter"]>) {
  ensureSpace(ctx, 120);
  ctx.cursorY -= 20;
  const boxY = ctx.cursorY - 90;
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: boxY,
    width: CONTENT_W,
    height: 96,
    color: rgb(1, 1, 1),
    borderColor: COBALT,
    borderWidth: 0.75,
  });
  // Sello cobalto.
  ctx.page.drawRectangle({ x: MARGIN_X, y: boxY + 96 - 20, width: 170, height: 20, color: COBALT });
  ctx.page.drawText("EMITIDO POR GEOCAPITALS", {
    x: MARGIN_X + 10,
    y: boxY + 96 - 14,
    size: 9,
    font: ctx.bold,
    color: rgb(1, 1, 1),
  });
  const dateStr = fmtDate(emitter.signedAtISO);
  ctx.page.drawText(emitter.name, {
    x: MARGIN_X + 14,
    y: boxY + 52,
    size: 12,
    font: ctx.bold,
    color: INK,
  });
  if (emitter.role) {
    ctx.page.drawText(emitter.role, {
      x: MARGIN_X + 14,
      y: boxY + 38,
      size: 9,
      font: ctx.italic,
      color: INK_SOFT,
    });
  }
  if (emitter.email) {
    ctx.page.drawText(emitter.email, {
      x: MARGIN_X + 14,
      y: boxY + 22,
      size: 9,
      font: ctx.font,
      color: INK_SOFT,
    });
  }
  ctx.page.drawText(`Firmado electrónicamente · ${dateStr}`, {
    x: MARGIN_X + 14,
    y: boxY + 8,
    size: 8,
    font: ctx.font,
    color: INK_SOFT,
  });
  ctx.cursorY = boxY - 12;
}

export async function renderServerPdf(input: ServerPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(input.title);
  doc.setAuthor("Geocapitals");
  doc.setSubject(input.reference);
  doc.setProducer("Geocapitals · Motor de transacciones");
  doc.setCreator("Geocapitals PDF Server");

  const [font, bold, italic] = await Promise.all([
    doc.embedFont(StandardFonts.TimesRoman),
    doc.embedFont(StandardFonts.TimesRomanBold),
    doc.embedFont(StandardFonts.TimesRomanItalic),
  ]);

  // Marca dorada (embedPng acepta base64 directo) y QR de validación pública.
  // Ambos son opcionales: si algo falla, el PDF se emite igual.
  let mark: PDFImage | null = null;
  try {
    mark = await doc.embedPng(GEOCAPITALS_MARK_PNG_BASE64);
  } catch {
    mark = null;
  }
  const qr = await buildQrMatrix(input.verifyUrl ?? verifyDocUrl(input.reference));

  const ctx: Ctx = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    font,
    bold,
    italic,
    mark,
    qr,
    cursorY: FIRST_CONTENT_Y,
    meta: { title: input.title, reference: input.reference, pageNumber: 1 },
  };
  drawHeader(ctx);

  drawH1(ctx, input.title);
  if (input.subtitle) drawParagraph(ctx, input.subtitle, { size: 10, gap: 8 });

  drawKV(ctx, [
    ["Referencia", input.reference],
    ["Fecha de emisión", fmtDate(input.issuedAtISO)],
    ["Emisor", "Geocapitals — intermediario y gestor operacional"],
  ]);

  if (input.parties && input.parties.length > 0) {
    drawH2(ctx, "Partes");
    for (const p of input.parties) {
      const line = `${p.role}: ${p.name}${p.company ? ` (${p.company})` : ""}${p.email ? ` — ${p.email}` : ""}`;
      drawParagraph(ctx, line, { size: 10, gap: 3 });
    }
  }

  drawH2(ctx, "Contenido");
  for (const block of input.body) {
    if (block === "---") {
      ctx.page.drawLine({
        start: { x: MARGIN_X, y: ctx.cursorY + 2 },
        end: { x: PAGE_W - MARGIN_X, y: ctx.cursorY + 2 },
        thickness: 0.5,
        color: HAIRLINE,
      });
      ctx.cursorY -= 10;
      continue;
    }
    drawParagraph(ctx, block, { size: 10.5, gap: 6 });
  }

  if (input.emitter) drawSignatureBlock(ctx, input.emitter);

  // Footers en todas las páginas con el total correcto.
  const total = doc.getPageCount();
  for (let i = 0; i < total; i++) {
    const p = doc.getPage(i);
    const tempCtx: Ctx = { ...ctx, page: p, meta: { ...ctx.meta, pageNumber: i + 1 } };
    drawFooter(tempCtx, total);
  }

  return await doc.save();
}

/** Sube el PDF al bucket privado y devuelve una signed URL válida por N días. */
export async function uploadPdfSigned(opts: {
  bytes: Uint8Array;
  path: string;
  ttlDays?: number;
}): Promise<string> {
  const { createClient } = await import("@supabase/supabase-js");
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !key) throw new Error("Missing Supabase server env vars");
  const admin = createClient(url, key);
  const bucket = "email-attachments";
  const { error } = await admin.storage.from(bucket).upload(opts.path, opts.bytes, {
    contentType: "application/pdf",
    upsert: true,
    cacheControl: "3600",
  });
  if (error && !/Duplicate|already exists/i.test(error.message)) throw error;
  const ttl = (opts.ttlDays ?? 30) * 24 * 60 * 60;
  const { data, error: sErr } = await admin.storage.from(bucket).createSignedUrl(opts.path, ttl, {
    download: opts.path.split("/").pop(),
  });
  if (sErr) throw sErr;
  return data.signedUrl;
}
