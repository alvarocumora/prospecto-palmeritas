// Módulo de generación de documentos dentro del panel privado de operación.
// Requiere sesión validada por correo + código (no basta el enlace).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const PORTAL_DOC_TYPES = ["ficha", "loi", "ncnda", "icpo", "spa"] as const;
export type PortalDocType = (typeof PORTAL_DOC_TYPES)[number];

export const PORTAL_DOC_LABELS: Record<PortalDocType, string> = {
  ficha: "Ficha Técnica · Purchase Terms",
  loi: "LOI · Carta de intención",
  ncnda: "NCNDA · Confidencialidad y no-elusión",
  icpo: "ICPO · Orden de compra irrevocable",
  spa: "SPA (borrador) · Contrato de compraventa",
};

export const PORTAL_DOC_HINTS: Record<PortalDocType, string> = {
  ficha: "Condiciones comerciales formales de la operación.",
  loi: "Declara tu intención de compra/venta con las condiciones acordadas.",
  ncnda: "Acuerdo de confidencialidad y no-elusión entre las Partes.",
  icpo: "Orden de compra irrevocable emitida por el comprador.",
  spa: "Borrador de contrato definitivo para revisión legal.",
};

export const generateOperacionDoc = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(10).max(120),
        session: z.string().min(10).max(200),
        docType: z.enum(PORTAL_DOC_TYPES),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requirePortalSession } = await import("@/lib/portalSession.server");
    const s = await requirePortalSession(data.token, data.session);

    const { loadPortalDocCtx } = await import("@/lib/portalDocs.server");
    const ctx = await loadPortalDocCtx(s);

    const {
      buildTradeFichaPdf,
      buildTradeLoiPdf,
      buildTradeNcndaPdf,
      buildTradeIcpoPdf,
      buildTradeSpaDraftPdf,
    } = await import("@/lib/documents/officialPdfs.server");
    const { uploadPdfSigned } = await import("@/lib/documents/pdfServer.server");

    const builders: Record<PortalDocType, () => Promise<Uint8Array>> = {
      ficha: () => buildTradeFichaPdf(ctx),
      loi: () => buildTradeLoiPdf(ctx),
      ncnda: () => buildTradeNcndaPdf(ctx),
      icpo: () => buildTradeIcpoPdf(ctx),
      spa: () => buildTradeSpaDraftPdf(ctx),
    };

    const bytes = await builders[data.docType]();
    const filename = `${data.docType.toUpperCase()}-${ctx.reference}.pdf`;
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const url = await uploadPdfSigned({
      bytes,
      path: `portal-docs/${s.tradeId}/${data.docType}/${stamp}-${filename}`,
      ttlDays: 7,
    });

    try {
      await s.sb.from("trade_events").insert({
        trade_id: s.tradeId,
        kind: "portal_doc_generated",
        detail: `${PORTAL_DOC_LABELS[data.docType]} generado por ${s.email}`,
      });
    } catch {
      /* no bloquea */
    }

    return { url, filename, label: PORTAL_DOC_LABELS[data.docType] };
  });
