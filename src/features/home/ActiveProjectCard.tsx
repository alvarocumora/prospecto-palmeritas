import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Bell, FileText, Map, Mountain } from "lucide-react";
import { useProjectMiningConcessions } from "@/hooks/useProjectMiningConcessions";
import { useUnreadCatastroAlerts } from "@/hooks/useUnreadCatastroAlerts";
import { getPublicProjectById } from "@/lib/projects/catalog";
import type { Project } from "@/hooks/useProjects";

export function ActiveProjectCard({ project }: { project: Project | null }) {
  const concessions = useProjectMiningConcessions(project?.id ?? null);
  const { total: alerts } = useUnreadCatastroAlerts(project?.id ?? null);
  if (!project) return null;

  const published = getPublicProjectById(project.id);
  const terminalSlug = published?.status === "published" ? published.slug : null;
  const areaHa = (concessions.data ?? []).reduce((sum, row) => {
    const area = Number(row.area_ha);
    return Number.isFinite(area) && area > 0 ? sum + area : sum;
  }, 0);
  const concessionCount = concessions.data?.length ?? 0;
  const areaLabel = concessions.isPending
    ? "Consultando catastro…"
    : concessions.isError
      ? "Superficie no disponible"
      : concessionCount === 0
        ? "Sin concesiones registradas"
        : `${concessionCount.toLocaleString("es-CL")} registros · ${
            areaHa > 0
              ? `${areaHa.toLocaleString("es-CL", { maximumFractionDigits: 1 })} ha registradas`
              : "superficie no informada"
          }`;

  return (
    <section className="rounded-xl border border-hairline bg-surface-elevated p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-content-subtle">
            Proyecto activo
          </p>
          <h2 className="mt-1 truncate font-display text-xl text-content">{project.name}</h2>
          <p className="mt-1 text-sm text-content-subtle">
            <span className="font-mono text-content">{project.code}</span>
            {project.region ? ` · ${project.region}` : ""}
            {project.country ? ` · ${project.country}` : ""}
          </p>
        </div>
        <span className="rounded-full border border-hairline px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-content-subtle">
          {project.status || "Estado no informado"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-hairline pt-3 text-xs text-content-subtle">
        <span className="inline-flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5" />
          {areaLabel}
          {!concessions.isError && !concessions.isPending && " · según registros del proyecto"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" />
          {alerts > 0 ? `${alerts} alertas de catastro sin revisar` : "Sin alertas pendientes"}
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-content-subtle">
        Los registros catastrales y sus superficies requieren validación de titularidad; no
        equivalen por sí solos a tenencia acreditada.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Link
          to="/catastro/mapa"
          search={{ project: project.id, vista: "proyecto" }}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-hairline px-3 py-2 text-xs font-medium text-content transition-colors hover:bg-surface"
        >
          <Map className="h-4 w-4" /> Catastro 2D
        </Link>
        {terminalSlug ? (
          <Link
            to="/terminal/$slug"
            params={{ slug: terminalSlug }}
            search={{ tab: "mapa", view: "3d" }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-accent-brand px-3 py-2 text-xs font-medium text-accent-brand-contrast transition-opacity hover:opacity-90"
          >
            <Mountain className="h-4 w-4" /> Terminal 3D
          </Link>
        ) : (
          <Link
            to="/projects/$projectId/$section"
            params={{ projectId: project.id, section: "model" }}
            search={{ project: undefined, view: "3d" }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-accent-brand px-3 py-2 text-xs font-medium text-accent-brand-contrast transition-opacity hover:opacity-90"
          >
            <Mountain className="h-4 w-4" /> Visor 3D
          </Link>
        )}
        {terminalSlug ? (
          <Link
            to="/terminal/$slug"
            params={{ slug: terminalSlug }}
            search={{ tab: "dataroom" }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-hairline px-3 py-2 text-xs font-medium text-content transition-colors hover:bg-surface"
          >
            <FileText className="h-4 w-4" /> Data room e informes
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        ) : (
          <Link
            to="/dashboard/reports"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-hairline px-3 py-2 text-xs font-medium text-content transition-colors hover:bg-surface"
          >
            <FileText className="h-4 w-4" /> Informes técnicos
          </Link>
        )}
      </div>
    </section>
  );
}
