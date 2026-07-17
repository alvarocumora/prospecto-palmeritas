import type { GeneratedDoc } from "./model";
import logoMark from "@/assets/geocapitals-mark.png";
import { PUBLIC_APP_HOST, verifyDocUrl } from "@/lib/publicUrl";

// Renderer PDF institucional Geocapitals.
// Client-only (import dinámico de jsPDF, autotable y qrcode).

const CONTACT_EMAIL = "info@geocapitals.com";
const CONTACT_WHATSAPP = "+56 9 6218 4071";
const WHATSAPP_URL = "https://wa.me/56962184071";

const PAPER: [number, number, number] = [247, 245, 240];
const PAPER_2: [number, number, number] = [240, 237, 229];
const CARD: [number, number, number] = [255, 254, 250];
const INK: [number, number, number] = [26, 26, 46];
const INK_SOFT: [number, number, number] = [66, 63, 86];
const MUTED: [number, number, number] = [107, 107, 123];
const HAIRLINE: [number, number, number] = [227, 224, 216];
const COBALT: [number, number, number] = [43, 74, 203];
const COBALT_DEEP: [number, number, number] = [31, 54, 158];
const SUCCESS: [number, number, number] = [36, 128, 83];

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
  signatures?: EmitterSignature[];
};

type JsPdfDoc = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number }; getNumberOfPages: () => number };
  setFillColor: (...args: number[]) => void;
  setDrawColor: (...args: number[]) => void;
  setTextColor: (...args: number[]) => void;
  setLineWidth: (width: number) => void;
  setFont: (name: string, style?: string) => void;
  setFontSize: (size: number) => void;
  addPage: () => void;
  setPage: (page: number) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  roundedRect: (x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string) => void;
  circle: (x: number, y: number, r: number, style?: string) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  text: (text: string | string[], x: number, y: number, options?: Record<string, unknown>) => void;
  textWithLink: (text: string, x: number, y: number, options: { url: string }) => void;
  addImage: (...args: unknown[]) => void;
  splitTextToSize: (text: string, size: number) => string[];
  save: (filename: string) => void;
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
      color: { dark: "#1A1A2E", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  } catch {
    return null;
  }
}

function cleanDocType(type: string): string {
  return type.replace(/[-_]/g, " ").toUpperCase();
}

function formatDocDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CL", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function formatUtcStamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-CL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function signatureDisplayName(name: string): string {
  const normalized = name.replace(/\s+/g, " ").trim();
  return normalized.split(" · ")[0]?.replace(/\s+RUT\s+.*/i, "").trim() || normalized;
}

function parseClause(item: string): { number?: string; heading?: string; body: string } {
  const match = item.match(/^\s*(\d+)\.\s*([^.]*(?:\([^)]*\))?)\.\s*(.*)$/);
  if (!match) return { body: item };
  return { number: match[1], heading: match[2], body: match[3] || item };
}

function drawWatermarkGrid(pdf: JsPdfDoc, pageW: number, pageH: number) {
  pdf.setDrawColor(...HAIRLINE);
  pdf.setLineWidth(0.25);
  for (let x = 48; x < pageW; x += 96) pdf.line(x, 0, x, pageH);
  for (let y = 80; y < pageH; y += 96) pdf.line(0, y, pageW, y);
}

export async function renderGeocapitalsPdf(
  doc: GeneratedDoc,
  opts: RenderOptions = {},
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const pdf = new jsPDF({ unit: "pt", format: "a4" }) as JsPdfDoc;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 52;
  const contentW = pageW - marginX * 2;
  const bottomLimit = pageH - 104;

  const verify = verifyDocUrl(doc.reference);
  const [mark, qrDataUrl] = await Promise.all([loadMark(), makeQr(verify)]);

  const drawBrand = (x: number, y: number, compact = false) => {
    const markH = compact ? 22 : 34;
    const textX = x + markH + (compact ? 9 : 13);
  if (mark) {
    const markW = markH * mark.ratio;
      pdf.addImage(mark.dataUrl, "PNG", x, y, markW, markH, undefined, "FAST");
    pdf.setFont("helvetica", "bold");
      pdf.setFontSize(compact ? 8.5 : 10.5);
    pdf.setTextColor(...INK);
      pdf.text("GEOCAPITALS", textX, y + (compact ? 9 : 14));
    pdf.setFont("helvetica", "normal");
      pdf.setFontSize(compact ? 6.2 : 7.5);
    pdf.setTextColor(...MUTED);
      pdf.text("Mining · Deals · Documentation", textX, y + (compact ? 18 : 26));
  } else {
    pdf.setFont("helvetica", "bold");
      pdf.setFontSize(compact ? 10 : 15);
    pdf.setTextColor(...INK);
      pdf.text("GEOCAPITALS", x, y + 16);
    pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
      pdf.text("Mining · Deals · Documentation", x, y + 27);
    }
  };

  const drawTopRule = () => {
    pdf.setFillColor(...PAPER);
    pdf.rect(0, 0, pageW, pageH, "F");
    drawWatermarkGrid(pdf, pageW, pageH);
    pdf.setFillColor(...INK);
    pdf.rect(0, 0, pageW, 7, "F");
    pdf.setFillColor(...COBALT);
    pdf.rect(0, 7, pageW * 0.28, 3, "F");
  };

  const drawContinuationHeader = () => {
    drawTopRule();
    drawBrand(marginX, 24, true);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...INK_SOFT);
    pdf.text(cleanDocType(doc.docType), pageW - marginX, 31, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...MUTED);
    pdf.text(`Ref ${doc.reference}`, pageW - marginX, 42, { align: "right" });
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.6);
    pdf.line(marginX, 61, pageW - marginX, 61);
  };

  drawTopRule();

  // ─── Cabecera institucional de primera página ───
  const headerTop = 34;
  drawBrand(marginX, headerTop);

  const dateText = formatDocDate(doc.date);
  const qrBoxW = 95;
  const qrBoxH = 118;
  const qrBoxX = pageW - marginX - qrBoxW;
  const qrBoxY = 78;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COBALT);
  pdf.text("DOCUMENTO OFICIAL", pageW - marginX, headerTop + 4, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...MUTED);
  pdf.text(dateText, pageW - marginX, headerTop + 17, { align: "right" });
  pdf.text(`${CONTACT_EMAIL} · ${PUBLIC_APP_HOST}`, pageW - marginX, headerTop + 29, {
    align: "right",
  });

  let y = 86;
  pdf.setDrawColor(...HAIRLINE);
  pdf.setLineWidth(0.7);
  pdf.line(marginX, y, pageW - marginX, y);

  // ─── Título y QR de validación ───
  y += 28;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COBALT);
  pdf.text(cleanDocType(doc.docType), marginX, y - 14);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.setTextColor(...INK);
  const titleLines = pdf.splitTextToSize(doc.title, contentW - qrBoxW - 24).slice(0, 3);
  pdf.text(titleLines, marginX, y + 8);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  pdf.text(`Referencia ${doc.reference}`, marginX, y + 22 + titleLines.length * 18);

  if (qrDataUrl) {
    pdf.setFillColor(...CARD);
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.7);
    pdf.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 5, 5, "FD");
    pdf.addImage(qrDataUrl, "PNG", qrBoxX + 12, qrBoxY + 10, 71, 71, undefined, "FAST");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(5.9);
    pdf.setTextColor(...INK);
    pdf.text("VALIDACIÓN QR", qrBoxX + qrBoxW / 2, qrBoxY + 91, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.6);
    pdf.setTextColor(...MUTED);
    pdf.text(PUBLIC_APP_HOST, qrBoxX + qrBoxW / 2, qrBoxY + 102, { align: "center" });
    pdf.text("/verificar/ref", qrBoxX + qrBoxW / 2, qrBoxY + 111, { align: "center" });
  }

  y = Math.max(y + 42 + titleLines.length * 18, qrBoxY + qrBoxH + 18);

  pdf.setFillColor(...INK);
  pdf.roundedRect(marginX, y, contentW, 42, 4, 4, "F");
  pdf.setFillColor(...COBALT);
  pdf.rect(marginX, y, 5, 42, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.2);
  pdf.setTextColor(255, 255, 255);
  pdf.text("REGISTRO DE VALIDACIÓN", marginX + 18, y + 16);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.4);
  pdf.setTextColor(219, 222, 239);
  pdf.text(`Escanee el QR o visite ${verify}`, marginX + 18, y + 29, {
    maxWidth: contentW - 36,
  });

  y += 68;

  const ensure = (needed: number) => {
    if (y + needed > bottomLimit) {
      pdf.addPage();
      y = 82;
    }
  };

  const drawSectionLabel = (label: string) => {
    ensure(24);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...COBALT);
    pdf.text(label, marginX, y);
    pdf.setDrawColor(...COBALT);
    pdf.setLineWidth(1);
    pdf.line(marginX, y + 7, marginX + 44, y + 7);
    y += 22;
  }
  };

  // ─── Bloques ───
  const signatures = [opts.emitterSignature, ...(opts.signatures ?? [])].filter(
    Boolean,
  ) as EmitterSignature[];
  for (const block of doc.blocks) {
    if (block.kind === "paragraph") {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...INK_SOFT);
      const lines = pdf.splitTextToSize(block.text, contentW - 4);
      ensure(lines.length * 14 + 10);
      pdf.text(lines, marginX, y);
      y += lines.length * 14 + 16;
    } else if (block.kind === "clauses") {
      drawSectionLabel("CLÁUSULAS");
      for (const item of block.items) {
        const clause = parseClause(item);
        const bodyLines = pdf.splitTextToSize(clause.body, contentW - 66);
        const needed = Math.max(36, bodyLines.length * 12 + (clause.heading ? 22 : 12));
        ensure(needed + 6);

        pdf.setDrawColor(...HAIRLINE);
        pdf.setLineWidth(0.7);
        pdf.line(marginX, y - 8, pageW - marginX, y - 8);

        if (clause.number) {
          pdf.setFillColor(...COBALT);
          pdf.circle(marginX + 12, y + 7, 10, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7.5);
          pdf.setTextColor(255, 255, 255);
          pdf.text(clause.number, marginX + 12, y + 10, { align: "center" });
        }

        const textX = marginX + 42;
        if (clause.heading) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.3);
          pdf.setTextColor(...INK);
          pdf.text(clause.heading.toUpperCase(), textX, y + 3);
          y += 14;
        }
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.2);
        pdf.setTextColor(...INK_SOFT);
        pdf.text(bodyLines, textX, y + 3);
        y += bodyLines.length * 12 + 14;
      }
      y += 4;
    } else if (block.kind === "fields") {
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        theme: "plain",
        pageBreak: "auto",
        rowPageBreak: "avoid",
        styles: {
          fontSize: 9.2,
          cellPadding: { top: 6, right: 7, bottom: 6, left: 7 },
          textColor: INK_SOFT,
          lineColor: HAIRLINE,
          lineWidth: { bottom: 0.45 },
        },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 148, textColor: COBALT, fillColor: PAPER_2 },
          1: { cellWidth: contentW - 148, fillColor: CARD },
        },
        tableLineColor: HAIRLINE,
        tableLineWidth: 0.7,
        body: block.rows.map(([k, v]) => [k, v]),
        margin: { left: marginX, right: marginX, bottom: 92, top: 78 },
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
    } else if (block.kind === "table") {
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        theme: "grid",
        pageBreak: "auto",
        rowPageBreak: "avoid",
        headStyles: { fillColor: INK, textColor: [255, 255, 255], fontSize: 8.8 },
        styles: {
          fontSize: 8.8,
          cellPadding: 5,
          textColor: INK_SOFT,
          lineColor: HAIRLINE,
        },
        head: [block.head],
        body: block.rows,
        margin: { left: marginX, right: marginX, bottom: 92, top: 78 },
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
    } else if (block.kind === "signature") {
      const n = block.parties.length;
      const cols = n === 1 ? 1 : 2;
      const gap = 22;
      const slotW = cols === 1 ? Math.min(330, contentW) : (contentW - gap) / 2;
      const slotH = 138;
      const rows = Math.ceil(n / cols);
      ensure(34 + rows * slotH + 8);

      drawSectionLabel("FIRMAS Y ACEPTACIÓN ELECTRÓNICA");

      block.parties.forEach((party, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = marginX + col * (slotW + gap);
        const top = y + row * slotH;
        const sig = signatures.find((s) => Math.min(Math.max(s.partyIndex ?? 0, 0), n - 1) === i);
        const lineY = top + 54;

        pdf.setFillColor(...CARD);
        pdf.setDrawColor(...HAIRLINE);
        pdf.setLineWidth(0.7);
        pdf.roundedRect(x, top, slotW, slotH - 16, 5, 5, "FD");

        if (sig) {
          const visibleName = signatureDisplayName(sig.name);
          const sigLines = pdf.splitTextToSize(visibleName, slotW - 84).slice(0, 1);
          pdf.setFont("helvetica", "bolditalic");
          pdf.setFontSize(14.2);
          pdf.setTextColor(...INK);
          pdf.text(sigLines, x + 14, lineY - 12);

          pdf.setDrawColor(...COBALT);
          pdf.setLineWidth(0.9);
          pdf.roundedRect(x + slotW - 72, top + 13, 58, 26, 3, 3, "S");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6.4);
          pdf.setTextColor(...COBALT);
          pdf.text("FIRMADO", x + slotW - 43, top + 24, { align: "center" });
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(5.4);
          pdf.setTextColor(...MUTED);
          pdf.text("Vigente", x + slotW - 43, top + 33, { align: "center" });
        } else {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7.4);
          pdf.setTextColor(...MUTED);
          pdf.text("Firma pendiente", x + 14, lineY - 16);
        }

        pdf.setDrawColor(...INK);
        pdf.setLineWidth(0.65);
        pdf.line(x + 14, lineY, x + slotW - 14, lineY);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.2);
        pdf.setTextColor(...INK);
        const partyLines = pdf.splitTextToSize(party, slotW - 28).slice(0, 3);
        pdf.text(partyLines, x + 14, lineY + 15);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.7);
        pdf.setTextColor(...MUTED);
        const subY = lineY + 20 + partyLines.length * 8.5;

        if (sig) {
          const signedBy = sig.email ? `Firmado por ${sig.email}` : `Firmado por ${visibleName}`;
          const proofLines = pdf.splitTextToSize(signedBy, slotW - 28).slice(0, 1);
          pdf.text(proofLines, x + 14, subY);
          pdf.text(`${formatUtcStamp(sig.signedAt)} UTC`, x + 14, subY + 9);
          if (sig.hash) {
            pdf.setFontSize(5.8);
            pdf.text(`Hash ${sig.hash}`, x + 14, subY + 18, { maxWidth: slotW - 28 });
          }
        } else {
          pdf.text("Nombre, cargo y firma", x + 14, subY);
        }
      });
      y += rows * slotH + 4;
    }
  }

  // ─── Header/footers finales, mini QR y paginación ───
  const pageCount = pdf.internal.getNumberOfPages();

  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);

    if (p > 1) {
      drawContinuationHeader();
    }

    pdf.setFillColor(...PAPER);
    pdf.rect(0, pageH - 86, pageW, 86, "F");
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.7);
    pdf.line(marginX, pageH - 78, pageW - marginX, pageH - 78);
    pdf.setDrawColor(...COBALT);
    pdf.setLineWidth(1.1);
    pdf.line(marginX, pageH - 78, marginX + 36, pageH - 78);

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

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...COBALT_DEEP);
    pdf.text("GEOCAPITALS · DOCUMENTACIÓN TRANSACCIONAL", marginX, pageH - 62);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.7);
    pdf.setTextColor(...MUTED);
    pdf.text(
      "Documento generado por Geocapitals como borrador editable. No constituye asesoría legal ni oferta financiera. Validar con las contrapartes y sus asesores antes de firmar.",
      marginX,
      pageH - 50,
      { maxWidth: contentW - (p === pageCount ? 60 : 0) },
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.6);
    pdf.setTextColor(...INK_SOFT);
    pdf.text(`${CONTACT_EMAIL} · WhatsApp ${CONTACT_WHATSAPP}`, marginX, pageH - 32);

    pdf.setFontSize(6.4);
    pdf.setTextColor(...INK);
    pdf.textWithLink(`Verificación electrónica: ${verify}`, marginX, pageH - 20, { url: verify });
    pdf.textWithLink(`Contacto WhatsApp`, marginX + 275, pageH - 20, { url: WHATSAPP_URL });

    pdf.setFontSize(6.8);
    pdf.setTextColor(...MUTED);
    pdf.text(`${p} / ${pageCount}`, pageW - marginX, pageH - 22, { align: "right" });
  }

  pdf.save(`geocapitals-${doc.docType}-${doc.reference}.pdf`);
}
