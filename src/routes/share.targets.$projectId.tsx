import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Target, MapPin, ExternalLink } from "lucide-react";
import { getPublicProjectTargets, type PublicTarget } from "@/lib/publicTargets.functions";
import { TargetsMap } from "@/components/targets/TargetsMap";
import { TargetsExecutivePanel } from "@/components/targets/TargetsExecutivePanel";
import type { ExplorationTarget } from "@/hooks/useExplorationTargets";

export const Route = createFileRoute("/share/targets/$projectId")({
  head: ({ params }) => ({
    meta: [
      { title: `Targets compartidos — ${params.projectId.slice(0, 8)}` },
      { name: "description", content: "Mapa público de targets exploratorios" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SharePage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="text-center text-sm font-mono text-muted-foreground">
        Error: {error.message}
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="text-sm font-mono text-muted-foreground">Recurso no encontrado</div>
    </div>
  ),
});

function toExplorationTarget(t: PublicTarget): ExplorationTarget {
  return {
    id: t.id,
    project_id: "",
    campaign_id: null,
    created_by: "",
    code: t.code,
    name: t.name,
    target_type: t.target_type as ExplorationTarget["target_type"],
    commodity: t.commodity,
    target_zone: null,
    lat: t.lat,
    lng: t.lng,
    elevation_m: null,
    geometry_geojson: null,
    stage: t.stage as ExplorationTarget["stage"],
    priority: t.priority,
    score: t.score,
    confidence_pct: null,
    rationale: t.rationale,
    evidence: t.evidence as ExplorationTarget["evidence"],
    assigned_to: null,
    planned_meters: null,
    estimated_cost_usd: null,
    validated_by: null,
    validated_at: null,
    closed_reason: null,
    closed_at: null,
    notes: null,
    created_at: "",
    updated_at: "",
  };
}

function SharePage() {
  const { projectId } = Route.useParams();
  const fetchFn = useServerFn(getPublicProjectTargets);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-targets", projectId],
    queryFn: () => fetchFn({ data: { projectId } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm font-mono text-muted-foreground animate-pulse">
          Cargando targets…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="text-center">
          <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <div className="text-sm font-mono text-muted-foreground">
            {error instanceof Error ? error.message : "No se pudo cargar"}
          </div>
        </div>
      </div>
    );
  }

  const targets = data.targets.map(toExplorationTarget);
  const geoCount = targets.filter((t) => t.lat != null && t.lng != null).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Vista pública · solo lectura
            </div>
            <h1 className="text-lg md:text-xl font-bold mt-1 inline-flex items-center gap-2">
              <Target className="w-5 h-5 text-gold" />
              {data.project.name}
            </h1>
            <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
              {data.project.code} · {targets.length} targets · {geoCount} con coordenadas
            </div>
          </div>
          <a
            href="https://geocapitals.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            geocapitals.com <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Map */}
        <section>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> Mapa de targets
          </div>
          <ClientOnly fallback={<div className="h-[480px] rounded-md border border-border bg-bg-secondary animate-pulse" />}>
            <TargetsMap targets={targets} />
          </ClientOnly>
        </section>

        {/* Ranking */}
        <section>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Ranking por prioridad
          </div>
          <TargetsExecutivePanel targets={targets} />
        </section>

        <footer className="pt-4 border-t border-border text-[10px] font-mono text-muted-foreground text-center">
          Documento generado por Geocapitals · Vista pública sin datos confidenciales
        </footer>
      </main>
    </div>
  );
}
