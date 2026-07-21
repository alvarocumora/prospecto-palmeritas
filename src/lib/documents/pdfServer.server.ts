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

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Paleta Institutional Modernist (mismos tokens que el renderer web).
const PAPER = rgb(0.969, 0.961, 0.941);
const INK = rgb(0.102, 0.102, 0.180);
const INK_SOFT = rgb(0.290, 0.290, 0.369);
const COBALT = rgb(0.169, 0.290, 0.796);
const HAIRLINE = rgb(0.851, 0.831, 0.780);
const CONF_BG = rgb(1.0, 0.965, 0.905);
const CONF_BORDER = rgb(0.910, 0.780, 0.396);

const PAGE_W = 595.28; // A4 puntos
const PAGE_H = 841.89;
const MARGIN_X = 56;
const MARGIN_TOP = 108;
const MARGIN_BOTTOM = 92;
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
};

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  cursorY: number;
  meta: { title: string; reference: string; pageNumber: number };
};

function fmtDate(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
}

function drawHeader(ctx: Ctx) {
  const { page, bold, font } = ctx;
  // Fondo papel completo.
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER });
  // Barra de marca cobalto.
  page.drawRectangle({ x: 0, y: PAGE_H - 46, width: PAGE_W, height: 46, color: COBALT });
  page.drawText("GEOCAPITALS", {
    x: MARGIN_X,
    y: PAGE_H - 30,
    size: 14,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Motor de transacciones internacionales · geocapitals.com", {
    x: MARGIN_X,
    y: PAGE_H - 42,
    size: 8,
    font,
    color: rgb(0.85, 0.88, 1),
  });
  // Referencia arriba a la derecha.
  const refTxt = `REF · ${ctx.meta.reference}`;
  const refW = font.widthOfTextAtSize(refTxt, 9);
  page.drawText(refTxt, {
    x: PAGE_W - MARGIN_X - refW,
    y: PAGE_H - 30,
    size: 9,
    font,
    color: rgb(1, 1, 1),
  });
  // Banda de confidencialidad.
  const cbY = PAGE_H - 82;
  page.drawRectangle({
    x: MARGIN_X,
    y: cbY,
    width: CONTENT_W,
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

async function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.meta.pageNumber += 1;
  ctx.cursorY = PAGE_H - MARGIN_TOP;
  drawHeader(ctx);
}

async function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.cursorY - needed < MARGIN_BOTTOM) await newPage(ctx);
}

function drawParagraph(ctx: Ctx, text: string, opts: { bold?: boolean; size?: number; gap?: number } = {}) {
  const size = opts.size ?? 10.5;
  const font = opts.bold ? ctx.bold : ctx.font;
  const lines = wrapText(text, font, size, CONTENT_W);
  const lineHeight = size * 1.45;
  for (const line of lines) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.HelveticaOblique),
  ]);

  const ctx: Ctx = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    font,
    bold,
    italic,
    cursorY: PAGE_H - MARGIN_TOP,
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
  const { error } = await admin.storage
    .from(bucket)
    .upload(opts.path, opts.bytes, {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "3600",
    });
  if (error && !/Duplicate|already exists/i.test(error.message)) throw error;
  const ttl = (opts.ttlDays ?? 30) * 24 * 60 * 60;
  const { data, error: sErr } = await admin.storage
    .from(bucket)
    .createSignedUrl(opts.path, ttl, {
      download: opts.path.split("/").pop(),
    });
  if (sErr) throw sErr;
  return data.signedUrl;
}
