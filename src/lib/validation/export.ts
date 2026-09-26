import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ValidationReport } from "@/hooks/useDataValidation";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ts(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function exportValidationCsv(report: ValidationReport, projectName: string) {
  const sections: string[] = [];

  sections.push(`# Reporte de Validación`);
  sections.push(`# Proyecto: ${projectName}`);
  sections.push(`# Generado: ${new Date(report.generatedAt).toLocaleString("es-CL")}`);
  sections.push("");

  sections.push("## Resumen");
  sections.push(
    toCsv([
      ["metric", "value"],
      ["tablas_ok", report.totals.ok],
      ["tablas_vacias", report.totals.empty],
      ["warnings", report.totals.warn],
      ["errores", report.totals.error],
      ["filas_totales", report.totals.rows],
      ["inconsistencias", report.inconsistencies.length],
    ]),
  );
  sections.push("");

  sections.push("## Tablas");
  const tableRows: (string | number)[][] = [
    ["grupo", "tabla", "label", "filas", "estado", "min_esperado", "ultima_sync", "delta", "error"],
  ];
  for (const t of report.tables) {
    const sync = report.lastSync[t.table];
    tableRows.push([
      t.group,
      t.table,
      t.label,
      t.count,
      t.status,
      t.expectedMin ?? "",
      sync ? new Date(sync.at).toISOString() : "",
      sync ? sync.delta : "",
      t.error ?? "",
    ]);
  }
  sections.push(toCsv(tableRows));
  sections.push("");

  sections.push("## Inconsistencias");
  const incRows: (string | number)[][] = [
    ["severidad", "categoria", "tabla", "regla", "filas_afectadas", "detalle"],
  ];
  for (const i of report.inconsistencies) {
    incRows.push([i.severity, i.category ?? "", i.table, i.rule, i.count, i.detail]);
  }
  sections.push(toCsv(incRows));

  const blob = new Blob(["\ufeff" + sections.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `validacion-${projectName.replace(/\s+/g, "_")}-${ts()}.csv`);
}

export function exportValidationPdf(report: ValidationReport, projectName: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Reporte de Validación de Datos", 40, 50);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Proyecto: ${projectName}`, 40, 68);
  doc.text(`Generado: ${new Date(report.generatedAt).toLocaleString("es-CL")}`, 40, 82);

  // Summary boxes
  const totals = report.totals;
  const summary = [
    { label: "Tablas OK", value: totals.ok, color: [34, 197, 94] as [number, number, number] },
    { label: "Vacías", value: totals.empty, color: [148, 163, 184] as [number, number, number] },
    { label: "Warnings", value: totals.warn, color: [245, 158, 11] as [number, number, number] },
    { label: "Errores", value: totals.error, color: [239, 68, 68] as [number, number, number] },
    {
      label: "Filas totales",
      value: totals.rows.toLocaleString(),
      color: [6, 182, 212] as [number, number, number],
    },
  ];

  const boxW = (pageWidth - 80 - 4 * 8) / 5;
  const boxY = 100;
  summary.forEach((s, i) => {
    const x = 40 + i * (boxW + 8);
    doc.setDrawColor(s.color[0], s.color[1], s.color[2]);
    doc.setFillColor(s.color[0], s.color[1], s.color[2]);
    doc.setGState(doc.GState({ opacity: 0.1 }));
    doc.rect(x, boxY, boxW, 50, "F");
    doc.setGState(doc.GState({ opacity: 1 }));
    doc.rect(x, boxY, boxW, 50, "S");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(s.label.toUpperCase(), x + 8, boxY + 16);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(s.color[0], s.color[1], s.color[2]);
    doc.text(String(s.value), x + 8, boxY + 38);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
  });

  // Inconsistencies table
  let cursorY = boxY + 70;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Inconsistencias (${report.inconsistencies.length})`, 40, cursorY);
  cursorY += 8;

  if (report.inconsistencies.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120);
    doc.text("Sin inconsistencias detectadas.", 40, cursorY + 14);
    doc.setTextColor(0);
    cursorY += 30;
  } else {
    autoTable(doc, {
      startY: cursorY + 4,
      head: [["Sev", "Cat", "Tabla", "Regla", "Filas", "Detalle"]],
      body: report.inconsistencies.map((i) => [
        i.severity.toUpperCase(),
        i.category ?? "—",
        i.table,
        i.rule,
        String(i.count),
        i.detail,
      ]),
      styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 36 },
        2: { cellWidth: 90 },
        3: { cellWidth: 110 },
        4: { cellWidth: 36, halign: "right" },
        5: { cellWidth: "auto" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const sev = String(data.cell.raw).toLowerCase();
          if (sev === "error") data.cell.styles.textColor = [239, 68, 68];
          else if (sev === "warn") data.cell.styles.textColor = [245, 158, 11];
          else data.cell.styles.textColor = [6, 182, 212];
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: 40, right: 40 },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  }

  // Tables grouped
  if (cursorY > 700) {
    doc.addPage();
    cursorY = 50;
  }
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(`Estado por tabla (${report.tables.length})`, 40, cursorY);

  const tableBody = report.tables.map((t) => {
    const sync = report.lastSync[t.table];
    const delta = sync
      ? sync.delta === 0
        ? "±0"
        : sync.delta > 0
          ? `+${sync.delta}`
          : String(sync.delta)
      : "—";
    return [
      t.group,
      t.table,
      t.label,
      t.count.toLocaleString(),
      t.status.toUpperCase(),
      t.expectedMin ? String(t.expectedMin) : "—",
      delta,
    ];
  });

  autoTable(doc, {
    startY: cursorY + 8,
    head: [["Grupo", "Tabla", "Label", "Filas", "Estado", "Min", "Δ Sync"]],
    body: tableBody,
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: {
      3: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const st = String(data.cell.raw).toLowerCase();
        if (st === "ok") data.cell.styles.textColor = [34, 197, 94];
        else if (st === "warn") data.cell.styles.textColor = [245, 158, 11];
        else if (st === "error") data.cell.styles.textColor = [239, 68, 68];
        else data.cell.styles.textColor = [120, 120, 120];
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 40, right: 40 },
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${p}/${pageCount} · Validación de datos`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" },
    );
  }

  import("@/lib/documents/pdf").then(({ triggerPdfDownload }) =>
    triggerPdfDownload(
      doc.output("blob"),
      `validacion-${projectName.replace(/\s+/g, "_")}-${ts()}.pdf`,
    ),
  );
}
