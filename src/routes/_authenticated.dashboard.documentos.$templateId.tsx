import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { z } from "zod";
import { FileWarning } from "lucide-react";
import { DocumentEditor } from "@/features/documents/DocumentEditor";
import { TEMPLATE_BY_ID } from "@/lib/documents/templates";
import { mapLotToDataSheetValues } from "@/lib/documents/prefill";
import { getCommodityLotDetail } from "@/lib/marketplace.functions";
import { verifyCommodityLot } from "@/lib/lotVerification.functions";

export const Route = createFileRoute("/_authenticated/dashboard/documentos/$templateId")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ lot: z.string().uuid().optional() }).parse(s),
  loaderDeps: ({ search }) => ({ lot: search.lot }),
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
    return { template, prefill };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Documento no encontrado — Geocapitals" }] };
    }
    const t = loaderData.template;
    return {
      meta: [
        { title: `${t.title} — Editor Geocapitals` },
        { name: "description", content: t.summary },
      ],
    };
  },
  errorComponent: ({ error, reset }) => (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="font-display text-2xl mb-2">Error cargando el documento</h1>
      <p className="text-sm text-content-subtle mb-4">{error.message}</p>
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
  const { template, prefill } = Route.useLoaderData();
  return <DocumentEditor template={template} prefill={prefill ?? undefined} />;
}
