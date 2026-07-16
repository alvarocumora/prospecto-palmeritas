import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ArrowRight, ShieldCheck } from "lucide-react";
import { TEMPLATES, CATEGORY_LABEL } from "@/lib/documents/templates";

export const Route = createFileRoute("/_authenticated/dashboard/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos de transacción — Geocapitals" },
      {
        name: "description",
        content:
          "Editor in-app de NDAs, MoUs, LOIs, term sheets, SPAs y JVs. Borradores editables con branding Geocapitals sincronizados a tu cuenta.",
      },
    ],
  }),
  component: DocumentsGallery,
});

function DocumentsGallery() {
  const byCategory = new Map<string, typeof TEMPLATES>();
  for (const t of TEMPLATES) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8">
      <div className="mb-8">
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
          Documentos · Editables in-app
        </div>
        <h1 className="font-display text-3xl lg:text-4xl mt-1 text-content">
          Plantillas de transacción
        </h1>
        <p className="text-sm text-content-subtle mt-2 max-w-3xl">
          NDAs, MoUs, LOIs, term sheets, SPAs, JVs, royalties y advisory. Edita cláusulas,
          previsualiza en vivo y descarga PDF con branding Geocapitals. Tus borradores se guardan
          en tu cuenta y se sincronizan entre dispositivos.
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-mono text-content-subtle">
          <ShieldCheck className="w-3.5 h-3.5 text-accent-brand" />
          Borradores editables · No constituye asesoría legal
        </div>
      </div>

      {Array.from(byCategory.entries()).map(([cat, list]) => (
        <section key={cat} className="mb-10">
          <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
            {CATEGORY_LABEL[cat] ?? cat}
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((t) => (
              <Link
                key={t.id}
                to="/dashboard/documentos/$templateId"
                params={{ templateId: t.id }}
                className="group relative rounded-2xl border border-hairline bg-white p-6 hover:border-accent-brand hover:shadow-[0_20px_40px_-30px_rgba(43,74,203,0.35)] transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider bg-accent-brand-subtle text-accent-brand">
                    <FileText className="w-3 h-3" /> {t.acronym ?? t.shortTitle}
                  </span>
                </div>
                <div className="font-display text-lg text-content group-hover:text-accent-brand transition-colors">
                  {t.title}
                </div>
                <p className="text-sm text-content-subtle mt-1.5 leading-relaxed">{t.summary}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-accent-brand opacity-0 group-hover:opacity-100 transition-opacity">
                  Abrir editor <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
