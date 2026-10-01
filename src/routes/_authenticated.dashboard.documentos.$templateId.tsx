import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { z } from "zod";
import { FileWarning } from "lucide-react";
import { DocumentEditor } from "@/features/documents/DocumentEditor";
import { TEMPLATE_BY_ID } from "@/lib/documents/templates";
import { mapLotToDataSheetValues } from "@/lib/documents/prefill";
import { getCommodityLotDetail } from "@/lib/marketplace.functions";
import { verifyCommodityLot } from "@/lib/lotVerification.functions";
import { getTradeDetail } from "@/lib/trades.functions";

export const Route = createFileRoute("/_authenticated/dashboard/documentos/$templateId")({
  validateSearch: (s: Record<string, unknown>) =>
    z
      .object({
        lot: z.string().uuid().optional(),
        trade: z.string().uuid().optional(),
        draftId: z.string().uuid().optional(),
        projectId: z.string().uuid().optional(),
        inquiryId: z.string().uuid().optional(),
      })
      .parse(s),
  loaderDeps: ({ search }) => ({
    lot: search.lot,
    trade: search.trade,
    draftId: search.draftId,
    projectId: search.projectId,
    inquiryId: search.inquiryId,
  }),
  loader: async ({ params, deps }) => {
    const template = TEMPLATE_BY_ID[params.templateId];
    if (!template) throw notFound();

    // Prefill desde un lote del marketplace (solo para el data sheet).
    let prefill: Record<string, string> | null = null;
    if (deps.lot && template.id === "data-sheet") {
      const [lot, kym] = await Promise.all([
        getCommodityLotDetail({ data: { id: deps.lot } }).catch(() => null),
        verifyCommodityLot({ data: { lotId: deps.lot } }).catch(() => null),
      ]);
      if (lot) {
        prefill = mapLotToDataSheetValues(lot, { kymScore: kym?.score ?? null });
      }
    }

    // Contexto de trade: la contraparte queda sugerida como firmante y el
    // documento firmado entra a la trazabilidad de la operación.
    let tradeId: string | null = null;
    let signerPrefill: { name: string | null; email: string | null } | null = null;
    if (deps.trade) {
      const res = await getTradeDetail({ data: { id: deps.trade } }).catch(() => null);
      if (res?.trade) {
        tradeId = res.trade.id;
        const t = res.trade;
        signerPrefill =
          t.role === "buyer"
            ? { name: t.sellerName, email: t.sellerEmail }
            : { name: t.buyerName, email: t.buyerEmail };
      }
    }
    // Devolvemos solo datos serializables — el `TemplateDef` incluye
    // `build: Function`, que rompe la dehidratación SSR (seroval no serializa
    // funciones). El componente resuelve el template en cliente por id.
    return {
      templateId: template.id,
      templateTitle: template.title,
      templateSummary: template.summary,
      prefill,
      tradeId,
      signerPrefill,
      draftId: deps.draftId ?? null,
      projectId: deps.projectId ?? null,
      inquiryId: deps.inquiryId ?? null,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Documento no encontrado — Geocapitals" }] };
    }
    return {
      meta: [
        { title: `${loaderData.templateTitle} — Editor Geocapitals` },
        { name: "description", content: loaderData.templateSummary },
      ],
    };
  },
  errorComponent: ({ error, reset }) => (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="font-display text-2xl mb-2">Error cargando el documento</h1>
      <p className="text-sm text-content-subtle mb-4">{(error as Error).message}</p>
      <button onClick={reset} className="text-accent-brand underline text-sm">
        Reintentar
      </button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="font-display text-2xl mb-2">Plantilla no encontrada</h1>
      <p className="text-sm text-content-subtle mb-4">
        El documento que buscas no existe o fue removido del catálogo.
      </p>
      <Link
        to="/dashboard/documentos"
        className="inline-flex items-center gap-2 text-accent-brand text-sm"
      >
        <FileWarning className="w-4 h-4" /> Volver al catálogo
      </Link>
    </div>
  ),
  component: DocumentPage,
});

function DocumentPage() {
  const { templateId, prefill, tradeId, signerPrefill, draftId, projectId, inquiryId } =
    Route.useLoaderData();
  const template = TEMPLATE_BY_ID[templateId];
  if (!template) return null;
  return (
    <DocumentEditor
      key={draftId ?? "new"}
      template={template}
      draftId={draftId ?? undefined}
      prefill={prefill ?? undefined}
      projectId={projectId ?? undefined}
      tradeId={tradeId ?? undefined}
      inquiryId={inquiryId ?? undefined}
      signerPrefill={signerPrefill ?? undefined}
    />
  );
}
