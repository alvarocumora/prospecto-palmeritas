import { createFileRoute, Link } from "@tanstack/react-router";
import { useProjects } from "@/hooks/useProjects";
import { TrackminGeoIntel } from "@/features/palmeras/TrackminDashboard";
import { FrancoDashboard } from "@/features/franco/FrancoDashboard";
import { FileText } from "lucide-react";
import { CanonicalProjectViewer } from "@/components/geo/CanonicalProjectViewer";
import { resolveProjectViewerProfile } from "@/lib/geospatial/projectViewerProfiles";

// Punto único de entrada a los reportes de proyecto piloto.
// Detecta el proyecto activo y monta el feature correspondiente.
export const Route = createFileRoute("/_authenticated/dashboard/project-report")({
  head: () => ({
    meta: [
      { title: "Reporte de proyecto — Geocapitals" },
      {
        name: "description",
        content: "Reporte interactivo del proyecto activo (Geocapitals · Pre NI 43-101).",
      },
    ],
  }),
  component: ProjectReportPage,
});

function ProjectReportPage() {
  const { active, loading } = useProjects();

  if (loading) {
    return <div className="p-8 text-xs font-mono text-muted-foreground">Cargando proyecto…</div>;
  }

  if (!active) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-xl font-mono text-gold mb-2">Sin proyecto activo</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Selecciona un proyecto en la barra superior o crea uno nuevo para ver su reporte.
        </p>
        <Link
          to="/dashboard/projects"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 text-xs font-mono"
        >
          <FileText className="w-3.5 h-3.5" /> Ir a proyectos
        </Link>
      </div>
    );
  }

  const profile = resolveProjectViewerProfile(active);

  if (profile?.key === "palmeras") {
    return <TrackminGeoIntel />;
  }

  if (profile?.key === "cholqui") {
    return <FrancoDashboard authenticated />;
  }

  if (profile?.key === "losverdes") {
    return (
      <div className="w-full p-4">
        <CanonicalProjectViewer profileKey="losverdes" heightClassName="h-[calc(100vh-8rem)]" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-mono text-gold mb-2">{active.name}</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Aún no hay un reporte interactivo para este proyecto. Usa los módulos de Mission Control
        (Targets, Estimación, NI 43-101) para construir uno.
      </p>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-border text-xs font-mono hover:bg-bg-elevated"
      >
        ← Volver a Mission Control
      </Link>
    </div>
  );
}
