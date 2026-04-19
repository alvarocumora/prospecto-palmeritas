import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COLORS, PAGE, createState, drawHeader, drawFooter, h1, h2, p, calloutBox, setRGB } from "./primitives";

export type MonthlyReportInput = {
  projectName: string;
  projectCode: string;
  monthLabel: string; // e.g. "Abril 2026"
  startDate: string;
  endDate: string;
  kpis: {
    metersDrilled: number;
    samplesAnalyzed: number;
    auAvg: number | null;
    interceptCount: number;
    totalCost: number;
    costPerMeter: number | null;
  };
  qaqc: { total: number; pass: number; warn: number; fail: number };
  approvals: { draft: number; review: number; approved: number };
  targets: { generated: number; validated: number; drillReady: number; drilled: number; closed: number };
  budget: { planned: number; actual: number; byCategory: { category: string; planned: number; actual: number }[] };
  topIntercepts: { hole: string; from: number; to: number; au: number | null }[];
  hse: { activePermits: number; expiringPermits: number; openIncidents: number; communityEvents: number };
};

export function generateMonthlyReport(input: MonthlyReportInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const s = createState(doc);

  // ===== Cover =====
  s.chromeEnabled = false;
  setRGB(doc, "fill", COLORS.paper);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  setRGB(doc, "fill", COLORS.gold);
  doc.rect(0, 0, PAGE.width, 60, "F");

  setRGB(doc, "text", [255, 253, 250]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("REPORTE EJECUTIVO MENSUAL", PAGE.margin, 22);
  doc.setFontSize(26);
  doc.text(input.monthLabel, PAGE.margin, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${input.projectName} · ${input.projectCode}`, PAGE.margin, 50);

  setRGB(doc, "text", COLORS.muted);
  doc.setFontSize(9);
  doc.text(`Período: ${input.startDate} — ${input.endDate}`, PAGE.margin, 78);
  doc.text(`Generado: ${new Date().toLocaleDateString("es-CL")} · CONFIDENCIAL`, PAGE.margin, 84);

  // KPI grid on cover
  const kpiTop = 100;
  const kpiCards: [string, string][] = [
    ["Metros Perforados", input.kpis.metersDrilled.toFixed(0)],
    ["Muestras Analizadas", String(input.kpis.samplesAnalyzed)],
    ["Au Promedio (g/t)", input.kpis.auAvg != null ? input.kpis.auAvg.toFixed(2) : "—"],
    ["Interceptos >0.5 g/t", String(input.kpis.interceptCount)],
    ["Costo Total (USD)", `$${input.kpis.totalCost.toLocaleString()}`],
    ["USD / metro", input.kpis.costPerMeter != null ? `$${input.kpis.costPerMeter.toFixed(0)}` : "—"],
  ];
  const cardW = (PAGE.width - PAGE.margin * 2 - 10) / 3;
  const cardH = 26;
  kpiCards.forEach((c, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = PAGE.margin + col * (cardW + 5);
    const y = kpiTop + row * (cardH + 5);
    setRGB(doc, "fill", COLORS.panel);
    doc.rect(x, y, cardW, cardH, "F");
    setRGB(doc, "fill", COLORS.gold);
    doc.rect(x, y, 1.5, cardH, "F");
    setRGB(doc, "text", COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(c[0].toUpperCase(), x + 4, y + 6);
    setRGB(doc, "text", COLORS.text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(c[1], x + 4, y + 18);
  });
  s.chromeEnabled = true;
  doc.addPage();
  s.pageNum += 1;
  s.cursorY = PAGE.contentTop;
  drawHeader(s);
  drawFooter(s);

  // ===== Section 1: Resumen Ejecutivo =====
  h1(s, "Resumen Ejecutivo");
  p(s, `Este informe consolida la actividad del proyecto ${input.projectName} (${input.projectCode}) durante el período ${input.startDate} a ${input.endDate}. Se reportan los indicadores clave de operación, gobernanza de datos (QA/QC y aprobaciones), pipeline de targets, control financiero y cumplimiento HSE.`);

  calloutBox(s, "Indicadores Clave",
    `Se perforaron ${input.kpis.metersDrilled.toFixed(0)} metros con ${input.kpis.interceptCount} interceptos sobre 0.5 g/t Au. Se analizaron ${input.kpis.samplesAnalyzed} muestras con un promedio de ${input.kpis.auAvg != null ? input.kpis.auAvg.toFixed(2) + " g/t Au" : "sin datos"}. Costo total del período: USD $${input.kpis.totalCost.toLocaleString()}${input.kpis.costPerMeter != null ? ` ($${input.kpis.costPerMeter.toFixed(0)} USD/m)` : ""}.`);

  // ===== Section 2: QA/QC & Aprobaciones =====
  h1(s, "Gobernanza de Datos");
  h2(s, "QA/QC");
  const qaTotal = input.qaqc.total;
  const passRate = qaTotal > 0 ? (input.qaqc.pass / qaTotal * 100).toFixed(1) : "—";
  p(s, `Total de muestras de control analizadas: ${qaTotal}. Tasa de aprobación: ${passRate}%.`);
  autoTable(doc, {
    startY: s.cursorY,
    head: [["Resultado", "Cantidad", "%"]],
    body: [
      ["Pasa", String(input.qaqc.pass), qaTotal > 0 ? `${(input.qaqc.pass/qaTotal*100).toFixed(1)}%` : "—"],
      ["Advertencia", String(input.qaqc.warn), qaTotal > 0 ? `${(input.qaqc.warn/qaTotal*100).toFixed(1)}%` : "—"],
      ["Falla", String(input.qaqc.fail), qaTotal > 0 ? `${(input.qaqc.fail/qaTotal*100).toFixed(1)}%` : "—"],
    ],
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: COLORS.gold, textColor: [255,255,255] },
    margin: { left: PAGE.margin, right: PAGE.margin },
  });
  // @ts-expect-error lastAutoTable injected
  s.cursorY = (doc.lastAutoTable?.finalY ?? s.cursorY) + 6;

  h2(s, "Workflow de Aprobaciones");
  autoTable(doc, {
    startY: s.cursorY,
    head: [["Estado", "Registros"]],
    body: [
      ["Borrador", String(input.approvals.draft)],
      ["En Revisión", String(input.approvals.review)],
      ["Aprobados", String(input.approvals.approved)],
    ],
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: COLORS.gold, textColor: [255,255,255] },
    margin: { left: PAGE.margin, right: PAGE.margin },
  });
  // @ts-expect-error lastAutoTable injected
  s.cursorY = (doc.lastAutoTable?.finalY ?? s.cursorY) + 6;

  // ===== Section 3: Targets Pipeline =====
  h1(s, "Pipeline de Targets");
  autoTable(doc, {
    startY: s.cursorY,
    head: [["Etapa", "Cantidad"]],
    body: [
      ["Generados", String(input.targets.generated)],
      ["Validados", String(input.targets.validated)],
      ["Listos para perforar", String(input.targets.drillReady)],
      ["Perforados", String(input.targets.drilled)],
      ["Cerrados", String(input.targets.closed)],
    ],
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: COLORS.gold, textColor: [255,255,255] },
    margin: { left: PAGE.margin, right: PAGE.margin },
  });
  // @ts-expect-error lastAutoTable injected
  s.cursorY = (doc.lastAutoTable?.finalY ?? s.cursorY) + 6;

  // ===== Section 4: Control Financiero =====
  h1(s, "Control Financiero");
  const variance = input.budget.actual - input.budget.planned;
  p(s, `Presupuesto planificado: USD $${input.budget.planned.toLocaleString()}. Ejecutado: USD $${input.budget.actual.toLocaleString()}. Varianza: ${variance >= 0 ? "+" : ""}$${variance.toLocaleString()}.`);
  if (input.budget.byCategory.length > 0) {
    autoTable(doc, {
      startY: s.cursorY,
      head: [["Categoría", "Planificado", "Real", "Δ"]],
      body: input.budget.byCategory.map((c) => [
        c.category,
        `$${c.planned.toLocaleString()}`,
        `$${c.actual.toLocaleString()}`,
        `$${(c.actual - c.planned).toLocaleString()}`,
      ]),
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: COLORS.gold, textColor: [255,255,255] },
      margin: { left: PAGE.margin, right: PAGE.margin },
    });
    // @ts-expect-error lastAutoTable injected
    s.cursorY = (doc.lastAutoTable?.finalY ?? s.cursorY) + 6;
  }

  // ===== Section 5: Top Intercepts =====
  if (input.topIntercepts.length > 0) {
    h1(s, "Mejores Interceptos del Período");
    autoTable(doc, {
      startY: s.cursorY,
      head: [["Sondaje", "Desde (m)", "Hasta (m)", "Au (g/t)"]],
      body: input.topIntercepts.map((i) => [
        i.hole,
        i.from.toFixed(1),
        i.to.toFixed(1),
        i.au != null ? i.au.toFixed(2) : "—",
      ]),
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: COLORS.gold, textColor: [255,255,255] },
      margin: { left: PAGE.margin, right: PAGE.margin },
    });
    // @ts-expect-error lastAutoTable injected
    s.cursorY = (doc.lastAutoTable?.finalY ?? s.cursorY) + 6;
  }

  // ===== Section 6: HSE =====
  h1(s, "Cumplimiento HSE");
  autoTable(doc, {
    startY: s.cursorY,
    head: [["Indicador", "Valor"]],
    body: [
      ["Permisos activos", String(input.hse.activePermits)],
      ["Permisos próximos a vencer (≤90 días)", String(input.hse.expiringPermits)],
      ["Incidentes abiertos", String(input.hse.openIncidents)],
      ["Eventos comunitarios del período", String(input.hse.communityEvents)],
    ],
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: COLORS.gold, textColor: [255,255,255] },
    margin: { left: PAGE.margin, right: PAGE.margin },
  });
  // @ts-expect-error lastAutoTable injected
  s.cursorY = (doc.lastAutoTable?.finalY ?? s.cursorY) + 6;

  if (input.hse.expiringPermits > 0 || input.hse.openIncidents > 0) {
    calloutBox(s, "Atención",
      `${input.hse.expiringPermits > 0 ? `Hay ${input.hse.expiringPermits} permiso(s) próximos a vencer. ` : ""}${input.hse.openIncidents > 0 ? `Hay ${input.hse.openIncidents} incidente(s) sin cerrar.` : ""}`);
  }

  return doc;
}
