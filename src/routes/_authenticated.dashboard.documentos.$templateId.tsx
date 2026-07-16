import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { FileWarning } from "lucide-react";
import { DocumentEditor } from "@/features/documents/DocumentEditor";
import { TEMPLATE_BY_ID } from "@/lib/documents/templates";

export const Route = createFileRoute("/_authenticated/dashboard/documentos/$templateId")({
  loader: ({ params }) => {
    const template = TEMPLATE_BY_ID[params.templateId];
    if (!template) throw notFound();
    return { template };
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
  const { template } = Route.useLoaderData();
  return <DocumentEditor template={template} />;
}
