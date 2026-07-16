import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { FileWarning } from "lucide-react";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { DocumentEditor } from "@/features/documents/DocumentEditor";
import { TEMPLATE_BY_ID } from "@/lib/documents/templates";

export const Route = createFileRoute("/recursos/documentos/$templateId")({
  loader: ({ params }) => {
    const template = TEMPLATE_BY_ID[params.templateId];
    if (!template) throw notFound();
    return { template };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Documento no encontrado — Geocapitals" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const t = loaderData.template;
    return {
      meta: [
        { title: `${t.title} — Editor Geocapitals` },
        {
          name: "description",
          content: `Editor in-app de ${t.title}. ${t.summary} Descarga PDF con branding Geocapitals.`,
        },
        { property: "og:title", content: `${t.title} — Geocapitals` },
        { property: "og:description", content: t.summary },
      ],
    };
  },
  errorComponent: ({ error, reset }) => (
    <MarketingPage eyebrow="Documentos" title="Error cargando el documento" intro={error.message}>
      <button onClick={reset} className="text-accent-brand underline">
        Reintentar
      </button>
    </MarketingPage>
  ),
  notFoundComponent: () => (
    <MarketingPage
      eyebrow="Documentos"
      title="Plantilla no encontrada"
      intro="El documento que buscas no existe o fue removido del catálogo."
    >
      <Link to="/recursos" className="inline-flex items-center gap-2 text-accent-brand">
        <FileWarning className="w-4 h-4" /> Volver a recursos
      </Link>
    </MarketingPage>
  ),
  component: DocumentPage,
});

function DocumentPage() {
  const { template } = Route.useLoaderData();
  return <DocumentEditor template={template} />;
}
