/**
 * Research A4 renderer. Vector text only; images are evidence (with source,
 * CRS and dates) never decoration. Layout reports overflow instead of
 * silently clipping, so tests can fail on it.
 */
import type jsPDF from "jspdf";
import { drawMark, fill, font, ink, monoFont, stroke } from "../brand/kit";
import { GC_BRAND, type RGB } from "../brand/tokens";
import {
  CONFLICT_LABEL,
  RS_COLOR as C,
  RS_TYPE,
  publicExportBlocked,
  type ResearchDoc,
  type ResearchParam,
} from "./model";

const W = 595.28;
const H = 841.89;
const M = 56;
const CW = W - M * 2;
const TOP = 92;
const BOTTOM = H - 64;

export type RenderReport = { pages: number; overflow: string[] };

type Ctx = { doc: jsPDF; d: ResearchDoc; overflow: string[]; refs: Map<string, number>; pageRefs: Set<string>; bottom: number };

function color(doc: jsPDF, c: RGB) {
  ink(doc, c);
}
function hair(doc: jsPDF, y: number, x1 = M, x2 = W - M, c: RGB = C.hairline, lw = 0.5) {
  stroke(doc, c);
  doc.setLineWidth(lw);
  doc.line(x1, y, x2, y);
}

function refNo(ctx: Ctx, id: string) {
  if (!ctx.refs.has(id)) ctx.refs.set(id, ctx.d.sources.findIndex((s) => s.id === id) + 1);
  ctx.pageRefs.add(id);
  return ctx.refs.get(id)!;
}

/** Wrapped text; returns height. Registers overflow beyond maxH. */
function text(ctx: Ctx, s: string, x: number, y: number, w: number, o: { size?: number; family?: "body" | "display" | "mono"; style?: "normal" | "bold" | "italic"; c?: RGB; lh?: number; maxH?: number; label?: string } = {}) {
  const size = o.size ?? RS_TYPE.body;
  if (o.family === "mono") monoFont(ctx.doc, o.style === "bold" ? "bold" : "normal", size);
  else font(ctx.doc, o.family ?? "body", o.style ?? "normal", size);
  color(ctx.doc, o.c ?? C.ink);
  const lines = ctx.doc.splitTextToSize(s, w) as string[];
  const lh = size * (o.lh ?? 1.35);
  const h = lines.length * lh;
  if (o.maxH && h > o.maxH + 0.5) ctx.overflow.push(`${o.label ?? s.slice(0, 40)} (${Math.round(h)} > ${Math.round(o.maxH)})`);
  ctx.doc.text(lines, x, y + size * 0.8, { lineHeightFactor: o.lh ?? 1.35 });
  ctx.bottom = Math.max(ctx.bottom, y + h);
  return h;
}

function kicker(ctx: Ctx, s: string, x: number, y: number, c: RGB = C.muted) {
  monoFont(ctx.doc, "normal", RS_TYPE.note);
  color(ctx.doc, c);
  ctx.doc.text(s.toUpperCase(), x, y, { charSpace: 0.6 });
}

function chrome(ctx: Ctx) {
  const { doc, d } = ctx;
  fill(doc, C.paper);
  doc.rect(0, 0, W, H, "F");
  const mw = drawMark(doc, M, 34, 14);
  font(doc, "body", "bold", RS_TYPE.note);
  color(doc, C.ink);
  doc.text(`${GC_BRAND.name} RESEARCH`, M + mw + 6, 44, { charSpace: 0.8 });
  kicker(ctx, `${d.code} · ${d.version}`, W - M - doc.getTextWidth(`${d.code} · ${d.version}`.toUpperCase()) - 8, 44);
  hair(doc, 60, M, W - M, C.ink, 0.6);
  if (d.draft) {
    kicker(ctx, d.classification, M, 72, C.cobalt);
  }
}

function sourcesFooter(ctx: Ctx) {
  const ids = [...ctx.pageRefs].sort((a, b) => ctx.refs.get(a)! - ctx.refs.get(b)!);
  const page = ctx.doc.getNumberOfPages();
  if (!ids.length) {
    if (ctx.bottom > BOTTOM) ctx.overflow.push(`página ${page}: contenido bajo el pie`);
    ctx.bottom = 0;
    return;
  }
  const lines = ids.map((id) => {
    const s = ctx.d.sources.find((x) => x.id === id)!;
    return `[${ctx.refs.get(id)}] ${s.label} · ${s.period} · ${s.provenance}`;
  });
  monoFont(ctx.doc, "normal", RS_TYPE.note);
  const wrapped = lines.flatMap((l) => ctx.doc.splitTextToSize(l, CW) as string[]);
  const h = wrapped.length * RS_TYPE.note * 1.3;
  const y0 = BOTTOM - h - 6;
  if (ctx.bottom > y0 - 10) ctx.overflow.push(`página ${page}: contenido se superpone a las fuentes (${Math.round(ctx.bottom)} > ${Math.round(y0 - 10)})`);
  ctx.bottom = 0;
  hair(ctx.doc, y0 - 6);
  color(ctx.doc, C.muted);
  ctx.doc.text(wrapped, M, y0 + 4, { lineHeightFactor: 1.3 });
  ctx.pageRefs.clear();
}

function newPage(ctx: Ctx, first = false) {
  if (!first) {
    sourcesFooter(ctx);
    ctx.doc.addPage("a4", "portrait");
  }
  chrome(ctx);
}

function section(ctx: Ctx, y: number, num: string, label: string) {
  monoFont(ctx.doc, "normal", RS_TYPE.note + 0.5);
  color(ctx.doc, C.cobalt);
  ctx.doc.text(num, M, y);
  font(ctx.doc, "display", "normal", 17);
  color(ctx.doc, C.ink);
  ctx.doc.text(label, M + 28, y + 1);
  hair(ctx.doc, y + 9);
  return y + 26;
}

/** Light vector table: top rule ink, hairline separators, no cell borders. */
function table(ctx: Ctx, x: number, y: number, w: number, head: string[], rows: string[][], widths: number[], numeric: number[] = [], maxY = BOTTOM - 80, label = "tabla") {
  const { doc } = ctx;
  hair(doc, y, x, x + w, C.ink, 0.8);
  monoFont(doc, "normal", RS_TYPE.note);
  color(doc, C.muted);
  let cx = x;
  head.forEach((h, i) => {
    const right = numeric.includes(i);
    doc.text(h.toUpperCase(), right ? cx + widths[i] - 4 : cx, y + 12, { align: right ? "right" : "left", charSpace: 0.3 });
    cx += widths[i];
  });
  y += 18;
  hair(doc, y, x, x + w);
  for (const r of rows) {
    const cells = r.map((c, i) => {
      if (numeric.includes(i)) monoFont(doc, "normal", RS_TYPE.body);
      else font(doc, "body", "normal", RS_TYPE.body);
      return doc.splitTextToSize(c, widths[i] - 8) as string[];
    });
    const rh = Math.max(...cells.map((c) => c.length)) * RS_TYPE.body * 1.3 + 8;
    if (y + rh > maxY) {
      ctx.overflow.push(`${label}: fila "${r[0]}" excede el área`);
      break;
    }
    cx = x;
    cells.forEach((lines, i) => {
      const right = numeric.includes(i);
      const isConflict = r[i] === CONFLICT_LABEL;
      if (numeric.includes(i)) monoFont(doc, "normal", RS_TYPE.body);
      else font(doc, "body", i === 0 ? "bold" : "normal", RS_TYPE.body);
      color(doc, isConflict ? C.cobalt : C.ink);
      doc.text(lines, right ? cx + widths[i] - 4 : cx, y + 6 + RS_TYPE.body * 0.8, { align: right ? "right" : "left", lineHeightFactor: 1.3 });
      cx += widths[i];
    });
    y += rh;
    hair(doc, y, x, x + w);
  }
  ctx.bottom = Math.max(ctx.bottom, y);
  return y;
}

function paramRows(ctx: Ctx, ps: ResearchParam[]) {
  return ps.map((p) => [
    p.label + (p.note ? `\n${p.note}` : ""),
    p.conflictId ? `${CONFLICT_LABEL}\n${p.value}` : p.value,
    p.provenance,
    `[${refNo(ctx, p.sourceId)}]`,
  ]);
}

function paramTable(ctx: Ctx, x: number, y: number, w: number, ps: ResearchParam[], maxY?: number, label = "parámetros") {
  const widths = w > 300 ? [w * 0.36, w * 0.38, w * 0.16, w * 0.1] : [w * 0.4, w * 0.34, w * 0.17, w * 0.09];
  const rows = paramRows(ctx, ps);
  // Render conflict rows in cobalt via the CONFLICT_LABEL first line.
  return table(ctx, x, y, w, ["Parámetro", "Valor", "Clase", "Ref."], rows, widths, [3], maxY, label);
}

function bulletList(ctx: Ctx, title: string, items: string[], x: number, y: number, w: number) {
  kicker(ctx, title, x, y);
  y += 10;
  for (const it of items) {
    fill(ctx.doc, C.cobalt);
    ctx.doc.rect(x, y + 4, 3, 3, "F");
    y += text(ctx, it, x + 10, y, w - 10) + 4;
  }
  return y + 6;
}

function mapFigure(ctx: Ctx, y: number, maxH: number) {
  const m = ctx.d.map!;
  const imgW = Math.min(CW, maxH * m.aspect);
  const imgH = imgW / m.aspect;
  if (m.imageDataUrl) {
    ctx.doc.addImage(m.imageDataUrl, "JPEG", M, y, imgW, imgH, undefined, "MEDIUM");
    ctx.bottom = Math.max(ctx.bottom, y + imgH);
  } else {
    stroke(ctx.doc, C.hairline);
    ctx.doc.rect(M, y, imgW, imgH);
    text(ctx, "Imagen no cargada en esta exportación.", M + 12, y + imgH / 2 - 6, imgW - 24, { c: C.muted });
  }
  const mx = M + imgW + 14;
  const mw = W - M - mx;
  let my = y;
  const meta: Array<[string, string]> = [
    ["Fuente", `${m.attribution} [${refNo(ctx, m.sourceId)}]`],
    ["CRS", m.crs],
    ["Extensión", m.extent],
    ["Descarga", m.retrieved],
    ["Adquisición", m.acquisition],
  ];
  if (mw > 90) {
    for (const [k, v] of meta) {
      kicker(ctx, k, mx, my + 7);
      my += 11;
      my += text(ctx, v, mx, my, mw, { family: k === "Extensión" || k === "CRS" ? "mono" : "body", size: RS_TYPE.note }) + 6;
    }
    return Math.max(y + imgH, my) + 8 + text(ctx, m.caption, M, Math.max(y + imgH, my) + 8, CW, { size: RS_TYPE.note, c: C.muted, style: "italic" }) + 10;
  }
  let yy = y + imgH + 8;
  yy += text(ctx, `${m.caption} ${meta.map(([k, v]) => `${k}: ${v}`).join(" · ")}`, M, yy, CW, { size: RS_TYPE.note, c: C.muted });
  return yy + 10;
}

function disclaimers(ctx: Ctx, y: number, maxY: number) {
  kicker(ctx, "Advertencias", M, y);
  y += 10;
  const body = [...ctx.d.disclaimers, ...(ctx.d.separateInstrumentNote ? [ctx.d.separateInstrumentNote] : [])].join(" ");
  return y + text(ctx, body, M, y, CW, { size: RS_TYPE.note, c: C.muted, maxH: maxY - y, label: "advertencias" });
}

function discrepancyBlock(ctx: Ctx, y: number) {
  const ds = ctx.d.discrepancies;
  if (!ds.length) return y;
  kicker(ctx, `Discrepancias entre fuentes · ${ds.filter((d) => d.blocking).length} bloqueantes`, M, y, C.cobalt);
  return table(ctx, M, y + 6, CW, ["Campo", "Documento", "Plataforma", "Estado"], ds.map((d) => [d.field, `${d.documentValue}\n${d.documentSource}`, `${d.platformValue}\n${d.platformSource}`, d.blocking ? "Bloqueante" : "Informativa"]), [CW * 0.2, CW * 0.32, CW * 0.32, CW * 0.16], [], BOTTOM - 40, "discrepancias") + 14;
}

/* ---------------- Templates ---------------- */

function cover(ctx: Ctx) {
  const { d, doc } = ctx;
  kicker(ctx, d.title, M, 170, C.cobalt);
  font(doc, "display", "normal", 58);
  color(doc, C.ink);
  doc.text(d.projectName, M, 236);
  text(ctx, d.subtitle, M, 256, CW, { size: 13, family: "display", style: "italic", c: C.muted });
  hair(doc, 300, M, W - M, C.ink, 0.8);
  const meta: Array<[string, string]> = [
    ["Código", d.code],
    ["Emisión", d.issued],
    ["Versión", d.version],
    ["Categoría", d.category],
    ["Clasificación", d.classification],
    ["Exportación pública", publicExportBlocked(d) ? "BLOQUEADA · datos por confirmar" : "Habilitada tras aprobación"],
  ];
  let y = 318;
  meta.forEach(([k, v], i) => {
    const x = M + (i % 2) * (CW / 2);
    kicker(ctx, k, x, y);
    text(ctx, v, x, y + 5, CW / 2 - 16, { family: "mono", size: RS_TYPE.body, c: k === "Exportación pública" && publicExportBlocked(d) ? C.cobalt : C.ink });
    if (i % 2) y += 40;
  });
  y += 20;
  kicker(ctx, "Resumen", M, y);
  text(ctx, d.thesis, M, y + 10, CW * 0.78, { size: 11, family: "display", lh: 1.45, maxH: 160, label: "tesis portada" });
  disclaimers(ctx, BOTTOM - 120, BOTTOM - 10);
}

function executive(ctx: Ctx) {
  const { d } = ctx;
  let y = section(ctx, TOP + 14, "01", "Resumen ejecutivo");
  y += text(ctx, d.thesis, M, y, CW, { size: 9.5, family: "display", lh: 1.4 }) + 10;
  const cw = (CW - 20) / 2;
  let ly = bulletList(ctx, "Hallazgos principales", d.findings, M, y, cw);
  ly = bulletList(ctx, "Fortalezas", d.strengths, M, ly, cw);
  let ry = bulletList(ctx, "Incertidumbres", d.uncertainties, M + cw + 20, y, cw);
  ry = bulletList(ctx, "Próximos pasos", d.nextSteps, M + cw + 20, ry, cw);
  y = Math.max(ly, ry) + 2;
  kicker(ctx, "Parámetros verificables", M, y);
  y = paramTable(ctx, M, y + 6, CW, d.params, BOTTOM - 64, "parámetros ejecutivos") + 12;
  kicker(ctx, `Términos de la ronda · equity · ${d.termsIssuer ?? ""}`, M, y);
  paramTable(ctx, M, y + 6, CW, d.terms, BOTTOM - 64, "términos");
}

function geology(ctx: Ctx, num = "02") {
  const { d } = ctx;
  let y = section(ctx, TOP + 14, num, "Evidencia geológica");
  if (d.map) y = mapFigure(ctx, y, 250);
  if (d.assays) {
    kicker(ctx, "Análisis puntuales de laboratorio", M, y);
    const a = d.assays;
    const refs = a.sourceIds.map((id) => `[${refNo(ctx, id)}]`).join(" ");
    y = table(ctx, M, y + 6, CW, a.head, a.rows, [CW * 0.1, CW * 0.36, CW * 0.1, CW * 0.1, CW * 0.1, CW * 0.1, CW * 0.14], a.numericCols, BOTTOM - 70, "ensayes") + 8;
    y += text(ctx, `${a.note} Fuentes ${refs}.`, M, y, CW, { size: RS_TYPE.note, c: C.muted });
  }
}

function risks(ctx: Ctx, num = "03") {
  const { d } = ctx;
  let y = section(ctx, TOP + 14, num, "Riesgos y due diligence pendiente");
  y = table(ctx, M, y, CW, ["Área", "Riesgo", "Nivel", "Estado"], d.risks.map((r) => [r.area, r.risk, r.level, r.status]), [CW * 0.16, CW * 0.44, CW * 0.1, CW * 0.3], [], BOTTOM - 60, "riesgos") + 6;
  y += text(ctx, "Nivel: evaluación cualitativa de GeoCapitals, no modelada.", M, y, CW, { size: RS_TYPE.note, c: C.muted }) + 14;
  kicker(ctx, "Due diligence", M, y);
  y = table(ctx, M, y + 6, CW, ["Elemento", "Estado"], d.dueDiligence.map((x) => [x.item, x.status]), [CW * 0.7, CW * 0.3], [], BOTTOM - 60, "due diligence") + 14;
  y = discrepancyBlock(ctx, y);
  return y;
}

function sourceRegister(ctx: Ctx, y: number) {
  kicker(ctx, "Registro de fuentes", M, y);
  return table(ctx, M, y + 6, CW, ["Ref.", "Fuente", "Período", "Clase"], ctx.d.sources.map((s, i) => [`[${i + 1}]`, s.label, s.period, s.provenance]), [CW * 0.08, CW * 0.56, CW * 0.2, CW * 0.16], [], BOTTOM - 20, "fuentes") + 12;
}

function renderMemo(ctx: Ctx) {
  newPage(ctx, true);
  cover(ctx);
  newPage(ctx);
  executive(ctx);
  newPage(ctx);
  geology(ctx);
  newPage(ctx);
  risks(ctx);
}

function renderFactSheet(ctx: Ctx) {
  const { d } = ctx;
  newPage(ctx, true);
  kicker(ctx, d.title, M, TOP + 6, C.cobalt);
  font(ctx.doc, "display", "normal", 28);
  color(ctx.doc, C.ink);
  ctx.doc.text(d.projectName, M, TOP + 36);
  text(ctx, d.subtitle, M, TOP + 42, CW, { size: 9.5, c: C.muted });
  let y = TOP + 62;
  hair(ctx.doc, y, M, W - M, C.ink, 0.8);
  y += 10;
  const lw = CW * 0.42;
  const rx = M + lw + 16;
  const rw = CW - lw - 16;
  let ly = y;
  if (d.map) {
    const m = d.map;
    const ih = Math.min(lw / m.aspect, 150);
    const iw = ih * m.aspect;
    if (m.imageDataUrl) ctx.doc.addImage(m.imageDataUrl, "JPEG", M, ly, iw, ih, undefined, "MEDIUM");
    else {
      stroke(ctx.doc, C.hairline);
      ctx.doc.rect(M, ly, iw, ih);
    }
    ly += ih + 6;
    ly += text(ctx, `Imagen de contexto [${refNo(ctx, m.sourceId)}] · CRS ${m.crs} · adquisición ${m.acquisition.toLowerCase()}`, M, ly, lw, { size: RS_TYPE.note, c: C.muted }) + 8;
  }
  kicker(ctx, "Tesis", rx, y + 4);
  let ry = y + 14 + text(ctx, d.thesis, rx, y + 14, rw, { size: RS_TYPE.body, lh: 1.35 }) + 8;
  y = Math.max(ly, ry);
  kicker(ctx, "Perfil del activo", M, y);
  y = paramTable(ctx, M, y + 6, CW, d.params, BOTTOM - 70, "perfil") + 12;
  kicker(ctx, `Ronda · equity · ${d.termsIssuer ?? ""}`, M, y);
  y = paramTable(ctx, M, y + 6, CW, d.terms, BOTTOM - 70, "ronda ficha") + 6;
  newPage(ctx);
  y = section(ctx, TOP + 14, "02", "Riesgos, fuentes y advertencias");
  y = bulletList(ctx, "Incertidumbres", d.uncertainties, M, y, CW) + 4;
  y = table(ctx, M, y, CW, ["Área", "Riesgo", "Nivel", "Estado"], d.risks.map((r) => [r.area, r.risk, r.level, r.status]), [CW * 0.16, CW * 0.44, CW * 0.1, CW * 0.3], [], BOTTOM - 60, "riesgos ficha") + 14;
  y = discrepancyBlock(ctx, y);
  y = sourceRegister(ctx, y);
  disclaimers(ctx, y + 4, BOTTOM - 10);
}

function renderTechnical(ctx: Ctx) {
  const { d } = ctx;
  newPage(ctx, true);
  kicker(ctx, d.title, M, TOP + 10, C.cobalt);
  font(ctx.doc, "display", "normal", 30);
  color(ctx.doc, C.ink);
  ctx.doc.text(`${d.projectName} · evidencia técnica`, M, TOP + 44);
  let y = TOP + 64;
  kicker(ctx, "Control documental", M, y);
  y = table(ctx, M, y + 6, CW, ["Campo", "Antecedente"], [
    ["Código / versión", `${d.code} · ${d.version}`],
    ["Emisión", d.issued],
    ["Preparado por", "GeoCapitals · equipo técnico (compilación)"],
    ["Revisión QP/CP", "No designada · documento no certificado"],
    ["Estado", d.classification],
  ], [CW * 0.3, CW * 0.7], [], BOTTOM, "control") + 18;
  y = section(ctx, y, "01", "Alcance y método") ;
  y += text(ctx, "Compilación de evidencia existente en la plataforma: ensayes de laboratorio externos, cartografía citada por el titular e imagen satelital de contexto. Se presentan estadísticas descriptivas; no se estiman leyes medias, continuidad, recursos ni reservas.", M, y, CW) + 14;
  kicker(ctx, "Estadística descriptiva", M, y);
  y = paramTable(ctx, M, y + 6, CW, d.assayStats ?? [], BOTTOM - 20, "estadística") + 10;
  newPage(ctx);
  geology(ctx, "02");
  newPage(ctx);
  y = risks(ctx, "03");
  newPage(ctx);
  y = section(ctx, TOP + 14, "04", "Fuentes y advertencias");
  y = sourceRegister(ctx, y);
  disclaimers(ctx, y + 6, BOTTOM - 10);
}

/** Render into an A4 portrait jsPDF already loaded with brand + mono fonts. */
export function renderResearchDoc(doc: jsPDF, d: ResearchDoc): RenderReport {
  const ctx: Ctx = { doc, d, overflow: [], refs: new Map(), pageRefs: new Set(), bottom: 0 };
  if (d.family === "memo") renderMemo(ctx);
  else if (d.family === "factsheet") renderFactSheet(ctx);
  else if (d.family === "technical") renderTechnical(ctx);
  else throw new Error(`Familia no disponible: ${d.family}`);
  sourcesFooter(ctx);
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    hair(doc, H - 50);
    monoFont(doc, "normal", RS_TYPE.note);
    color(doc, C.muted);
    doc.text(d.classification, M, H - 36);
    doc.text(`Emitido ${d.issued}`, W / 2, H - 36, { align: "center" });
    doc.text(`${i} / ${total}`, W - M, H - 36, { align: "right" });
  }
  return { pages: total, overflow: ctx.overflow };
}
