import type { GeneratedDoc } from "./model";
import logoMark from "@/assets/geocapitals-mark.png";
import { verifyDocUrl } from "@/lib/publicUrl";

// Renderer PDF — identidad Institutional Modernist (papel hueso + tinta +
// cobalto), alineado a la landing/plataforma. Cabecera con logo + QR de
// validación, bloque de firma sin solape y sello electrónico del emisor,
// pie institucional con contacto (email + WhatsApp).
//
// Client-only (importa jsPDF / autotable / qrcode de forma dinámica).

// ─────────────────────── Paleta (alineada a src/styles.css) ───────────────────────
const PAPER: [number, number, number] = [247, 245, 240]; // #F7F5F0 papel hueso
const INK: [number, number, number] = [26, 26, 46]; // #1A1A2E tinta
const INK_SOFT: [number, number, number] = [74, 74, 94]; // texto secundario
const GRAY: [number, number, number] = [107, 107, 123]; // hints / footer
const COBALT: [number, number, number] = [43, 74, 203]; // #2B4ACB acento marca
const COBALT_DEEP: [number, number, number] = [34, 60, 166]; // hover / borde sello
const HAIRLINE: [number, number, number] = [217, 212, 199]; // línea sobre papel
const WHITE: [number, number, number] = [255, 255, 255];

// ─────────────────────── Contacto institucional ───────────────────────
const CONTACT = {
  email: "info@geocapitals.com",
  whatsapp: "+56 9 6218 4071",
  site: "geocapitals.com",
};

export type EmitterSignature = {
  name: string;
  email?: string;
  signedAt: string;
  hash?: string;
  partyIndex?: number;
};

export type RenderOptions = {
  /** Firma del emisor (compat previa — party 0 por defecto). */
  emitterSignature?: EmitterSignature;
  /** Múltiples firmas estampadas sobre los slots correspondientes. */
  signatures?: EmitterSignature[];
};

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
      width: 360,
      color: { dark: "#1A1A2E", light: "#F7F5F0" },
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

  // Normaliza firmas: soporta `emitterSignature` (single) y `signatures` (array).
  const stamps: EmitterSignature[] = [
    ...(opts.emitterSignature ? [opts.emitterSignature] : []),
    ...(opts.signatures ?? []),
  ];
  const stampByIndex = new Map<number, EmitterSignature>();
  stamps.forEach((s) => stampByIndex.set(s.partyIndex ?? 0, s));

  // Pinta el "papel" de página completa.
  const paintPaper = () => {
    pdf.setFillColor(...PAPER);
    pdf.rect(0, 0, pageW, pageH, "F");
    // Banda superior institucional.
    pdf.setFillColor(...INK);
    pdf.rect(0, 0, pageW, 6, "F");
    pdf.setFillColor(...COBALT);
    pdf.rect(0, 6, pageW * 0.26, 2, "F");
    // Marca de agua diagonal tenue (identidad unificada).
    pdf.saveGraphicsState();
    // @ts-expect-error jsPDF GState typing incomplete
    pdf.setGState(new (pdf as any).GState({ opacity: 0.045 }));
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(96);
    pdf.setTextColor(...COBALT);
    pdf.text("GEOCAPITALS", pageW / 2, pageH / 2, {
      align: "center",
      angle: 32,
    });
    pdf.restoreGraphicsState();
  };
  paintPaper();

  // ─── Cabecera institucional ───
  const headerTop = 30;
  const qrHeaderSize = 62;
  const qrHeaderX = pageW - marginX - qrHeaderSize;
  const qrHeaderY = headerTop;
  const rightBlockW = qrHeaderSize + 12; // ancho reservado a la derecha para no pisar el título

  const markH = 40;
  let brandX = marginX;
  if (mark) {
    const markW = markH * mark.ratio;
    pdf.addImage(mark.dataUrl, "PNG", marginX, headerTop, markW, markH, undefined, "FAST");
    brandX = marginX + markW + 14;
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...INK);
  pdf.text("GEOCAPITALS", brandX, headerTop + 16);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COBALT);
  pdf.text("MINING INTELLIGENCE · DEALS · DOCUMENTATION", brandX, headerTop + 27);
  pdf.setTextColor(...GRAY);
  pdf.text(`${CONTACT.site} · ${CONTACT.email}`, brandX, headerTop + 38);

  // QR de validación en cabecera (con etiqueta).
  if (qrDataUrl) {
    pdf.setFillColor(...WHITE);
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(
      qrHeaderX - 4,
      qrHeaderY - 4,
      qrHeaderSize + 8,
      qrHeaderSize + 22,
      3,
      3,
      "FD",
    );
    pdf.addImage(
      qrDataUrl,
      "PNG",
      qrHeaderX,
      qrHeaderY,
      qrHeaderSize,
      qrHeaderSize,
      undefined,
      "FAST",
    );
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.setTextColor(...COBALT);
    pdf.text("VALIDAR EN GEOCAPITALS", qrHeaderX + qrHeaderSize / 2, qrHeaderY + qrHeaderSize + 8, {
      align: "center",
    });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.4);
    pdf.setTextColor(...GRAY);
    pdf.text(`/verificar/${doc.reference}`, qrHeaderX + qrHeaderSize / 2, qrHeaderY + qrHeaderSize + 15, {
      align: "center",
    });
  }

  let y = Math.max(headerTop + markH + 24, qrHeaderY + qrHeaderSize + 26);
  pdf.setDrawColor(...HAIRLINE);
  pdf.setLineWidth(0.5);
  pdf.line(marginX, y, pageW - marginX, y);
  y += 8;

  // ─── Meta (ref + fecha) alineada bajo la línea, a la izquierda ───
  const dateText = new Date(doc.date).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COBALT);
  pdf.text(`REF · ${doc.reference}`, marginX, y + 12);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...GRAY);
  pdf.text(dateText.toUpperCase(), pageW - marginX, y + 12, { align: "right" });
  y += 32;

  // ─── Título ───
  pdf.setDrawColor(...COBALT);
  pdf.setLineWidth(2);
  pdf.line(marginX, y - 14, marginX + 42, y - 14);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(...INK);
  const titleMaxW = contentW - rightBlockW; // reservar espacio del bloque derecho (QR)
  const titleLines = pdf.splitTextToSize(doc.title, titleMaxW) as string[];
  pdf.text(titleLines, marginX, y);
  y += titleLines.length * 22 + 8;

  pdf.setDrawColor(...HAIRLINE);
  pdf.setLineWidth(0.5);
  pdf.line(marginX, y, pageW - marginX, y);
  y += 22;

  const ensure = (needed: number) => {
    if (y + needed > pageH - 108) {
      pdf.addPage();
      paintPaper();
      y = 60;
    }
  };

  // ─── Bloques ───
  for (const block of doc.blocks) {
    if (block.kind === "paragraph") {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10.5);
      pdf.setTextColor(...INK_SOFT);
      const lines = pdf.splitTextToSize(block.text, contentW) as string[];
      ensure(lines.length * 14 + 8);
      pdf.text(lines, marginX, y);
      y += lines.length * 14 + 12;
    } else if (block.kind === "clauses") {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...INK_SOFT);
      for (const item of block.items) {
        const lines = pdf.splitTextToSize(item, contentW - 18) as string[];
        ensure(lines.length * 13 + 6);
        pdf.setFillColor(...COBALT);
        pdf.rect(marginX, y - 6, 2, 8, "F");
        pdf.text(lines, marginX + 12, y);
        y += lines.length * 13 + 6;
      }
      y += 4;
    } else if (block.kind === "fields") {
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        theme: "plain",
        styles: {
          fontSize: 10,
          cellPadding: 6,
          textColor: INK,
          lineColor: HAIRLINE,
        },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 170, textColor: COBALT },
        },
        body: block.rows.map(([k, v]) => [k, v]),
        alternateRowStyles: { fillColor: [239, 235, 225] },
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    } else if (block.kind === "table") {
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        theme: "grid",
        headStyles: { fillColor: INK, textColor: WHITE, fontSize: 9.5 },
        styles: { fontSize: 9.5, cellPadding: 5, textColor: INK, lineColor: HAIRLINE },
        head: [block.head],
        body: block.rows,
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    } else if (block.kind === "signature") {
      const n = block.parties.length;
      const gap = 28;
      const slotW = n > 1 ? (contentW - gap * (n - 1)) / n : Math.min(300, contentW);

      // Reservar altura suficiente para sello + nombre + subrayado + meta.
      ensure(140);
      y += 46; // aire para la cursiva por encima de la línea

      block.parties.forEach((party, i) => {
        const x = marginX + i * (slotW + gap);
        const stamp = stampByIndex.get(i);

        // Sello del emisor — firma cursiva sobre la línea + badge cobalto.
        if (stamp) {
          // Firma "manuscrita" — cursiva bold sobre la línea, wrapped al slot.
          pdf.setFont("helvetica", "bolditalic");
          pdf.setFontSize(16);
          pdf.setTextColor(...INK);
          const sigLines = pdf.splitTextToSize(stamp.name, slotW - 80) as string[];
          pdf.text(sigLines[0] ?? stamp.name, x + 6, y - 6);

          // Badge institucional a la derecha.
          const bw = 70;
          const bh = 22;
          const bx = x + slotW - bw;
          const by = y - 30;
          pdf.setDrawColor(...COBALT_DEEP);
          pdf.setLineWidth(0.8);
          pdf.setFillColor(...WHITE);
          pdf.roundedRect(bx, by, bw, bh, 2, 2, "FD");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6.2);
          pdf.setTextColor(...COBALT);
          pdf.text("FIRMADO", bx + bw / 2, by + 9, { align: "center" });
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(5.4);
          pdf.setTextColor(...GRAY);
          pdf.text("Geocapitals · Vigente", bx + bw / 2, by + 17, { align: "center" });
        }

        // Línea de firma.
        pdf.setDrawColor(...INK);
        pdf.setLineWidth(0.7);
        pdf.line(x, y, x + slotW, y);

        // Nombre de la parte — wrap correcto, hasta 3 líneas con elipsis.
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(...INK);
        const partyLines = pdf.splitTextToSize(party, slotW - 4) as string[];
        const shown = partyLines.slice(0, 3);
        if (partyLines.length > 3) shown[2] = shown[2].replace(/.{0,3}$/, "…");
        shown.forEach((ln, li) => {
          pdf.text(ln, x, y + 12 + li * 11);
        });
        const subY = y + 12 + shown.length * 11 + 2;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(...GRAY);
        if (stamp) {
          const when = new Date(stamp.signedAt);
          const stampTxt = `${when.toLocaleDateString("es-CL")} · ${when.toLocaleTimeString("es-CL", {
            hour: "2-digit",
            minute: "2-digit",
          })} UTC`;
          pdf.text(`Firmado electrónicamente por ${stamp.email ?? stamp.name}`, x, subY);
          pdf.text(stampTxt, x, subY + 10);
          if (stamp.hash) {
            pdf.setFontSize(6.6);
            pdf.text(`Hash: ${stamp.hash}`, x, subY + 19);
          }
        } else {
          pdf.text("Nombre, cargo y firma", x, subY);
        }
      });
      // Avanzar y — considerando slots con hasta 3 líneas.
      y += 60;
    }
  }

  // ─── Footer institucional ───
  const pageCount = (
    pdf as unknown as { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();

  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);

    // Encabezado breve en páginas > 1.
    if (p > 1) {
      pdf.setFillColor(...INK);
      pdf.rect(0, 0, pageW, 4, "F");
      pdf.setFillColor(...COBALT);
      pdf.rect(0, 4, pageW * 0.18, 1.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...INK);
      pdf.text("GEOCAPITALS", marginX, 22);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...GRAY);
      pdf.text(`Ref · ${doc.reference}`, pageW - marginX, 22, { align: "right" });
    }

    // Línea cobalto + footer de dos columnas.
    const footY = pageH - 66;
    pdf.setDrawColor(...COBALT);
    pdf.setLineWidth(1.2);
    pdf.line(marginX, footY, marginX + 36, footY);
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.5);
    pdf.line(marginX + 40, footY, pageW - marginX, footY);

    // Columna izquierda — marca + disclaimer.
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...INK);
    pdf.text("GEOCAPITALS · Mining Intelligence", marginX, footY + 12);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...GRAY);
    pdf.text(
      "Documento generado como borrador editable. No constituye asesoría legal ni oferta financiera. Validar con las contrapartes antes de firmar.",
      marginX,
      footY + 22,
      { maxWidth: (pageW - marginX * 2) * 0.6 },
    );

    // Columna derecha — contacto + verificación.
    const rightCol = pageW - marginX;
    const miniQrSize = 34;
    const miniQrX = rightCol - miniQrSize;
    const miniQrY = footY + 6;
    let contactRight = rightCol;
    if (qrDataUrl && p === pageCount) {
      pdf.addImage(qrDataUrl, "PNG", miniQrX, miniQrY, miniQrSize, miniQrSize, undefined, "FAST");
      contactRight = miniQrX - 8;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...INK);
    pdf.text(CONTACT.email, contactRight, footY + 12, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...GRAY);
    pdf.text(`WhatsApp ${CONTACT.whatsapp}`, contactRight, footY + 22, { align: "right" });
    pdf.setTextColor(...COBALT);
    pdf.textWithLink(`geocapitals.com/verificar/${doc.reference}`, contactRight, footY + 32, {
      align: "right",
      url: verify,
    });

    // Paginación.
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...GRAY);
    pdf.text(`Página ${p} / ${pageCount}`, marginX, pageH - 22);
  }

  pdf.save(`geocapitals-${doc.docType}-${doc.reference}.pdf`);
}
