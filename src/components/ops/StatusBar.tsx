import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useUnreadCatastroAlerts } from "@/hooks/useUnreadCatastroAlerts";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getPublicProjectById } from "@/lib/projects/catalog";
import { StatusDot } from "./StatusDot";

export function StatusBar() {
  const { user } = useAuth();
  const { active } = useProjects();
  const { total: alerts } = useUnreadCatastroAlerts(active?.id ?? null);
  const online = useOnlineStatus();
  const publicProject = active ? getPublicProjectById(active.id) : null;
  if (!user) return null;

  return (
    <footer
      className="hidden md:flex fixed bottom-0 left-0 right-0 z-30 h-6 border-t border-border bg-bg-panel/95 backdrop-blur items-center px-2 gap-3 font-mono text-[10px] text-text-mono"
      role="status"
      aria-live="polite"
    >
      <StatusDot
        status={online ? "live" : "crit"}
        pulse={online}
        label={online ? "EN LÍNEA" : "SIN CONEXIÓN"}
      />
      <span aria-hidden="true" className="text-text-dim">
        ·
      </span>
      {publicProject?.status === "published" ? (
        <Link
          to="/terminal/$slug"
          params={{ slug: publicProject.slug }}
          search={{ tab: "mapa" }}
          className="max-w-48 truncate hover:text-signal-cyan transition-colors"
          title={`${active?.name ?? "Proyecto"} · ${active?.code ?? ""}`}
        >
          {active?.name ?? active?.code}
        </Link>
      ) : (
        <Link
          to="/dashboard/projects"
          className="max-w-48 truncate hover:text-signal-cyan transition-colors"
          title={active?.name ?? "Seleccionar proyecto"}
        >
          {active?.name ?? "Seleccionar proyecto"}
        </Link>
      )}
      <span aria-hidden="true" className="text-text-dim">
        ·
      </span>
      <Link
        to="/dashboard/boletin"
        className="inline-flex items-center gap-1 hover:text-signal-amber transition-colors"
      >
        {alerts > 0 && <StatusDot status="warn" />}
        <span className="tabular-nums">{alerts}</span>
        <span className="hidden lg:inline">alertas de catastro</span>
      </Link>
      <div className="flex-1" />
      <Link to="/contacto" className="hidden lg:inline hover:text-signal-cyan transition-colors">
        Soporte
      </Link>
      <span aria-hidden="true" className="hidden lg:inline text-text-dim">
        ·
      </span>
      <Link to="/metodologia" className="hidden lg:inline hover:text-signal-cyan transition-colors">
        Cumplimiento
      </Link>
    </footer>
  );
}
