import type { GeneratedDoc } from "./model";
import logoMark from "@/assets/geocapitals-mark.png";
import { verifyDocUrl } from "@/lib/publicUrl";

// Renderer PDF con branding Geocapitals: cabecera institucional con marca,
// acento oro, tipografía Helvetica, QR de validación y disclaimer al pie.
// Client-only (import dinámico de jsPDF, autotable y qrcode).

const GOLD: [number, number, number] = [206, 168, 76];
const INK: [number, number, number] = [20, 20, 24];
const MUTED: [number, number, number] = [110, 110, 120];
const HAIRLINE: [number, number, number] = [220, 220, 225];

export type EmitterSignature = {
  /** Nombre visible del firmante (razón social o persona). */
  name: string;
  /** Email o identificador del usuario logueado (aparece bajo la firma). */
  email?: string;
  /** ISO timestamp de la firma electrónica. */
  signedAt: string;
  /** Hash corto (evidencia de integridad). */
  hash?: string;
  /**
   * Índice del slot de firma que corresponde al emisor.
   * Por defecto 0 (primera parte listada en el bloque de firma).
   */
  partyIndex?: number;
};

export type RenderOptions = {
  emitterSignature?: EmitterSignature;
};

/**
 * Carga el logo (mark 1024×1024) como dataURL para máxima nitidez en el PDF.
 * El PNG local se sirve por Vite en dev y se inlinea en prod.
 */
async function loadMark(): Promise<{ dataUrl: string; ratio: number } | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("logo"));
      img.src = logoMark;
    });
    const canvas = document.createElement("canvas");
    // Renderizamos a 512px máx — más que suficiente para el tamaño de estampa (32-36pt).
    const maxW = 512;
    const scale = Math.min(1, maxW / img.naturalWidth);
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return {
      dataUrl: canvas.toDataURL("image/png"),
      ratio: img.naturalWidth / img.naturalHeight,
    };
  } catch {
    return null;
  }
}

async function makeQr(url: string): Promise<string | null> {
  try {
    const QR = await import("qrcode");
    return await QR.toDataURL(url, {
      margin: 1,
      width: 320,
      color: { dark: "#141418", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  } catch {
    return null;
  }
}

export async function renderGeocapitalsPdf(
  doc: GeneratedDoc,
  opts: RenderOptions = {},
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 48;
  const contentW = pageW - marginX * 2;

  const verify = verifyDocUrl(doc.reference);
  const [mark, qrDataUrl] = await Promise.all([loadMark(), makeQr(verify)]);

  // ─── Cabecera institucional ───
  pdf.setFillColor(...INK);
  pdf.rect(0, 0, pageW, 6, "F");
  pdf.setFillColor(...GOLD);
  pdf.rect(0, 6, pageW * 0.22, 2, "F");

  const headerTop = 36;
  const markH = 34; // más grande y con margen respirable
  if (mark) {
    const markW = markH * mark.ratio;
    pdf.addImage(mark.dataUrl, "PNG", marginX, headerTop, markW, markH, undefined, "FAST");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(...INK);
    pdf.text("GEOCAPITALS", marginX + markW + 14, headerTop + 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text("Mining · Deals · Documentation", marginX + markW + 14, headerTop + 26);
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(...INK);
    pdf.text("GEOCAPITALS", marginX, headerTop + 16);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text("Mining · Deals · Documentation", marginX, headerTop + 28);
  }

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

  let y = headerTop + markH + 18;
  pdf.setDrawColor(...HAIRLINE);
  pdf.setLineWidth(0.5);
  pdf.line(marginX, y, pageW - marginX, y);
  y += 26;

  // ─── Título con QR de validación ───
  pdf.setDrawColor(...GOLD);
  pdf.setLineWidth(1.2);
  pdf.line(marginX, y - 14, marginX + 44, y - 14);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(...INK);
  const titleLines = pdf.splitTextToSize(doc.title, contentW - 110) as string[];
  pdf.text(titleLines, marginX, y);

  if (qrDataUrl) {
    const qrSize = 72;
    const qrX = pageW - marginX - qrSize;
    const qrY = y - 16;
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 26, 3, 3, "FD");
    pdf.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize, undefined, "FAST");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.2);
    pdf.setTextColor(...INK);
    pdf.text("VALIDAR EN GEOCAPITALS.COM", qrX + qrSize / 2, qrY + qrSize + 9, {
      align: "center",
    });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.6);
    pdf.setTextColor(...MUTED);
    pdf.text(`/verificar/${doc.reference}`, qrX + qrSize / 2, qrY + qrSize + 17, {
      align: "center",
    });
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
  const emitter = opts.emitterSignature;
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
      const n = block.parties.length;
      const emitterIdx = emitter ? Math.min(Math.max(emitter.partyIndex ?? 0, 0), n - 1) : -1;
      ensure(110);
      y += 30;
      const gap = 24;
      const slotW = n > 1 ? (contentW - gap * (n - 1)) / n : Math.min(280, contentW);

      block.parties.forEach((party, i) => {
        const x = marginX + i * (slotW + gap);
        const isEmitter = i === emitterIdx;

        // Estampa de firma electrónica sobre la línea (si aplica).
        if (isEmitter && emitter) {
          // Firma "manuscrita" — nombre en cursiva grande.
          pdf.setFont("helvetica", "bolditalic");
          pdf.setFontSize(15);
          pdf.setTextColor(...INK);
          const sigName = pdf.splitTextToSize(emitter.name, slotW - 8) as string[];
          pdf.text(sigName[0] ?? emitter.name, x + 4, y - 6);

          // Sello institucional a la derecha del slot.
          pdf.setDrawColor(...GOLD);
          pdf.setLineWidth(0.8);
          pdf.roundedRect(x + slotW - 74, y - 26, 70, 22, 2, 2, "S");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6.2);
          pdf.setTextColor(...GOLD);
          pdf.text("FIRMADO", x + slotW - 39, y - 17, { align: "center" });
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(5.6);
          pdf.setTextColor(...MUTED);
          pdf.text("Geocapitals · Vigente", x + slotW - 39, y - 9, { align: "center" });
        }

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
        const subY = y + 14 + Math.min(partyLines.length, 2) * 10 + 2;

        if (isEmitter && emitter) {
          const when = new Date(emitter.signedAt);
          const stamp = `${when.toLocaleDateString("es-CL")} · ${when.toLocaleTimeString("es-CL", {
            hour: "2-digit",
            minute: "2-digit",
          })} UTC`;
          pdf.text(`Firmado electrónicamente por ${emitter.email ?? emitter.name}`, x, subY);
          pdf.text(stamp, x, subY + 10);
          if (emitter.hash) {
            pdf.setFontSize(6.5);
            pdf.text(`Hash: ${emitter.hash}`, x, subY + 20);
          }
        } else {
          pdf.text("Nombre, cargo y firma", x, subY);
        }
      });
      y += 60;
    }
  }

  // ─── Footer con disclaimer, mini QR y paginación ───
  const pageCount = (
    pdf as unknown as { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();

  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);

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

    pdf.setDrawColor(...GOLD);
    pdf.setLineWidth(0.8);
    pdf.line(marginX, pageH - 58, marginX + 28, pageH - 58);

    if (qrDataUrl && p === pageCount) {
      const size = 36;
      pdf.addImage(
        qrDataUrl,
        "PNG",
        pageW - marginX - size,
        pageH - 60,
        size,
        size,
        undefined,
        "FAST",
      );
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
    pdf.textWithLink(`Verificación electrónica: ${verify}`, marginX, pageH - 22, { url: verify });

    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(`${p} / ${pageCount}`, pageW - marginX, pageH - 22, { align: "right" });
  }

  pdf.save(`geocapitals-${doc.docType}-${doc.reference}.pdf`);
}
