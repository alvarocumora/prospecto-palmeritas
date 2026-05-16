import type jsPDF from "jspdf";
import { COLORS, PAGE, PdfState, ensureSpace, setRGB } from "./primitives";

/* ============================================================
   NATIVE VECTOR FIGURES (drawn directly with jsPDF)
   All figures auto-register a "Figura N" caption.
   ============================================================ */

function captionAndAdvance(s: PdfState, w: number, caption: string) {
  s.figureN += 1;
  setRGB(s.doc, "text", COLORS.muted);
  s.doc.setFont("helvetica", "italic");
  s.doc.setFontSize(8);
  const lines = s.doc.splitTextToSize(`Figura ${s.figureN}. ${caption}`, w) as string[];
  for (const ln of lines) {
    s.doc.text(ln, PAGE.margin, s.cursorY + 3);
    s.cursorY += 3.5;
  }
  s.cursorY += 5;
}

/* ----------------------------------------------------------
   1) CROSS-SECTION (schematic vertical NW-SE)
   ---------------------------------------------------------- */
export function drawCrossSection(s: PdfState, caption: string) {
  const w = PAGE.width - PAGE.margin * 2;
  const h = 75;
  ensureSpace(s, h + 18);
  const { doc } = s;
  const x0 = PAGE.margin;
  const y0 = s.cursorY;

  // Frame
  setRGB(doc, "fill", [252, 248, 242]);
  doc.rect(x0, y0, w, h, "F");
  setRGB(doc, "draw", COLORS.rule);
  doc.setLineWidth(0.3);
  doc.rect(x0, y0, w, h);

  // Sky
  setRGB(doc, "fill", [240, 235, 225]);
  doc.rect(x0, y0, w, 12, "F");

  // Topography (irregular line)
  const topoY = y0 + 15;
  setRGB(doc, "draw", [80, 70, 60]);
  doc.setLineWidth(0.4);
  const topoPts: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const x = x0 + (i / 20) * w;
    const variation = Math.sin(i * 0.7) * 1.2 + Math.cos(i * 0.4) * 0.8;
    topoPts.push([x, topoY + variation]);
  }
  for (let i = 1; i < topoPts.length; i++) {
    doc.line(topoPts[i - 1][0], topoPts[i - 1][1], topoPts[i][0], topoPts[i][1]);
  }

  // Layers (dipping NW-SE)
  // Volcanic host (Fm. Lo Valle) — andesite tan
  setRGB(doc, "fill", [220, 200, 170]);
  doc.rect(x0, y0 + 17, w, 25, "F");
  // Alteration halo (lighter)
  setRGB(doc, "fill", [230, 215, 180]);
  // diamond shape around veins
  const cx = x0 + w * 0.5;
  const haloW = w * 0.45;
  const haloH = 40;
  doc.triangle(cx - haloW / 2, y0 + 25, cx + haloW / 2, y0 + 25, cx, y0 + 25 + haloH, "F");

  // Mesothermal zone bottom
  setRGB(doc, "fill", [180, 160, 140]);
  doc.rect(x0, y0 + 55, w, h - 55, "F");

  // Veins (3 subvertical)
  setRGB(doc, "draw", [200, 146, 42]); // gold
  doc.setLineWidth(1.4);
  const veinPositions = [0.35, 0.5, 0.65];
  for (const vp of veinPositions) {
    const vx = x0 + w * vp;
    doc.line(vx, y0 + 17, vx + 3, y0 + h - 5);
  }

  // Old workings (small black squares near topo)
  setRGB(doc, "fill", [40, 30, 20]);
  doc.rect(x0 + w * 0.36, topoY - 1, 1.5, 1.5, "F");
  doc.rect(x0 + w * 0.51, topoY - 1, 1.5, 1.5, "F");
  doc.rect(x0 + w * 0.65, topoY - 1, 1.5, 1.5, "F");

  // Drill holes (ALH-DDH-001..004)
  setRGB(doc, "draw", [60, 60, 200]);
  doc.setLineWidth(0.5);
  const ddh = [
    { sx: 0.3, deg: 60, length: 28 },
    { sx: 0.45, deg: -55, length: 32 },
    { sx: 0.6, deg: 70, length: 24 },
    { sx: 0.78, deg: -65, length: 30 },
  ];
  for (const d of ddh) {
    const sx = x0 + w * d.sx;
    const sy = topoY;
    const rad = (d.deg * Math.PI) / 180;
    const ex = sx + Math.cos(rad) * d.length;
    const ey = sy + Math.sin(Math.abs(rad)) * d.length;
    doc.line(sx, sy, ex, ey);
    // collar tick
    setRGB(doc, "fill", [60, 60, 200]);
    doc.circle(sx, sy, 0.6, "F");
  }

  // Depth scale on left
  setRGB(doc, "draw", COLORS.muted);
  doc.setLineWidth(0.2);
  doc.line(x0 + 2, topoY, x0 + 2, y0 + h - 2);
  setRGB(doc, "text", COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  const depthLabels = [0, 100, 200, 300, 400, 500];
  for (let i = 0; i < depthLabels.length; i++) {
    const y = topoY + (i / (depthLabels.length - 1)) * (h - 17 - 2);
    doc.line(x0 + 1.5, y, x0 + 2.5, y);
    doc.text(`-${depthLabels[i]}m`, x0 + 4, y + 1);
  }

  // Compass labels NW / SE
  setRGB(doc, "text", COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("NW", x0 + 4, y0 + 5);
  doc.text("SE", x0 + w - 8, y0 + 5);

  // Legend
  const legX = x0 + w - 50;
  const legY = y0 + 10;
  setRGB(doc, "fill", [255, 255, 255]);
  doc.rect(legX, legY, 48, 30, "F");
  setRGB(doc, "draw", COLORS.rule);
  doc.rect(legX, legY, 48, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  setRGB(doc, "text", COLORS.text);
  doc.text("LEYENDA", legX + 2, legY + 4);
  doc.setFont("helvetica", "normal");
  // Vein
  setRGB(doc, "draw", [200, 146, 42]);
  doc.setLineWidth(1.2);
  doc.line(legX + 2, legY + 9, legX + 8, legY + 9);
  setRGB(doc, "text", COLORS.text);
  doc.text("Veta Au-Cu", legX + 10, legY + 10);
  // DDH
  setRGB(doc, "draw", [60, 60, 200]);
  doc.setLineWidth(0.5);
  doc.line(legX + 2, legY + 14, legX + 8, legY + 17);
  doc.text("Sondaje DDH", legX + 10, legY + 16);
  // Alteration
  setRGB(doc, "fill", [230, 215, 180]);
  doc.rect(legX + 2, legY + 19, 6, 3, "F");
  doc.text("Alteración (Si+Ser)", legX + 10, legY + 22);
  // Workings
  setRGB(doc, "fill", [40, 30, 20]);
  doc.rect(legX + 2, legY + 25, 2, 2, "F");
  doc.text("Labor antigua", legX + 10, legY + 27);

  // Title at top center
  setRGB(doc, "text", COLORS.goldDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Sección esquemática NW-SE · Sistema epitermal-mesotermal", x0 + w / 2, y0 + 5, {
    align: "center",
  });

  s.cursorY = y0 + h + 2;
  captionAndAdvance(s, w, caption);
}

/* ----------------------------------------------------------
   2) PIE CHART (budget breakdown)
   ---------------------------------------------------------- */
export function drawPieChart(
  s: PdfState,
  data: { label: string; amount: number; color: [number, number, number] }[],
  totalLabel: string,
  caption: string,
) {
  const w = PAGE.width - PAGE.margin * 2;
  const h = 80;
  ensureSpace(s, h + 16);
  const { doc } = s;
  const x0 = PAGE.margin;
  const y0 = s.cursorY;

  // Frame
  setRGB(doc, "fill", [252, 248, 242]);
  doc.rect(x0, y0, w, h, "F");
  setRGB(doc, "draw", COLORS.rule);
  doc.setLineWidth(0.3);
  doc.rect(x0, y0, w, h);

  // Pie center on the left third
  const cx = x0 + 35;
  const cy = y0 + h / 2;
  const r = 28;

  const total = data.reduce((s2, d) => s2 + d.amount, 0);

  // Approximate pie via many tiny triangles (jsPDF lacks native arcs).
  let startAngle = -Math.PI / 2; // start at top
  const SEG = 120;
  for (const slice of data) {
    const sliceAngle = (slice.amount / total) * Math.PI * 2;
    const segments = Math.max(2, Math.round((sliceAngle / (Math.PI * 2)) * SEG));
    setRGB(doc, "fill", slice.color);
    for (let i = 0; i < segments; i++) {
      const a1 = startAngle + (sliceAngle * i) / segments;
      const a2 = startAngle + (sliceAngle * (i + 1)) / segments;
      const p1x = cx + Math.cos(a1) * r;
      const p1y = cy + Math.sin(a1) * r;
      const p2x = cx + Math.cos(a2) * r;
      const p2y = cy + Math.sin(a2) * r;
      doc.triangle(cx, cy, p1x, p1y, p2x, p2y, "F");
    }
    startAngle += sliceAngle;
  }

  // Center hole (donut)
  setRGB(doc, "fill", [252, 248, 242]);
  doc.circle(cx, cy, r * 0.5, "F");
  // Center label
  setRGB(doc, "text", COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TOTAL", cx, cy - 1, { align: "center" });
  doc.setFontSize(9);
  setRGB(doc, "text", COLORS.goldDark);
  doc.text(totalLabel, cx, cy + 4, { align: "center" });

  // Legend on the right
  const legX = x0 + 75;
  let legY = y0 + 10;
  setRGB(doc, "text", COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DESGLOSE", legX, legY);
  legY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const d of data) {
    const pct = ((d.amount / total) * 100).toFixed(0);
    setRGB(doc, "fill", d.color);
    doc.rect(legX, legY - 2.6, 3, 3, "F");
    setRGB(doc, "text", COLORS.text);
    doc.text(d.label, legX + 5, legY);
    setRGB(doc, "text", COLORS.muted);
    doc.text(`${d.amount.toLocaleString("en-US")} USD   (${pct}%)`, x0 + w - 4, legY, {
      align: "right",
    });
    legY += 6;
  }

  s.cursorY = y0 + h + 2;
  captionAndAdvance(s, w, caption);
}

/* ----------------------------------------------------------
   3) GANTT CHART (project timeline)
   ---------------------------------------------------------- */
export function drawGantt(
  s: PdfState,
  phases: {
    phase: string;
    title: string;
    start: number;
    span: number;
    color: [number, number, number];
  }[],
  totalMonths: number,
  caption: string,
) {
  const w = PAGE.width - PAGE.margin * 2;
  const rowH = 9;
  const headerH = 14;
  const h = headerH + phases.length * rowH + 8;
  ensureSpace(s, h + 16);
  const { doc } = s;
  const x0 = PAGE.margin;
  const y0 = s.cursorY;

  // Frame
  setRGB(doc, "fill", [252, 248, 242]);
  doc.rect(x0, y0, w, h, "F");
  setRGB(doc, "draw", COLORS.rule);
  doc.setLineWidth(0.3);
  doc.rect(x0, y0, w, h);

  const labelW = 38;
  const chartX = x0 + labelW;
  const chartW = w - labelW - 4;
  const monthW = chartW / totalMonths;

  // Month grid + labels
  setRGB(doc, "text", COLORS.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("FASE", x0 + 3, y0 + 8);
  doc.text("MES", chartX, y0 + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  for (let m = 0; m <= totalMonths; m++) {
    const mx = chartX + m * monthW;
    setRGB(doc, "draw", COLORS.rule);
    doc.setLineWidth(0.15);
    doc.line(mx, y0 + headerH - 2, mx, y0 + h - 4);
    if (m < totalMonths) {
      setRGB(doc, "text", COLORS.muted);
      doc.text(`M${m + 1}`, mx + monthW / 2, y0 + 11, { align: "center" });
    }
  }
  // Header underline
  setRGB(doc, "draw", COLORS.gold);
  doc.setLineWidth(0.4);
  doc.line(x0 + 2, y0 + headerH - 2, x0 + w - 2, y0 + headerH - 2);

  // Phase bars
  for (let i = 0; i < phases.length; i++) {
    const ph = phases[i];
    const ry = y0 + headerH + i * rowH;
    // row label
    setRGB(doc, "text", COLORS.text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(ph.phase, x0 + 3, ry + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    setRGB(doc, "text", COLORS.muted);
    doc.text(ph.title, x0 + 14, ry + 5);
    // bar
    const bx = chartX + ph.start * monthW;
    const bw = ph.span * monthW;
    setRGB(doc, "fill", ph.color);
    doc.roundedRect(bx + 1, ry + 1.5, bw - 2, rowH - 4, 1, 1, "F");
    // bar label
    setRGB(doc, "text", [255, 255, 255]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    if (bw > 12) {
      doc.text(`${ph.span}m`, bx + bw / 2, ry + 5, { align: "center" });
    }
  }

  s.cursorY = y0 + h + 2;
  captionAndAdvance(s, w, caption);
}
