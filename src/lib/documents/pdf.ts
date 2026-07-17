import type { GeneratedDoc } from "./model";
import logoUrl from "@/assets/geocapitals-logo.png";
import { publicUrl } from "@/lib/publicUrl";

// Renderer PDF con branding Geocapitals: cabecera institucional con marca,
// acento oro, tipografía Helvetica, QR de validación y disclaimer al pie.
// Client-only (import dinámico de jsPDF, autotable y qrcode).

const GOLD: [number, number, number] = [206, 168, 76]; // ~oklch(0.78 0.14 82)
const INK: [number, number, number] = [20, 20, 24];
const MUTED: [number, number, number] = [110, 110, 120];
const HAIRLINE: [number, number, number] = [220, 220, 225];

/** Carga el logo como dataURL PNG con su relación de aspecto; null si falla. */
async function loadLogo(): Promise<{ dataUrl: string; ratio: number } | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("logo"));
      img.src = logoUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return { dataUrl: canvas.toDataURL("image/png"), ratio: img.naturalWidth / img.naturalHeight };
  } catch {
    return null;
  }
}

/** Genera un QR PNG como dataURL apuntando al link de verificación. */
async function makeQr(url: string): Promise<string | null> {
  try {
    const QR = await import("qrcode");
    return await QR.toDataURL(url, {
      margin: 1,
      width: 260,
      color: { dark: "#141418", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}

export async function renderGeocapitalsPdf(doc: GeneratedDoc): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 48;
  const contentW = pageW - marginX * 2;

  const verifyUrl = publicUrl(`/dashboard/documentos/${doc.docType}?ref=${doc.reference}`);
  const [logo, qrDataUrl] = await Promise.all([loadLogo(), makeQr(verifyUrl)]);

  // ─── Cabecera institucional (banda superior + marca + QR) ───
  // Banda tinta con acento oro
  pdf.setFillColor(...INK);
  pdf.rect(0, 0, pageW, 6, "F");
  pdf.setFillColor(...GOLD);
  pdf.rect(0, 6, pageW * 0.22, 2, "F");

  const headerTop = 34;
  const logoH = 30;
  if (logo) {
    const logoW = logoH * logo.ratio;
    pdf.addImage(logo.dataUrl, "PNG", marginX, headerTop, logoW, logoH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...INK);
    pdf.text("GEOCAPITALS", marginX + logoW + 12, headerTop + 13);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text("Mining · Deals · Documentation", marginX + logoW + 12, headerTop + 24);
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(...INK);
    pdf.text("GEOCAPITALS", marginX, headerTop + 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text("Mining · Deals · Documentation", marginX, headerTop + 26);
  }

  // Meta a la derecha
  const dateText = new Date(doc.date).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...INK);
  pdf.text(`Ref  ${doc.reference}`, pageW - marginX, headerTop + 4, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...MUTED);
  pdf.text(dateText, pageW - marginX, headerTop + 16, { align: "right" });
  pdf.text("Documento oficial · Geocapitals", pageW - marginX, headerTop + 27, { align: "right" });

  // Línea inferior de cabecera
  let y = headerTop + logoH + 14;
  pdf.setDrawColor(...HAIRLINE);
  pdf.setLineWidth(0.5);
  pdf.line(marginX, y, pageW - marginX, y);
  y += 26;

  // ─── Título ───
  pdf.setDrawColor(...GOLD);
  pdf.setLineWidth(1.2);
  pdf.line(marginX, y - 14, marginX + 44, y - 14);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(...INK);
  const titleLines = pdf.splitTextToSize(doc.title, contentW - 110) as string[];
  pdf.text(titleLines, marginX, y);

  // QR de validación en esquina superior derecha del cuerpo
  if (qrDataUrl) {
    const qrSize = 70;
    const qrX = pageW - marginX - qrSize;
    const qrY = y - 16;
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.5);
    pdf.rect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 20, "FD");
    pdf.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...INK);
    pdf.text("VALIDAR DOCUMENTO", qrX + qrSize / 2, qrY + qrSize + 9, { align: "center" });
  }

  y += titleLines.length * 20 + 12;
  pdf.setDrawColor(...HAIRLINE);
  pdf.setLineWidth(0.5);
  pdf.line(marginX, y, pageW - marginX, y);
  y += 22;

  const ensure = (needed: number) => {
    if (y + needed > pageH - 92) {
      pdf.addPage();
      y = 60;
    }
  };

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
        const lines = pdf.splitTextToSize(item, contentW - 16) as string[];
        ensure(lines.length * 13 + 6);
        pdf.setFillColor(...GOLD);
        pdf.circle(marginX + 3, y - 3, 1.6, "F");
        pdf.text(lines, marginX + 16, y);
        y += lines.length * 13 + 6;
      }
      y += 4;
    } else if (block.kind === "fields") {
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 5, textColor: [40, 40, 48] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 170, textColor: MUTED },
        },
        body: block.rows.map(([k, v]) => [k, v]),
        alternateRowStyles: { fillColor: [248, 246, 240] },
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
      ensure(90);
      y += 30;
      const gap = 24;
      const n = block.parties.length;
      const slotW = n > 1 ? (contentW - gap * (n - 1)) / n : Math.min(260, contentW);
      block.parties.forEach((party, i) => {
        const x = marginX + i * (slotW + gap);
        pdf.setDrawColor(80, 80, 90);
        pdf.setLineWidth(0.6);
        pdf.line(x, y, x + slotW, y);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(...INK);
        const partyLines = pdf.splitTextToSize(party, slotW) as string[];
        pdf.text(partyLines.slice(0, 2), x, y + 14);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(...MUTED);
        pdf.text(
          "Nombre, cargo y firma",
          x,
          y + 14 + Math.min(partyLines.length, 2) * 10 + 2,
        );
      });
      y += 46;
    }
  }

  // ─── Footer con disclaimer, QR mini y paginación ───
  const pageCount = (
    pdf as unknown as { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();

  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);

    // Banda superior de continuidad (páginas > 1)
    if (p > 1) {
      pdf.setFillColor(...INK);
      pdf.rect(0, 0, pageW, 4, "F");
      pdf.setFillColor(...GOLD);
      pdf.rect(0, 4, pageW * 0.14, 1.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...MUTED);
      pdf.text(`GEOCAPITALS · ${doc.reference}`, marginX, 24);
    }

    // Franja de pie
    pdf.setDrawColor(...GOLD);
    pdf.setLineWidth(0.8);
    pdf.line(marginX, pageH - 58, marginX + 28, pageH - 58);

    // Mini QR en el pie (última página)
    if (qrDataUrl && p === pageCount) {
      const size = 34;
      pdf.addImage(qrDataUrl, "PNG", pageW - marginX - size, pageH - 58, size, size);
    }

    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(
      "Documento generado por Geocapitals como borrador editable. No constituye asesoría legal ni oferta financiera. Validar con las contrapartes y sus asesores antes de firmar.",
      marginX,
      pageH - 44,
      { maxWidth: contentW - (p === pageCount ? 60 : 0) },
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...INK);
    pdf.textWithLink(
      `Verificación electrónica: ${verifyUrl}`,
      marginX,
      pageH - 22,
      { url: verifyUrl },
    );

    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(`${p} / ${pageCount}`, pageW - marginX, pageH - 22, { align: "right" });
  }

  pdf.save(`geocapitals-${doc.docType}-${doc.reference}.pdf`);
}
