import { Link } from "@tanstack/react-router";
import { SentinelProcessingPanel } from "@/components/satellite/SentinelProcessingPanel";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import type { TerminalProject } from "./terminalProjects";

export function TerminalSatellitePanel({ project }: { project: TerminalProject }) {
  const { user, loading: authLoading } = useAuth();
  const { projects, loading, error, refresh } = useProjects();
  // Resolve this terminal's UUID, never the workspace's unrelated active project.
  const matches = projects.filter((item) =>
    project.projectId ? item.id === project.projectId : item.code === project.code,
  );
  const memberProject = matches.length === 1 ? matches[0] : null;
  const lat = memberProject?.center_lat;
  const lng = memberProject?.center_lng;
  const halfKm = 4;
  const defaultBbox: [number, number, number, number] | null =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
      ? [
          lng - halfKm / (111 * Math.cos((lat * Math.PI) / 180)),
          lat - halfKm / 111,
          lng + halfKm / (111 * Math.cos((lat * Math.PI) / 180)),
          lat + halfKm / 111,
        ]
      : null;

  return (
    <section className="space-y-4 text-content" aria-label="Análisis satelital del proyecto">
      <header className="rounded-xl border border-hairline bg-surface-2 p-5 space-y-2">
        <h1 className="font-display text-2xl">Análisis satelital · {project.name}</h1>
        <p className="text-sm text-content-subtle">
          Define el área de análisis, busca escenas Sentinel-2 y selecciona una para procesar
          reflectancia real. Descarga los índices derivados como GeoTIFF privado.
        </p>
        <p className="text-xs text-content-subtle">
          Los índices son resultados modelados a partir de observaciones satelitales; no acreditan
          minerales medidos. El área inicial es editable y no representa la tenencia del proyecto.
        </p>
      </header>
      {authLoading || (user && loading) ? (
        <p role="status">Comprobando acceso al proyecto…</p>
      ) : !user ? (
        <div className="rounded-xl border border-hairline bg-surface p-5 space-y-3">
          <p>Inicia sesión con una cuenta miembro de {project.name} para procesar escenas.</p>
          <Link
            to="/auth"
            className="inline-block rounded border border-accent-brand px-4 py-2 text-accent-brand"
          >
            Iniciar sesión
          </Link>
        </div>
      ) : error ? (
        <div role="alert" className="space-y-3">
          <p>No se pudo comprobar el acceso al proyecto: {error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-accent-brand underline"
          >
            Reintentar
          </button>
        </div>
      ) : !memberProject ? (
        <p role="alert">
          Tu cuenta no tiene un proyecto miembro vinculado a {project.name}. Solicita acceso al
          equipo del proyecto.
        </p>
      ) : (
        <SentinelProcessingPanel
          key={memberProject.id}
          projectId={memberProject.id}
          defaultBbox={defaultBbox}
        />
      )}
    </section>
  );
}
