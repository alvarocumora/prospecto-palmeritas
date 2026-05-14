import { createFileRoute } from "@tanstack/react-router";
import { useProjects } from "@/hooks/useProjects";
import { HyperspectralPanel } from "@/components/satellite/HyperspectralPanel";
import { InsarMonitoringPanel } from "@/components/satellite/InsarMonitoringPanel";
import { StockpileVolumesPanel } from "@/components/satellite/StockpileVolumesPanel";
import { Satellite } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/satellite-intel")({
  component: SatelliteIntelPage,
});

function SatelliteIntelPage() {
  const { active } = useProjects();

  if (!active) {
    return (
      <div className="p-6 text-sm text-text-dim font-mono">
        Selecciona un proyecto para acceder a Inteligencia Satelital.
      </div>
    );
  }

  const bbox = active.center_lat != null && active.center_lng != null
    ? bboxFromCenter(active.center_lat, active.center_lng, 8)
    : null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-mono uppercase tracking-wider text-foreground flex items-center gap-2">
            <Satellite className="w-5 h-5 text-signal-cyan" />
            Inteligencia Satelital
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Mapeo mineral hiperespectral (EMIT/ASTER), monitoreo InSAR y volúmenes derivados de DEM. Proyecto: {active.name}.
          </p>
        </div>
      </header>

      <section>
        <HyperspectralPanel projectId={active.id} defaultBbox={bbox} />
      </section>

      <section>
        <InsarMonitoringPanel
          projectId={active.id}
          defaultCenter={active.center_lat != null && active.center_lng != null ? [active.center_lat, active.center_lng] : null}
        />
      </section>

      <section>
        <StockpileVolumesPanel
          projectId={active.id}
          defaultCenter={active.center_lat != null && active.center_lng != null ? [active.center_lat, active.center_lng] : null}
        />
      </section>
    </div>
  );
}

function bboxFromCenter(lat: number, lng: number, kmHalf: number): [number, number, number, number] {
  const dLat = kmHalf / 111;
  const dLng = kmHalf / (111 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}
