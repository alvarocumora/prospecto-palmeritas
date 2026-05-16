import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { useProjects } from "@/hooks/useProjects";
import { HyperspectralPanel } from "@/components/satellite/HyperspectralPanel";
import { InsarMonitoringPanel } from "@/components/satellite/InsarMonitoringPanel";
import { StockpileVolumesPanel } from "@/components/satellite/StockpileVolumesPanel";
import { TargetSummariesPanel } from "@/components/satellite/TargetSummariesPanel";
import { SatelliteMapViewer } from "@/components/satellite/SatelliteMapViewer";
import { InsarAlertWorkflowPanel } from "@/components/satellite/InsarAlertWorkflowPanel";
import { SatelliteIntelPdfExport } from "@/components/satellite/SatelliteIntelPdfExport";
import { Satellite } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/satellite-intel")({
  component: SatelliteIntelPage,
});

function SatelliteIntelPage() {
  const { active } = useProjects();
  const mapRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const targetsRef = useRef<HTMLDivElement>(null);
  const hyperRef = useRef<HTMLDivElement>(null);
  const insarRef = useRef<HTMLDivElement>(null);
  const demRef = useRef<HTMLDivElement>(null);

  if (!active) {
    return (
      <div className="p-6 text-sm text-text-dim font-mono">
        Selecciona un proyecto para acceder a Inteligencia Satelital.
      </div>
    );
  }

  const bbox =
    active.center_lat != null && active.center_lng != null
      ? bboxFromCenter(active.center_lat, active.center_lng, 8)
      : null;

  const getSections = () => [
    { id: "map", title: "1. Visor de Mapa (AOI y capas)", element: mapRef.current },
    { id: "alerts", title: "2. Workflow de Alertas InSAR", element: alertRef.current },
    { id: "targets", title: "3. Resumen por Target", element: targetsRef.current },
    { id: "hyper", title: "4. Hiperespectral (EMIT/ASTER)", element: hyperRef.current },
    { id: "insar", title: "5. Monitoreo InSAR", element: insarRef.current },
    { id: "dem", title: "6. Volúmenes / DEM-diff", element: demRef.current },
  ];

  const getAnnexes = () => [
    {
      title: "Metadatos del Proyecto",
      rows: [
        ["Proyecto", active.name],
        ["ID", active.id],
        ["Centro (lat, lng)", `${active.center_lat ?? "—"}, ${active.center_lng ?? "—"}`],
        ["BBox AOI (8 km)", bbox ? bbox.join(", ") : "—"],
        ["Generado", new Date().toISOString()],
      ] as Array<[string, string]>,
    },
    {
      title: "Metodologías por módulo",
      rows: [
        [
          "Hiperespectral",
          "Productos EMIT/ASTER procesados con índices SWIR para minerales arcillosos, óxidos y carbonatos.",
        ],
        [
          "InSAR",
          "Series de desplazamiento LOS Sentinel-1 con coherencia y velocidad media; alertas por |v| ≥ 15 mm/yr.",
        ],
        [
          "DEM-diff",
          "Diferencia DEM multi-temporal para volúmenes de stockpiles y cambios morfológicos.",
        ],
      ] as Array<[string, string]>,
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-mono uppercase tracking-wider text-foreground flex items-center gap-2">
            <Satellite className="w-5 h-5 text-signal-cyan" />
            Inteligencia Satelital
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Mapeo mineral hiperespectral (EMIT/ASTER), monitoreo InSAR y volúmenes derivados de DEM.
            Proyecto: {active.name}.
          </p>
        </div>
        <SatelliteIntelPdfExport
          projectName={active.name}
          getSections={getSections}
          getAnnexes={getAnnexes}
        />
      </header>

      <section ref={mapRef}>
        <SatelliteMapViewer
          projectId={active.id}
          center={
            active.center_lat != null && active.center_lng != null
              ? [Number(active.center_lat), Number(active.center_lng)]
              : null
          }
        />
      </section>

      <section ref={alertRef}>
        <InsarAlertWorkflowPanel projectId={active.id} />
      </section>

      <section ref={targetsRef}>
        <TargetSummariesPanel projectId={active.id} />
      </section>

      <section ref={hyperRef}>
        <HyperspectralPanel projectId={active.id} defaultBbox={bbox} />
      </section>

      <section ref={insarRef}>
        <InsarMonitoringPanel
          projectId={active.id}
          defaultCenter={
            active.center_lat != null && active.center_lng != null
              ? [active.center_lat, active.center_lng]
              : null
          }
        />
      </section>

      <section ref={demRef}>
        <StockpileVolumesPanel
          projectId={active.id}
          defaultCenter={
            active.center_lat != null && active.center_lng != null
              ? [active.center_lat, active.center_lng]
              : null
          }
        />
      </section>
    </div>
  );
}

function bboxFromCenter(
  lat: number,
  lng: number,
  kmHalf: number,
): [number, number, number, number] {
  const dLat = kmHalf / 111;
  const dLng = kmHalf / (111 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}
