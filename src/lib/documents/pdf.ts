import type { GeneratedDoc } from "./model";
import logoMark from "@/assets/geocapitals-mark.png";
import { verifyDocUrl } from "@/lib/publicUrl";

// Renderer PDF — identidad Institutional Modernist (papel hueso + tinta +
// cobalto). La maquetación usa zonas seguras, wrapping y paginación manual para
// que títulos, tablas, QR, footer y firmas no se monten ni corten texto.
// Client-only: importa jsPDF / autotable / qrcode de forma dinámica.

const PAPER: [number, number, number] = [247, 245, 240];
const PAPER_ALT: [number, number, number] = [239, 235, 225];
const INK: [number, number, number] = [26, 26, 46];
const INK_SOFT: [number, number, number] = [74, 74, 94];
const GRAY: [number, number, number] = [107, 107, 123];
const COBALT: [number, number, number] = [43, 74, 203];
const COBALT_DEEP: [number, number, number] = [34, 60, 166];
const HAIRLINE: [number, number, number] = [217, 212, 199];
const WHITE: [number, number, number] = [255, 255, 255];

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
  emitterSignature?: EmitterSignature;
  signatures?: EmitterSignature[];
};

type JsPdfLike = {
  GState: new (o: { opacity: number }) => unknown;
  setGState: (g: unknown) => void;
  internal: { getNumberOfPages: () => number };
  lastAutoTable?: { finalY: number };
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
    const maxW = 640;
    const scale = Math.min(1, maxW / img.naturalWidth);
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/png"), ratio: img.naturalWidth / img.naturalHeight };
  } catch {
    return null;
  }
}

async function makeQr(url: string): Promise<string | null> {
  try {
    const QR = await import("qrcode");
    return await QR.toDataURL(url, {
      margin: 1,
      width: 420,
      color: { dark: "#1A1A2E", light: "#F7F5F0" },
      errorCorrectionLevel: "M",
    });
  } catch {
    return null;
  }
}

function clampText(text: string, max = 1200): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function ellipsize(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
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
  const footerReserve = 118;
  const firstTopY = 138;
  const pageTopY = 64;
  const safeBottom = pageH - footerReserve;
  const verify = verifyDocUrl(doc.reference);
  const [mark, qrDataUrl] = await Promise.all([loadMark(), makeQr(verify)]);

  const stamps = [
    ...(opts.emitterSignature ? [opts.emitterSignature] : []),
    ...(opts.signatures ?? []),
  ];
  const stampByIndex = new Map<number, EmitterSignature>();
  stamps.forEach((s) => stampByIndex.set(s.partyIndex ?? 0, s));

  const paintPaper = () => {
    pdf.setFillColor(...PAPER);
    pdf.rect(0, 0, pageW, pageH, "F");
    pdf.setFillColor(...INK);
    pdf.rect(0, 0, pageW, 6, "F");
    pdf.setFillColor(...COBALT);
    pdf.rect(0, 6, pageW * 0.26, 2, "F");

    const api = pdf as unknown as JsPdfLike;
    pdf.saveGraphicsState();
    api.setGState(new api.GState({ opacity: 0.035 }));
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(82);
    pdf.setTextColor(...COBALT);
    pdf.text("GEOCAPITALS", pageW / 2, pageH / 2 + 16, { align: "center", angle: 32 });
    pdf.restoreGraphicsState();
  };

  const drawCompactHeader = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...INK);
    pdf.text("GEOCAPITALS", marginX, 28);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...GRAY);
    pdf.text(`Ref · ${doc.reference}`, pageW - marginX, 28, { align: "right" });
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.5);
    pdf.line(marginX, 42, pageW - marginX, 42);
  };

  const addPage = () => {
    pdf.addPage();
    paintPaper();
    drawCompactHeader();
    return pageTopY;
  };

  paintPaper();
  let y = 30;

  const qrHeaderSize = 62;
  const qrHeaderX = pageW - marginX - qrHeaderSize;
  const qrHeaderY = 30;
  let brandX = marginX;
  if (mark) {
    const markH = 38;
    const markW = markH * mark.ratio;
    pdf.addImage(mark.dataUrl, "PNG", marginX, y, markW, markH, undefined, "FAST");
    brandX = marginX + markW + 14;
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...INK);
  pdf.text("GEOCAPITALS", brandX, y + 15);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COBALT);
  pdf.text("MINING INTELLIGENCE · DEALS · DOCUMENTATION", brandX, y + 27);
  pdf.setTextColor(...GRAY);
  pdf.text(`${CONTACT.site} · ${CONTACT.email}`, brandX, y + 38);

  if (qrDataUrl) {
    pdf.setFillColor(...WHITE);
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.5);
    // Caja del QR: alto ajustado a QR + 3 líneas (VALIDAR / EN GEOCAPITALS / ref).
    const qrBoxW = qrHeaderSize + 10;
    const qrCx = qrHeaderX + qrHeaderSize / 2;
    const qrBoxH = qrHeaderSize + 38;
    pdf.roundedRect(qrHeaderX - 5, qrHeaderY - 5, qrBoxW, qrBoxH, 3, 3, "FD");
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
    // Leyenda en 2 líneas fijas para que nunca se solape con la referencia.
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(5.6);
    pdf.setTextColor(...COBALT);
    const legendY = qrHeaderY + qrHeaderSize + 8;
    pdf.text("VALIDAR EN", qrCx, legendY, { align: "center" });
    pdf.text("GEOCAPITALS", qrCx, legendY + 6, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.2);
    pdf.setTextColor(...GRAY);
    pdf.text(ellipsize(doc.reference, 26), qrCx, legendY + 14, {
      align: "center",
      maxWidth: qrBoxW - 6,
    });
  }


  y = firstTopY;
  pdf.setDrawColor(...HAIRLINE);
  pdf.setLineWidth(0.5);
  pdf.line(marginX, y - 16, pageW - marginX, y - 16);

  const dateText = new Date(doc.date).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COBALT);
  pdf.text(`REF · ${doc.reference}`, marginX, y);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...GRAY);
  pdf.text(dateText.toUpperCase(), pageW - marginX, y, { align: "right" });
  y += 26;

  // Barra de acento cobalto ARRIBA del título, con separación clara para que
  // no cruce las mayúsculas.
  pdf.setDrawColor(...COBALT);
  pdf.setLineWidth(2);
  pdf.line(marginX, y, marginX + 42, y);

  pdf.setFont("helvetica", "bold");
  const title = clampText(doc.title, 220);
  const titleFont = title.length > 85 ? 16 : title.length > 55 ? 18 : 20;
  pdf.setFontSize(titleFont);
  pdf.setTextColor(...INK);
  const titleLines = (pdf.splitTextToSize(title, contentW) as string[]).slice(0, 4);
  y += titleFont + 6; // baja el baseline del título bajo la barra de acento
  pdf.text(titleLines, marginX, y);
  y += (titleLines.length - 1) * (titleFont + 4) + 14;
  pdf.setDrawColor(...HAIRLINE);
  pdf.setLineWidth(0.5);
  pdf.line(marginX, y, pageW - marginX, y);
  y += 22;

  const ensure = (needed: number) => {
    if (y + needed > safeBottom) y = addPage();
  };

  const renderLines = (lines: string[], x: number, maxLinesPerPage: number, lineH: number) => {
    let start = 0;
    while (start < lines.length) {
      const availableLines = Math.max(
        1,
        Math.min(maxLinesPerPage, Math.floor((safeBottom - y) / lineH)),
      );
      if (availableLines < 2 && start < lines.length) y = addPage();
      const count = Math.max(
        1,
        Math.min(lines.length - start, Math.floor((safeBottom - y) / lineH)),
      );
      const chunk = lines.slice(start, start + count);
      pdf.text(chunk, x, y);
      y += chunk.length * lineH;
      start += count;
      if (start < lines.length) y = addPage();
    }
  };

  for (const block of doc.blocks) {
    if (block.kind === "paragraph") {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10.3);
      pdf.setTextColor(...INK_SOFT);
      const lines = pdf.splitTextToSize(clampText(block.text, 1800), contentW) as string[];
      ensure(24);
      renderLines(lines, marginX, 34, 13.8);
      y += 12;
    } else if (block.kind === "clauses") {
      const clauseBottom = safeBottom - 170;
      const clauseLineH = 12.8;
      for (const item of block.items) {
        const normalized = clampText(item, 1800);
        const firstDot = normalized.indexOf(". ");
        const heading = firstDot > 0 && firstDot < 80 ? normalized.slice(0, firstDot + 1) : null;
        const body = heading ? normalized.slice(firstDot + 2) : normalized;
        const headingLines = heading
          ? (pdf.splitTextToSize(heading, contentW - 18) as string[])
          : [];
        const bodyLines = pdf.splitTextToSize(body, contentW - 18) as string[];
        const totalLines = headingLines.length + bodyLines.length;
        const itemH = totalLines * clauseLineH + 42;

        if (itemH < clauseBottom - pageTopY && y + itemH > clauseBottom) {
          y = addPage();
        } else if (y > clauseBottom - 120) {
          y = addPage();
        }

        const markerY = y - 7;
        if (heading) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9.6);
          pdf.setTextColor(...INK);
          pdf.text(headingLines, marginX + 12, y);
          y += headingLines.length * clauseLineH;
        }
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.8);
        pdf.setTextColor(...INK_SOFT);
        if (itemH < clauseBottom - pageTopY) {
          pdf.text(bodyLines, marginX + 12, y);
          y += bodyLines.length * clauseLineH;
        } else {
          renderLines(bodyLines, marginX + 12, 34, clauseLineH);
        }
        pdf.setFillColor(...COBALT);
        pdf.rect(marginX, markerY, 2, Math.max(10, Math.min(26, itemH - 6)), "F");
        y += 8;
      }
      y += 2;
    } else if (block.kind === "fields") {
      ensure(40);
      const tableStartPage = pdf.getCurrentPageInfo().pageNumber;
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX, top: pageTopY, bottom: footerReserve },
        theme: "plain",
        pageBreak: "auto",
        rowPageBreak: "avoid",
        styles: {
          fontSize: 9.4,
          cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
          textColor: INK,
          lineColor: HAIRLINE,
          overflow: "linebreak",
          valign: "top",
          minCellHeight: 18,
        },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 135, textColor: COBALT },
          1: { cellWidth: contentW - 135 },
        },
        body: block.rows.map(([k, v]) => [k, ellipsize(v, 520)]),
        alternateRowStyles: { fillColor: PAPER_ALT },
        willDrawPage: ({ pageNumber }: { pageNumber: number }) => {
          if (pageNumber > tableStartPage) {
            paintPaper();
            drawCompactHeader();
          }
        },
      });
      y = ((pdf as unknown as JsPdfLike).lastAutoTable?.finalY ?? y) + 16;
    } else if (block.kind === "table") {
      ensure(48);
      const tableStartPage = pdf.getCurrentPageInfo().pageNumber;
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX, top: pageTopY, bottom: footerReserve },
        theme: "grid",
        pageBreak: "auto",
        rowPageBreak: "avoid",
        headStyles: { fillColor: INK, textColor: WHITE, fontSize: 8.8, cellPadding: 5 },
        styles: {
          fontSize: 8.7,
          cellPadding: 4.5,
          textColor: INK,
          lineColor: HAIRLINE,
          overflow: "linebreak",
          valign: "top",
        },
        head: [block.head],
        body: block.rows.map((row) => row.map((cell) => ellipsize(cell, 320))),
        willDrawPage: ({ pageNumber }: { pageNumber: number }) => {
          if (pageNumber > tableStartPage) {
            paintPaper();
            drawCompactHeader();
          }
        },
      });
      y = ((pdf as unknown as JsPdfLike).lastAutoTable?.finalY ?? y) + 16;
    } else if (block.kind === "signature") {
      const parties = block.parties.length ? block.parties : ["Firmante"];
      const columns = parties.length === 1 ? 1 : Math.min(2, parties.length);
      const gap = 28;
      const slotW = columns === 1 ? Math.min(360, contentW) : (contentW - gap) / 2;
      const slotH = 128;
      const rows = Math.ceil(parties.length / columns);
      ensure(rows * slotH + 20);
      y += 40;

      parties.forEach((party, i) => {
        if (i > 0 && i % columns === 0) y += slotH;
        const col = i % columns;
        const x = columns === 1 ? marginX : marginX + col * (slotW + gap);
        const lineY = y;
        const stamp = stampByIndex.get(i);

        if (stamp) {
          pdf.setFont("helvetica", "bolditalic");
          pdf.setFontSize(stamp.name.length > 42 ? 11.5 : 14.5);
          pdf.setTextColor(...INK);
          const sigLines = (
            pdf.splitTextToSize(ellipsize(stamp.name, 90), slotW - 96) as string[]
          ).slice(0, 2);
          pdf.text(sigLines, x + 6, lineY - 20 - (sigLines.length - 1) * 10);

          const bw = 74;
          const bh = 24;
          const bx = x + slotW - bw;
          const by = lineY - 38;
          pdf.setDrawColor(...COBALT_DEEP);
          pdf.setLineWidth(0.8);
          pdf.setFillColor(...WHITE);
          pdf.roundedRect(bx, by, bw, bh, 2, 2, "FD");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6.2);
          pdf.setTextColor(...COBALT);
          pdf.text("FIRMADO", bx + bw / 2, by + 9.5, { align: "center" });
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(5.3);
          pdf.setTextColor(...GRAY);
          pdf.text("Geocapitals · Vigente", bx + bw / 2, by + 18, { align: "center" });
        }

        pdf.setDrawColor(...INK);
        pdf.setLineWidth(0.7);
        pdf.line(x, lineY, x + slotW, lineY);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.6);
        pdf.setTextColor(...INK);
        const partyLines = (
          pdf.splitTextToSize(ellipsize(party, 190), slotW - 4) as string[]
        ).slice(0, 3);
        partyLines.forEach((ln, li) => pdf.text(ln, x, lineY + 13 + li * 10.5));

        const metaY = lineY + 21 + partyLines.length * 10.5;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.2);
        pdf.setTextColor(...GRAY);
        if (stamp) {
          const when = new Date(stamp.signedAt);
          const signedBy = `Firmado electrónicamente por ${ellipsize(stamp.email ?? stamp.name, 80)}`;
          const signedLines = (pdf.splitTextToSize(signedBy, slotW) as string[]).slice(0, 2);
          pdf.text(signedLines, x, metaY);
          pdf.text(
            `${when.toLocaleDateString("es-CL")} · ${when.toLocaleTimeString("es-CL", {
              hour: "2-digit",
              minute: "2-digit",
            })} UTC`,
            x,
            metaY + signedLines.length * 9.5 + 2,
          );
          if (stamp.hash) {
            pdf.setFontSize(6.5);
            pdf.text(`Hash: ${stamp.hash}`, x, metaY + signedLines.length * 9.5 + 12);
          }
        } else {
          pdf.text("Nombre, cargo y firma", x, metaY);
        }
      });
      y += rows * slotH + 4;
    }
  }

  const pageCount = (pdf as unknown as JsPdfLike).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    const footY = pageH - 68;
    pdf.setDrawColor(...COBALT);
    pdf.setLineWidth(1.2);
    pdf.line(marginX, footY, marginX + 36, footY);
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.5);
    pdf.line(marginX + 40, footY, pageW - marginX, footY);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.4);
    pdf.setTextColor(...INK);
    pdf.text("GEOCAPITALS · Mining Intelligence", marginX, footY + 12);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(6.6);
    pdf.setTextColor(...GRAY);
    pdf.text(
      "Documento generado como borrador editable. No constituye asesoría legal ni oferta financiera. Validar con las contrapartes antes de firmar.",
      marginX,
      footY + 22,
      { maxWidth: contentW * 0.58 },
    );

    const rightCol = pageW - marginX;
    const miniQrSize = 32;
    const miniQrX = rightCol - miniQrSize;
    const miniQrY = footY + 7;
    let contactRight = rightCol;
    if (qrDataUrl && p === pageCount) {
      pdf.addImage(qrDataUrl, "PNG", miniQrX, miniQrY, miniQrSize, miniQrSize, undefined, "FAST");
      contactRight = miniQrX - 10;
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
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...GRAY);
    pdf.text(`Página ${p} / ${pageCount}`, marginX, pageH - 22);
  }

  pdf.save(`geocapitals-${doc.docType}-${doc.reference}.pdf`);
}
