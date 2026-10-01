import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KanbanSquare } from "lucide-react";
import { listPipelineDeals, PIPELINE_LABEL, PIPELINE_STAGES } from "@/lib/dealPipeline.functions";
import { PipelineDealCard } from "@/features/deal-pipeline/PipelineDealCard";

export const Route = createFileRoute("/_authenticated/dashboard/pipeline/")({
  head: () => ({
    meta: [
      { title: "Pipeline de deals — Geocapitals" },
      {
        name: "description",
        content: "Deals por etapa: prospección, pedimento, exploración, certificación y exit.",
      },
      { property: "og:title", content: "Pipeline de deals — Geocapitals" },
      { property: "og:description", content: "Tablero interno de deals mineros por etapa." },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  const fn = useServerFn(listPipelineDeals);
  const { data, isLoading, error } = useQuery({
    queryKey: ["pipeline-deals"],
    queryFn: () => fn(),
  });
  const deals = data ?? [];
  return (
    <div data-theme="im-light" className="min-h-full bg-surface p-4 md:p-6">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <KanbanSquare className="w-5 h-5 text-accent-brand" />
          <h1 className="font-display text-2xl text-content">Pipeline de deals</h1>
        </div>
        <p className="text-sm text-content-subtle mt-1">
          Prospección → Pedimento → Exploración → Certificación → Exit
        </p>
      </header>
      {error ? (
        <div className="text-sm text-destructive">
          No tienes acceso al módulo Capital o hubo un error al cargar.
        </div>
      ) : isLoading ? (
        <div className="text-sm text-content-subtle">Cargando…</div>
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-3 xl:grid-cols-5">
          {PIPELINE_STAGES.map((s) => {
            const col = deals.filter((d) => d.pipeline_stage === s);
            return (
              <section
                key={s}
                className="rounded-md border border-hairline bg-surface-2 p-2 min-h-[200px]"
              >
                <div className="flex items-center justify-between px-1 pb-2 text-[11px] font-mono uppercase tracking-wider text-content-subtle">
                  <span>{PIPELINE_LABEL[s]}</span>
                  <span>{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((d) => (
                    <PipelineDealCard key={d.id} deal={d} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
