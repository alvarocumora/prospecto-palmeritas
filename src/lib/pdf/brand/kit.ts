/**
 * Kit de dibujo compartido por todas las plantillas de documentos Geocapitals.
 * Trabaja sobre una instancia jsPDF ya creada (client-only) y ofrece
 * primitivas de marca: chrome, marca de agua, KPI, gráficos vectoriales,
 * mini-mapa de puntos y QR.
 */
import type jsPDF from "jspdf";
import { GEOCAPITALS_MARK_PNG_BASE64, GEOCAPITALS_MARK_RATIO } from "@/lib/documents/brandAssets";
import { GC_BRAND, GC_COLOR, GC_FONT, type RGB } from "./tokens";

export const MARK_PNG = `data:image/png;base64,${GEOCAPITALS_MARK_PNG_BASE64}`;

export function fill(doc: jsPDF, c: RGB) {
  doc.setFillColor(c[0], c[1], c[2]);
}
export function stroke(doc: jsPDF, c: RGB) {
  doc.setDrawColor(c[0], c[1], c[2]);
}
export function ink(doc: jsPDF, c: RGB) {
  doc.setTextColor(c[0], c[1], c[2]);
}

/** Tipografías editoriales reales (Newsreader + IBM Plex Sans) incrustadas. */
const BRAND_FONT_FILES: Array<[file: string, family: string, style: string]> = [
  ["Newsreader-Regular.ttf", "GCSerif", "normal"],
  ["Newsreader-SemiBold.ttf", "GCSerif", "bold"],
  ["Newsreader-Italic.ttf", "GCSerif", "italic"],
  ["PlexSans-Regular.ttf", "GCSans", "normal"],
  ["PlexSans-SemiBold.ttf", "GCSans", "bold"],
  ["PlexSans-Italic.ttf", "GCSans", "italic"],
];
const FONT_URLS = import.meta.glob("@/assets/fonts/pdf/*.ttf", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;
const fontUrl = (file: string) =>
  Object.entries(FONT_URLS).find(([k]) => k.endsWith(`/${file}`))?.[1];
let fontCache: Promise<Array<[string, string]> | null> | null = null;
const branded = new WeakSet<jsPDF>();

function loadBrandFonts() {
  fontCache ??= (async () => {
    try {
      return await Promise.all(
        BRAND_FONT_FILES.map(async ([file]) => {
          const url = fontUrl(file);
          if (!url) throw new Error(file);
          const res = await fetch(url);
          if (!res.ok) throw new Error(file);
          const bytes = new Uint8Array(await res.arrayBuffer());
          let bin = "";
          for (let i = 0; i < bytes.length; i += 0x8000)
            bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          return [file, btoa(bin)] as [string, string];
        }),
      );
    } catch {
      fontCache = null;
      return null;
    }
  })();
  return fontCache;
}

/** Incrusta las tipografías de marca en el documento. Si fallan, usa las nativas. */
export async function ensureBrandFonts(doc: jsPDF): Promise<void> {
  if (branded.has(doc)) return;
  const data = await loadBrandFonts();
  if (!data) return;
  data.forEach(([file, b64], i) => {
    const [, family, style] = BRAND_FONT_FILES[i];
    doc.addFileToVFS(file, b64);
    doc.addFont(file, family, style);
  });
  branded.add(doc);
}

export function font(
  doc: jsPDF,
  family: "display" | "body",
  style: "normal" | "bold" | "italic",
  size: number,
) {
  const name = branded.has(doc) ? (family === "display" ? "GCSerif" : "GCSans") : GC_FONT[family];
  doc.setFont(name, style);
  doc.setFontSize(size);
}

/** Genera el QR de marca (tinta sobre papel) como dataURL PNG. */
export async function brandQr(url: string, width = 420): Promise<string> {
  const QR = await import("qrcode");
  return QR.toDataURL(url, {
    width,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#12161A", light: "#FFFFFF" },
  });
}

/** Fondo papel a sangre completa. */
export function paperBackground(doc: jsPDF, w: number, h: number) {
  fill(doc, GC_COLOR.paper);
  doc.rect(0, 0, w, h, "F");
}

/** Marca hexagonal «G» de Geocapitals. Devuelve el ancho dibujado. */
export function drawMark(doc: jsPDF, x: number, y: number, height: number): number {
  const w = height * GEOCAPITALS_MARK_RATIO;
  doc.addImage(MARK_PNG, "PNG", x, y, w, height, undefined, "FAST");
  return w;
}

/** Cabecera institucional: marca + wordmark + referencia a la derecha. */
export function drawHeader(
  doc: jsPDF,
  opts: { w: number; m: number; left: string; right: string },
) {
  const { w, m, left, right } = opts;
  const markW = drawMark(doc, m, 20, 20);
  font(doc, "body", "bold", 9);
  ink(doc, GC_COLOR.ink);
  const nameX = m + markW + 7;
  const nameW = doc.getTextWidth(GC_BRAND.name);
  doc.text(GC_BRAND.name, nameX, 30);
  font(doc, "body", "normal", 8);
  ink(doc, GC_COLOR.slate);
  doc.text(left, nameX + nameW + 10, 30);
  doc.text(right, w - m, 30, { align: "right" });
  stroke(doc, GC_COLOR.hairline);
  doc.setLineWidth(0.6);
  doc.line(m, 44, w - m, 44);
}

/** Pie institucional con paginación y versión del documento. */
export function drawFooter(
  doc: jsPDF,
  opts: { w: number; h: number; m: number; left: string; page: number; total?: number },
) {
  const { w, h, m, left, page, total } = opts;
  stroke(doc, GC_COLOR.hairline);
  doc.setLineWidth(0.6);
  doc.line(m, h - 34, w - m, h - 34);
  font(doc, "body", "normal", 7.5);
  ink(doc, GC_COLOR.slate);
  doc.text(left, m, h - 21);
  doc.text(GC_BRAND.site, w / 2, h - 21, { align: "center" });
  doc.text(total ? `${page} / ${total}` : String(page), w - m, h - 21, { align: "right" });
}

/** Etiqueta de sección tipo "eyebrow" con regla de cobalto. */
export function eyebrow(doc: jsPDF, x: number, y: number, label: string) {
  fill(doc, GC_COLOR.cobalt);
  doc.rect(x, y - 7, 22, 2.4, "F");
  font(doc, "body", "bold", 8);
  ink(doc, GC_COLOR.cobalt);
  doc.text(label.toUpperCase(), x + 29, y - 4);
}

/** Título display serif. Devuelve el alto consumido. */
export function title(
  doc: jsPDF,
  x: number,
  y: number,
  text: string,
  size = 26,
  maxW?: number,
): number {
  font(doc, "display", "bold", size);
  ink(doc, GC_COLOR.ink);
  const lines = maxW ? doc.splitTextToSize(text, maxW) : [text];
  lines.forEach((l: string, i: number) => doc.text(l, x, y + i * (size * 1.05)));
  return lines.length * size * 1.05;
}

/** Párrafo de cuerpo con retorno de alto consumido. */
export function paragraph(
  doc: jsPDF,
  x: number,
  y: number,
  text: string,
  maxW: number,
  size = 9.5,
  color: RGB = GC_COLOR.inkSoft,
): number {
  font(doc, "body", "normal", size);
  ink(doc, color);
  const lines = doc.splitTextToSize(text, maxW);
  const lh = size * 1.45;
  lines.forEach((l: string, i: number) => doc.text(l, x, y + i * lh));
  return lines.length * lh;
}

/** Lista de viñetas con cuadrado cobalto. Devuelve alto consumido. */
export function bullets(
  doc: jsPDF,
  x: number,
  y: number,
  items: string[],
  maxW: number,
  size = 9.5,
): number {
  let cy = y;
  for (const item of items) {
    fill(doc, GC_COLOR.cobalt);
    doc.rect(x, cy - 5, 3.4, 3.4, "F");
    const used = paragraph(doc, x + 11, cy, item, maxW - 11, size);
    cy += used + 5;
  }
  return cy - y;
}

export type Kpi = { label: string; value: string; note?: string };

/** Rejilla de métricas protagonistas (cifras grandes en serif). */
export function kpiGrid(
  doc: jsPDF,
  opts: {
    x: number;
    y: number;
    w: number;
    items: Kpi[];
    cols?: number;
    rowH?: number;
    valueSize?: number;
  },
): number {
  const { x, y, w, items } = opts;
  const cols = opts.cols ?? Math.min(4, items.length || 1);
  const rowH = opts.rowH ?? 74;
  const gap = 12;
  const cw = (w - gap * (cols - 1)) / cols;
  const rows = Math.ceil(items.length / cols);
  items.forEach((it, i) => {
    const cx = x + (i % cols) * (cw + gap);
    const cy = y + Math.floor(i / cols) * (rowH + gap);
    fill(doc, GC_COLOR.white);
    stroke(doc, GC_COLOR.hairline);
    doc.setLineWidth(0.7);
    doc.rect(cx, cy, cw, rowH, "FD");
    fill(doc, GC_COLOR.cobalt);
    doc.rect(cx, cy, 2.6, rowH, "F");
    font(doc, "body", "bold", 7.2);
    ink(doc, GC_COLOR.slate);
    doc.text(doc.splitTextToSize(it.label.toUpperCase(), cw - 24)[0], cx + 14, cy + 18);
    font(doc, "display", "bold", opts.valueSize ?? 21);
    ink(doc, GC_COLOR.ink);
    const vLines = doc.splitTextToSize(it.value, cw - 24).slice(0, 2);
    vLines.forEach((l: string, k: number) => doc.text(l, cx + 14, cy + 42 + k * 19));
    if (it.note) {
      font(doc, "body", "normal", 7);
      ink(doc, GC_COLOR.slate);
      doc.text(doc.splitTextToSize(it.note, cw - 24)[0], cx + 14, cy + rowH - 11);
    }
  });
  return rows * rowH + (rows - 1) * gap;
}

export type BarDatum = { label: string; a: number; b?: number };

/**
 * Gráfico de barras agrupadas (ej. Cu total vs Cu soluble).
 * Vectorial: se mantiene nítido a cualquier zoom de impresión.
 */
export function barChart(
  doc: jsPDF,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    data: BarDatum[];
    labelA: string;
    labelB?: string;
    unit?: string;
    colorA?: RGB;
    colorB?: RGB;
  },
) {
  const { x, y, w, h, data } = opts;
  const colorA = opts.colorA ?? GC_COLOR.cobalt;
  const colorB = opts.colorB ?? GC_COLOR.copper;
  const plotTop = y + 16;
  const plotBottom = y + h - 26;
  const plotH = plotBottom - plotTop;
  const max = Math.max(...data.flatMap((d) => [d.a, d.b ?? 0]), 0.0001);
  const niceMax = max * 1.15;

  // Rejilla horizontal
  stroke(doc, GC_COLOR.hairline);
  doc.setLineWidth(0.5);
  font(doc, "body", "normal", 6.5);
  ink(doc, GC_COLOR.slate);
  for (let i = 0; i <= 4; i++) {
    const gy = plotBottom - (plotH * i) / 4;
    doc.line(x + 26, gy, x + w, gy);
    doc.text(((niceMax * i) / 4).toFixed(niceMax < 5 ? 1 : 0), x + 22, gy + 2.2, {
      align: "right",
    });
  }

  const slot = (w - 26) / data.length;
  const paired = data.some((d) => d.b != null);
  const barW = paired ? Math.min(16, slot * 0.28) : Math.min(24, slot * 0.46);

  data.forEach((d, i) => {
    const cx = x + 26 + slot * i + slot / 2;
    const ha = (d.a / niceMax) * plotH;
    const ax = paired ? cx - barW - 2 : cx - barW / 2;
    fill(doc, colorA);
    doc.rect(ax, plotBottom - ha, barW, ha, "F");
    if (d.b != null) {
      const hb = (d.b / niceMax) * plotH;
      fill(doc, colorB);
      doc.rect(cx + 2, plotBottom - hb, barW, hb, "F");
    }
    font(doc, "body", "normal", 6.6);
    ink(doc, GC_COLOR.slate);
    doc.text(d.label, cx, plotBottom + 11, { align: "center" });
  });

  // Eje base
  stroke(doc, GC_COLOR.ink);
  doc.setLineWidth(0.8);
  doc.line(x + 26, plotBottom, x + w, plotBottom);

  // Leyenda
  font(doc, "body", "bold", 7);
  let lx = x + 26;
  fill(doc, colorA);
  doc.rect(lx, y + 3, 7, 7, "F");
  ink(doc, GC_COLOR.ink);
  doc.text(opts.labelA, lx + 11, y + 9);
  if (opts.labelB) {
    lx += 18 + doc.getTextWidth(opts.labelA);
    fill(doc, colorB);
    doc.rect(lx, y + 3, 7, 7, "F");
    doc.text(opts.labelB, lx + 11, y + 9);
  }
  if (opts.unit) {
    font(doc, "body", "normal", 6.8);
    ink(doc, GC_COLOR.slate);
    doc.text(opts.unit, x + w, y + 9, { align: "right" });
  }
}

export type Slice = { label: string; pct: number; color?: RGB };

/** Anillo de distribución (uso de fondos, estructura de capital). */
export function donutChart(
  doc: jsPDF,
  opts: {
    cx: number;
    cy: number;
    r: number;
    inner?: number;
    slices: Slice[];
    centerTop?: string;
    centerSub?: string;
  },
) {
  const { cx, cy, r, slices } = opts;
  const inner = opts.inner ?? r * 0.58;
  const palette: RGB[] = [
    GC_COLOR.cobalt,
    GC_COLOR.copper,
    GC_COLOR.gold,
    GC_COLOR.green,
    GC_COLOR.slate,
    GC_COLOR.cobaltSoft,
  ];
  const total = slices.reduce((s, x) => s + x.pct, 0) || 1;
  let angle = -Math.PI / 2;
  slices.forEach((s, i) => {
    const sweep = (s.pct / total) * Math.PI * 2;
    const steps = Math.max(6, Math.ceil((sweep / (Math.PI * 2)) * 72));
    const pts: [number, number][] = [[cx, cy]];
    for (let k = 0; k <= steps; k++) {
      const a = angle + (sweep * k) / steps;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    const deltas = pts
      .slice(1)
      .map((p, k) => [p[0] - pts[k][0], p[1] - pts[k][1]] as [number, number]);
    fill(doc, s.color ?? palette[i % palette.length]);
    doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], "F", true);
    angle += sweep;
  });
  fill(doc, GC_COLOR.paper);
  doc.circle(cx, cy, inner, "F");
  if (opts.centerTop) {
    font(doc, "display", "bold", 16);
    ink(doc, GC_COLOR.ink);
    doc.text(opts.centerTop, cx, cy + (opts.centerSub ? 0 : 5), { align: "center" });
  }
  if (opts.centerSub) {
    font(doc, "body", "normal", 6.8);
    ink(doc, GC_COLOR.slate);
    doc.text(opts.centerSub, cx, cy + 13, { align: "center" });
  }
}

/** Leyenda vertical del anillo con porcentajes alineados. */
export function donutLegend(doc: jsPDF, x: number, y: number, w: number, slices: Slice[]): number {
  const palette: RGB[] = [
    GC_COLOR.cobalt,
    GC_COLOR.copper,
    GC_COLOR.gold,
    GC_COLOR.green,
    GC_COLOR.slate,
    GC_COLOR.cobaltSoft,
  ];
  let cy = y;
  slices.forEach((s, i) => {
    fill(doc, s.color ?? palette[i % palette.length]);
    doc.rect(x, cy - 6, 8, 8, "F");
    font(doc, "body", "normal", 8);
    ink(doc, GC_COLOR.inkSoft);
    const lines = doc.splitTextToSize(s.label, w - 46);
    lines.slice(0, 2).forEach((l: string, k: number) => doc.text(l, x + 14, cy + k * 10));
    font(doc, "body", "bold", 8.5);
    ink(doc, GC_COLOR.ink);
    doc.text(`${s.pct} %`, x + w, cy, { align: "right" });
    cy += Math.min(lines.length, 2) * 10 + 8;
  });
  return cy - y;
}

export type MapPoint = {
  label: string;
  lat: number;
  lng: number;
  value?: number;
  highlight?: boolean;
};

/** Polígono de tenencia/concesión dibujado bajo los puntos (anillo [lng, lat]). */
export type MapPolygon = { label: string; ring: Array<[number, number]>; emphasis?: boolean };

/**
 * Mini-mapa cartográfico vectorial: dispersión georreferenciada de puntos
 * con marco, retícula y escala aproximada. No requiere teselas ni red.
 */
export function scatterMap(
  doc: jsPDF,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    points: MapPoint[];
    caption?: string;
    labelTop?: number;
    polygons?: MapPolygon[];
  },
) {
  const { x, y, w, h, points } = opts;
  const polygons = opts.polygons ?? [];
  fill(doc, GC_COLOR.white);
  stroke(doc, GC_COLOR.hairline);
  doc.setLineWidth(0.7);
  doc.rect(x, y, w, h, "FD");
  if (!points.length) return;

  const lats = [...points.map((p) => p.lat), ...polygons.flatMap((g) => g.ring.map((c) => c[1]))];
  const lngs = [...points.map((p) => p.lng), ...polygons.flatMap((g) => g.ring.map((c) => c[0]))];
  const padLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.15, 0.004);
  const padLng = Math.max((Math.max(...lngs) - Math.min(...lngs)) * 0.15, 0.004);
  const minLat = Math.min(...lats) - padLat;
  const maxLat = Math.max(...lats) + padLat;
  const minLng = Math.min(...lngs) - padLng;
  const maxLng = Math.max(...lngs) + padLng;

  // Retícula
  stroke(doc, GC_COLOR.paperDeep);
  doc.setLineWidth(0.4);
  for (let i = 1; i < 4; i++) {
    doc.line(x + (w * i) / 4, y, x + (w * i) / 4, y + h);
    doc.line(x, y + (h * i) / 4, x + w, y + (h * i) / 4);
  }

  const px = (lng: number) => x + ((lng - minLng) / (maxLng - minLng)) * w;
  const py = (lat: number) => y + h - ((lat - minLat) / (maxLat - minLat)) * h;

  // Concesiones (bajo los puntos): contorno + relleno suave + rótulo
  polygons.forEach((g) => {
    if (g.ring.length < 3) return;
    const pts = g.ring.map(([lng, lat]) => [px(lng), py(lat)] as [number, number]);
    const deltas = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
    fill(doc, g.emphasis ? GC_COLOR.paperDeep : GC_COLOR.paper);
    stroke(doc, g.emphasis ? GC_COLOR.green : GC_COLOR.slate);
    doc.setLineWidth(g.emphasis ? 1.1 : 0.5);
    doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], "FD", true);
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    if (g.emphasis) {
      font(doc, "body", "bold", 5.8);
      ink(doc, GC_COLOR.green);
      doc.text(g.label, cx, cy, { align: "center" });
    }
  });

  const values = points.map((p) => p.value ?? 0);
  const vMax = Math.max(...values, 0.0001);
  const labelTop = opts.labelTop ?? 4;
  const ranked = [...points].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  points.forEach((p) => {
    const r = p.value != null ? 2 + (p.value / vMax) * 5.5 : 2.6;
    const c: RGB = p.highlight ? GC_COLOR.copper : GC_COLOR.cobalt;
    fill(doc, c);
    doc.circle(px(p.lng), py(p.lat), r, "F");
    fill(doc, GC_COLOR.white);
    doc.circle(px(p.lng), py(p.lat), Math.max(0.7, r * 0.28), "F");
  });

  font(doc, "body", "bold", 6.4);
  ink(doc, GC_COLOR.ink);
  const placed: Array<{ x: number; y: number }> = [];
  ranked.slice(0, labelTop).forEach((p) => {
    const cx = px(p.lng);
    const cy = py(p.lat);
    if (placed.some((q) => Math.abs(q.x - cx) < 34 && Math.abs(q.y - cy) < 9)) return;
    placed.push({ x: cx, y: cy });
    const lx = Math.min(cx + 8, x + w - 30);
    doc.text(p.label, lx, cy + 2.2);
  });

  // Escala aproximada (1 grado lng ~ 92,5 km a -34 grados)
  const kmPerLng = 92.5;
  const spanKm = (maxLng - minLng) * kmPerLng;
  font(doc, "body", "normal", 6.2);
  ink(doc, GC_COLOR.slate);
  doc.text(
    `Ancho del encuadre: aprox. ${spanKm.toFixed(1).replace(".", ",")} km`,
    x + 6,
    y + h - 6,
  );
  // Rosa de los vientos (vectorial, sin glifos especiales)
  const nx = x + w - 14;
  const ny = y + 14;
  stroke(doc, GC_COLOR.slate);
  doc.setLineWidth(0.8);
  doc.line(nx, ny + 7, nx, ny - 3);
  doc.line(nx, ny - 3, nx - 2.4, ny + 0.6);
  doc.line(nx, ny - 3, nx + 2.4, ny + 0.6);
  font(doc, "body", "bold", 6.2);
  ink(doc, GC_COLOR.slate);
  doc.text("N", nx - 1.6, ny + 13);

  if (opts.caption) {
    font(doc, "body", "normal", 7);
    ink(doc, GC_COLOR.slate);
    doc.text(doc.splitTextToSize(opts.caption, w), x, y + h + 11);
  }
}

/** Caja de advertencia / disclaimer con borde cobre. */
export function noticeBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  lines: string[],
  heading?: string,
): number {
  const inner = w - 26;
  font(doc, "body", "normal", 7.6);
  let textH = 0;
  const wrapped = lines.map((l) => doc.splitTextToSize(`— ${l}`, inner) as string[]);
  wrapped.forEach((ls) => (textH += ls.length * 10.2 + 3));
  const headH = heading ? 16 : 0;
  const boxH = textH + headH + 20;
  fill(doc, GC_COLOR.paperDeep);
  doc.rect(x, y, w, boxH, "F");
  fill(doc, GC_COLOR.copper);
  doc.rect(x, y, 2.6, boxH, "F");
  let cy = y + 15;
  if (heading) {
    font(doc, "body", "bold", 7.6);
    ink(doc, GC_COLOR.copper);
    doc.text(heading.toUpperCase(), x + 14, cy);
    cy += 14;
  }
  font(doc, "body", "normal", 7.6);
  ink(doc, GC_COLOR.inkSoft);
  wrapped.forEach((ls) => {
    ls.forEach((l, i) => doc.text(l, x + 14, cy + i * 10.2));
    cy += ls.length * 10.2 + 3;
  });
  return boxH;
}

/** Tabla editorial ligera: sin bordes verticales, cabecera en tinta. */
export function editorialTable(
  doc: jsPDF,
  opts: {
    x: number;
    y: number;
    w: number;
    head: string[];
    rows: string[][];
    widths?: number[];
    size?: number;
  },
): number {
  const { x, y, w, head, rows } = opts;
  const size = opts.size ?? 7.8;
  const widths = opts.widths ?? head.map(() => w / head.length);
  let cy = y;
  fill(doc, GC_COLOR.ink);
  doc.rect(x, cy, w, 18, "F");
  font(doc, "body", "bold", size);
  ink(doc, GC_COLOR.paper);
  let cx = x + 8;
  head.forEach((hcell, i) => {
    doc.text(doc.splitTextToSize(hcell, widths[i] - 10)[0], cx, cy + 12);
    cx += widths[i];
  });
  cy += 18;
  rows.forEach((row, ri) => {
    const cells = row.map((cell, i) => doc.splitTextToSize(cell, widths[i] - 10) as string[]);
    const rowH = Math.max(...cells.map((c) => c.length)) * (size * 1.35) + 8;
    if (ri % 2 === 1) {
      fill(doc, GC_COLOR.white);
      doc.rect(x, cy, w, rowH, "F");
    }
    font(doc, "body", "normal", size);
    ink(doc, GC_COLOR.inkSoft);
    cx = x + 8;
    cells.forEach((lines, i) => {
      lines.forEach((l, k) => doc.text(l, cx, cy + 11 + k * size * 1.35));
      cx += widths[i];
    });
    stroke(doc, GC_COLOR.hairline);
    doc.setLineWidth(0.4);
    doc.line(x, cy + rowH, x + w, cy + rowH);
    cy += rowH;
  });
  return cy - y;
}

/**
 * Cuántas filas de la tabla caben en `avail` puntos de alto, cabecera incluida.
 * Permite cortar una tabla entre páginas sin que se salga del área de texto.
 */
export function fitTableRows(
  doc: jsPDF,
  opts: { head: string[]; rows: string[][]; widths?: number[]; w: number; size?: number },
  avail: number,
): number {
  const size = opts.size ?? 7.8;
  const widths = opts.widths ?? opts.head.map(() => opts.w / opts.head.length);
  let h = 18;
  if (h > avail) return 0;
  let fit = 0;
  for (const row of opts.rows) {
    const lines = row.map(
      (cell, i) => (doc.splitTextToSize(cell, widths[i] - 10) as string[]).length,
    );
    const rowH = Math.max(...lines) * (size * 1.35) + 8;
    if (h + rowH > avail) break;
    h += rowH;
    fit += 1;
  }
  return fit;
}

/** Bloque QR con leyenda: puerta de entrada al live map / data room. */
export function qrBlock(
  doc: jsPDF,
  opts: {
    x: number;
    y: number;
    size: number;
    qr: string;
    caption: string;
    sub?: string;
    align?: "left" | "center";
  },
) {
  const { x, y, size, qr } = opts;
  fill(doc, GC_COLOR.white);
  stroke(doc, GC_COLOR.hairline);
  doc.setLineWidth(0.7);
  doc.rect(x, y, size, size, "FD");
  doc.addImage(qr, "PNG", x + 5, y + 5, size - 10, size - 10, undefined, "FAST");
  const tx = opts.align === "center" ? x + size / 2 : x;
  const alignOpt = opts.align === "center" ? { align: "center" as const } : undefined;
  font(doc, "body", "bold", 7.6);
  ink(doc, GC_COLOR.ink);
  doc.text(opts.caption.toUpperCase(), tx, y + size + 13, alignOpt);
  if (opts.sub) {
    font(doc, "body", "normal", 6.8);
    ink(doc, GC_COLOR.slate);
    doc.text(doc.splitTextToSize(opts.sub, size + 60)[0], tx, y + size + 23, alignOpt);
  }
}
