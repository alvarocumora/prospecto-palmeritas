import type { GeneratedDoc } from "./model";

// Renderer PDF con branding Geocapitals: cabecera con marca, acento oro,
// tipografía Helvetica y disclaimer al pie. Client-only (import dinámico).

const GOLD: [number, number, number] = [206, 168, 76]; // ~oklch(0.78 0.14 82)
const INK: [number, number, number] = [20, 20, 24];
const MUTED: [number, number, number] = [110, 110, 120];

export async function renderGeocapitalsPdf(doc: GeneratedDoc): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 48;
  const contentW = pageW - marginX * 2;
  let y = 56;

  const ensure = (needed: number) => {
    if (y + needed > pageH - 72) {
      pdf.addPage();
      y = 56;
    }
  };

  // ─── Cabecera con branding ───
  pdf.setFillColor(...INK);
  pdf.rect(0, 0, pageW, 4, "F");
  pdf.setFillColor(...GOLD);
  pdf.rect(0, 4, pageW * 0.18, 2, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  pdf.text("GEOCAPITALS", marginX, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  pdf.text("Mining · Deals · Documentation", marginX + 84, y);

  const refText = `Ref: ${doc.reference}`;
  const dateText = new Date(doc.date).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  pdf.setFontSize(8);
  pdf.text(refText, pageW - marginX, y - 4, { align: "right" });
  pdf.text(dateText, pageW - marginX, y + 8, { align: "right" });

  y += 24;
  pdf.setDrawColor(...GOLD);
  pdf.setLineWidth(1);
  pdf.line(marginX, y, marginX + 40, y);
  y += 20;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.setTextColor(...INK);
  const titleLines = pdf.splitTextToSize(doc.title, contentW) as string[];
  pdf.text(titleLines, marginX, y);
  y += titleLines.length * 20 + 8;

  pdf.setDrawColor(220, 220, 225);
  pdf.setLineWidth(0.5);
  pdf.line(marginX, y, pageW - marginX, y);
  y += 20;

  // ─── Bloques ───
  for (const block of doc.blocks) {
    if (block.kind === "paragraph") {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10.5);
      pdf.setTextColor(40, 40, 48);
      const lines = pdf.splitTextToSize(block.text, contentW) as string[];
      ensure(lines.length * 14 + 8);
      pdf.text(lines, marginX, y);
      y += lines.length * 14 + 12;
    } else if (block.kind === "clauses") {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(40, 40, 48);
      for (const item of block.items) {
        const lines = pdf.splitTextToSize(item, contentW - 14) as string[];
        ensure(lines.length * 13 + 6);
        pdf.setFillColor(...GOLD);
        pdf.circle(marginX + 3, y - 3, 1.4, "F");
        pdf.text(lines, marginX + 14, y);
        y += lines.length * 13 + 6;
      }
      y += 4;
    } else if (block.kind === "fields") {
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 4, textColor: [40, 40, 48] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 170, textColor: MUTED },
        },
        body: block.rows.map(([k, v]) => [k, v]),
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    } else if (block.kind === "table") {
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        theme: "grid",
        headStyles: { fillColor: INK, textColor: [255, 255, 255], fontSize: 9.5 },
        styles: { fontSize: 9.5, cellPadding: 5, textColor: [40, 40, 48] },
        head: [block.head],
        body: block.rows,
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    } else if (block.kind === "signature") {
      ensure(80);
      y += 28;
      const slotW = block.parties.length > 1 ? (contentW - 24) / block.parties.length : 240;
      block.parties.forEach((party, i) => {
        const x = marginX + i * (slotW + 24);
        pdf.setDrawColor(100, 100, 110);
        pdf.setLineWidth(0.5);
        pdf.line(x, y, x + slotW, y);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(...INK);
        pdf.text(party, x, y + 14);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(...MUTED);
        pdf.text("Nombre, cargo y firma", x, y + 26);
      });
      y += 40;
    }
  }

  // ─── Footer con disclaimer y paginación ───
  const pageCount = (
    pdf as unknown as { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(...GOLD);
    pdf.setLineWidth(0.7);
    pdf.line(marginX, pageH - 48, marginX + 24, pageH - 48);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(
      "Documento generado por Geocapitals como borrador editable. No constituye asesoría legal ni oferta financiera. Validar con las contrapartes y sus asesores antes de firmar.",
      marginX,
      pageH - 34,
      { maxWidth: contentW - 60 },
    );
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`${p} / ${pageCount}`, pageW - marginX, pageH - 34, { align: "right" });
  }

  pdf.save(`geocapitals-${doc.docType}-${doc.reference}.pdf`);
}
