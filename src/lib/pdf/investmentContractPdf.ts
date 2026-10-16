/**
 * Contrato de suscripción firmado en web → PDF institucional con sello QR.
 * Client-only: jsPDF se importa dinámicamente. Sin cifrado.
 */
import type { TicketRow } from "@/lib/tickets.functions";
import { brandQr, ensureBrandFonts, font, ink } from "@/lib/pdf/brand/kit";
import { GC_COLOR } from "@/lib/pdf/brand/tokens";
import { letterhead, folio, section, kvRow, verificationSeal, type Frame } from "@/lib/pdf/brand/institutional";
import { contractText, fmtMoney } from "@/lib/investor/rounds";
import { publicUrl } from "@/lib/publicUrl";

export async function downloadInvestmentContractPdf(o: {
  t: TicketRow;
  legalName: string;
  projectName: string;
  projectSlug: string;
  signatureImage?: string | null;
}) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await ensureBrandFonts(doc);
  const f: Frame = { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight(), m: 48 };
  const issued = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  const head = { unit: "Capital & Deals · Contratos", ref: o.t.ticket_code, version: "v1.1", issued, deferFooter: true };
  letterhead(doc, f, { ...head, page: 1, total: 1 });

  let y = 84;
  font(doc, "display", "normal", 18);
  ink(doc, GC_COLOR.ink);
  doc.text("Contrato de suscripción de acciones", f.m, y);
  y += 26;

  y = section(doc, f, y, "01", "Partes y ticket");
  y = kvRow(doc, f, y, "Sociedad", o.legalName);
  y = kvRow(doc, f, y, "Proyecto", o.projectName);
  y = kvRow(doc, f, y, "Ticket", o.t.ticket_code);
  y = kvRow(doc, f, y, "Monto", fmtMoney(o.t.amount, o.t.currency));
  y = kvRow(doc, f, y, "Acciones", String(o.t.shares_allocated ?? "—"));
  y += 6;

  y = section(doc, f, y, "02", "Cláusulas");
  const body = contractText({ ...o.t, legalName: o.legalName, projectName: o.projectName });
  font(doc, "body", "normal", 8.6);
  ink(doc, GC_COLOR.ink);
  const cw = f.w - f.m * 2;
  for (const para of body.split("\n")) {
    const lines = doc.splitTextToSize(para, cw) as string[];
    for (const ln of lines) {
      if (y > f.h - 70) {
        doc.addPage();
        letterhead(doc, f, { ...head, page: 1, total: 1 });
        y = 84;
        font(doc, "body", "normal", 8.6);
        ink(doc, GC_COLOR.ink);
      }
      doc.text(ln, f.m, y);
      y += 11.5;
    }
    y += 5;
  }

  if (y > f.h - 300) {
    doc.addPage();
    letterhead(doc, f, { ...head, page: 1, total: 1 });
    y = 84;
  }
  y = section(doc, f, y + 4, "03", "Firma electrónica");
  y = kvRow(doc, f, y, "Firmante", o.t.investor_signature_name ?? "Pendiente");
  y = kvRow(doc, f, y, "Fecha (UTC)", o.t.signed_at ? new Date(o.t.signed_at).toISOString().replace("T", " ").slice(0, 19) : "Pendiente");
  y = kvRow(doc, f, y, "Huella SHA-256", o.t.contract_hash ?? "Pendiente");
  if (o.signatureImage) {
    doc.addImage(o.signatureImage, "PNG", f.m, y + 4, 180, 60);
    doc.setDrawColor(...GC_COLOR.hairline);
    doc.line(f.m, y + 66, f.m + 200, y + 66);
    font(doc, "body", "normal", 7.5);
    ink(doc, GC_COLOR.slate);
    doc.text("Firma manuscrita capturada en la plataforma", f.m, y + 78);
    y += 86;
  }
  y += 6;

  const url = publicUrl(`/terminal/${o.projectSlug}?tab=simulador`);
  const qr = await brandQr(`${url}#${o.t.ticket_code}:${o.t.contract_hash ?? ""}`);
  verificationSeal(doc, f, y, {
    qr,
    title: "Sello de integridad documental",
    body: "La huella SHA-256 corresponde al texto exacto firmado en la plataforma. Cualquier alteración del texto produce una huella distinta. Borrador sujeto a revisión legal y notarial; no constituye oferta pública ni garantiza rentabilidad.",
    url,
    ref: o.t.ticket_code,
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    folio(doc, f, { page: i, total, issued });
  }
  doc.save(`${o.t.ticket_code}-contrato.pdf`);
}
