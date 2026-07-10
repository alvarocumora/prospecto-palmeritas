import type { GeneratedDoc } from "@/lib/tradeDocGen";

// Render del modelo de documento a PDF con jsPDF. Client-only (import dinámico).
// Mantiene el layout simple: cabecera, bloques y pie con disclaimer.

export async function renderTradeDocPdf(doc: GeneratedDoc): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const marginX = 40;
  const contentW = pageW - marginX * 2;
  let y = 48;

  const ensureSpace = (needed: number) => {
    if (y + needed > pdf.internal.pageSize.getHeight() - 60) {
      pdf.addPage();
      y = 48;
    }
  };

  // Cabecera
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(120);
  pdf.text("GEOCAPITALS · TRADE DESK", marginX, y);
  y += 18;
  pdf.setFontSize(15);
  pdf.setTextColor(20);
  pdf.text(doc.title, marginX, y);
  y += 16;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(110);
  pdf.text(
    `Ref: ${doc.reference}    Fecha: ${new Date(doc.date).toLocaleDateString("es-CL")}`,
    marginX,
    y,
  );
  y += 10;
  pdf.setDrawColor(210);
  pdf.line(marginX, y, pageW - marginX, y);
  y += 20;

  for (const block of doc.blocks) {
    if (block.kind === "paragraph") {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(40);
      const lines = pdf.splitTextToSize(block.text, contentW) as string[];
      ensureSpace(lines.length * 13 + 6);
      pdf.text(lines, marginX, y);
      y += lines.length * 13 + 8;
    } else if (block.kind === "clauses") {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(40);
      for (const item of block.items) {
        const lines = pdf.splitTextToSize(item, contentW - 14) as string[];
        ensureSpace(lines.length * 13 + 4);
        pdf.text(lines, marginX + 12, y);
        y += lines.length * 13 + 4;
      }
      y += 6;
    } else if (block.kind === "fields") {
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 3, textColor: 40 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 160, textColor: 90 } },
        body: block.rows.map(([k, v]) => [k, v]),
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    } else if (block.kind === "table") {
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        theme: "striped",
        headStyles: { fillColor: [30, 30, 30], fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 4 },
        head: [block.head],
        body: block.rows,
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    } else if (block.kind === "signature") {
      ensureSpace(70);
      y += 24;
      const slotW = block.parties.length > 1 ? (contentW - 20) / block.parties.length : 220;
      block.parties.forEach((party, idx) => {
        const x = marginX + idx * (slotW + 20);
        pdf.setDrawColor(120);
        pdf.line(x, y, x + slotW, y);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(90);
        pdf.text(`${party} — Nombre, cargo y firma`, x, y + 12);
      });
      y += 30;
    }
  }

  // Pie con disclaimer
  const pageCount = (
    pdf as unknown as { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7);
    pdf.setTextColor(150);
    pdf.text(
      "Documento generado por Geocapitals Trade Desk como borrador editable. No constituye asesoría legal ni instrumento financiero; validar con las contrapartes y sus asesores.",
      marginX,
      pdf.internal.pageSize.getHeight() - 30,
      { maxWidth: contentW },
    );
  }

  pdf.save(`${doc.docType}-${doc.reference}.pdf`);
}
