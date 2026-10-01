import { lazy, useMemo } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Target, MapPin, ExternalLink, Compass } from "lucide-react";
import { getPublicProjectTargets, type PublicTarget } from "@/lib/publicTargets.functions";
import { TargetsExecutivePanel } from "@/components/targets/TargetsExecutivePanel";
import { ArRadarOverlay } from "@/components/ar/ArRadarOverlay";
import { useGeolocation } from "@/hooks/useGeolocation";
import { projectExplorationObjects } from "@/lib/ar/anomalyProjection";
import { targetsToArSources } from "@/lib/ar/targetsToArSources";
import type { ExplorationTarget } from "@/hooks/useExplorationTargets";

const TargetsMap = lazy(() =>
  import("@/components/targets/TargetsMap").then((m) => ({ default: m.TargetsMap })),
);

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
        Error: {(error as Error).message}
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

function PublicTargetsRadar({ targets }: { targets: ExplorationTarget[] }) {
  const { position } = useGeolocation(true);

  const radarObjects = useMemo(() => {
    if (!position) return [];

    return projectExplorationObjects(
      {
        lat: position.lat,
        lng: position.lng,
        altitudeM: position.altitude,
        headingDeg: position.heading,
      },
      targetsToArSources(targets),
      {
        maxDistanceM: 5000,
        nearbyDistanceM: 250,
      },
    );
  }, [position, targets]);

  if (!position || radarObjects.length === 0) return null;

  return (
    <section className="px-3 md:px-0 pt-3 md:pt-0">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
        <Compass className="w-3 h-3" /> AR Radar
      </div>
      <ArRadarOverlay objects={radarObjects} headingDeg={position.heading} />
    </section>
  );
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
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border bg-bg-secondary/95 backdrop-blur supports-[backdrop-filter]:bg-bg-secondary/80">
        <div className="max-w-[1400px] mx-auto px-3 md:px-6 py-3 md:py-4 flex items-start md:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Vista pública · solo lectura
            </div>
            <h1 className="text-base md:text-xl font-bold mt-1 inline-flex items-center gap-2 leading-tight">
              <Target className="w-4 h-4 md:w-5 md:h-5 text-gold shrink-0" />
              <span className="truncate">{data.project.name}</span>
            </h1>
            <div className="text-[10px] md:text-[11px] font-mono text-muted-foreground mt-0.5">
              {data.project.code} · {targets.length} targets · {geoCount} georreferenciados
            </div>
          </div>
          <a
            href="https://geocapitals.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex text-[11px] font-mono text-muted-foreground hover:text-foreground items-center gap-1 shrink-0"
          >
            geocapitals.com <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-0 md:px-6 py-0 md:py-6 md:space-y-6">
        <ClientOnly fallback={null}>
          <PublicTargetsRadar targets={targets} />
        </ClientOnly>

        <section className="md:rounded-lg md:overflow-hidden">
          <div className="px-3 md:px-0 py-2 md:pt-0 text-[10px] font-mono uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> Mapa de targets
          </div>
          <div className="md:rounded-lg md:overflow-hidden">
            <ClientOnly
              fallback={
                <div className="h-[calc(100dvh-116px)] min-h-[420px] md:h-[520px] rounded-none md:rounded-md border-y md:border border-border bg-bg-secondary animate-pulse" />
              }
            >
              <TargetsMap targets={targets} />
            </ClientOnly>
          </div>
        </section>

        <section className="px-3 md:px-0 py-5 md:py-0">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Ranking por prioridad
          </div>
          <TargetsExecutivePanel targets={targets} />
        </section>

        <footer className="mx-3 md:mx-0 pt-4 pb-6 border-t border-border text-[10px] font-mono text-muted-foreground text-center">
          Documento generado por Geocapitals · Vista pública sin datos confidenciales
        </footer>
      </main>
    </div>
  );
}
