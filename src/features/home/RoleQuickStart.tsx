import { Link } from "@tanstack/react-router";
import { ArrowRight, type LucideIcon } from "lucide-react";
import {
  Briefcase,
  Compass,
  FileSignature,
  FolderKanban,
  Handshake,
  LineChart,
  Map as MapIcon,
  PackageSearch,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { ROLE_LABEL, type AccessRole } from "@/lib/access/workspaceAccess";

type Action = { to: string; label: string; detail: string; icon: LucideIcon };

const BY_ROLE: Record<AccessRole, Action[]> = {
  admin: [
    {
      to: "/dashboard/expediente",
      label: "Expediente maestro",
      detail: "Readiness de cada proyecto y qué falta para transaccionar.",
      icon: FolderKanban,
    },
    {
      to: "/dashboard/trades",
      label: "Mesa de operaciones",
      detail: "Trades activos, compliance y screening.",
      icon: Handshake,
    },
    {
      to: "/dashboard/approvals",
      label: "Aprobaciones",
      detail: "Revisa lo que espera tu visto bueno.",
      icon: ShieldCheck,
    },
    {
      to: "/dashboard/clientes",
      label: "Clientes y proveedores",
      detail: "Contrapartes, KYC y bandeja de proveedores.",
      icon: Users,
    },
  ],
  catastro: [
    {
      to: "/catastro/mapa",
      label: "Catastro del proyecto",
      detail: "Concesiones, patentes y alertas del boletín.",
      icon: MapIcon,
    },
    {
      to: "/dashboard/projects",
      label: "Proyectos",
      detail: "Mission control, mapa táctico y campañas.",
      icon: Compass,
    },
    {
      to: "/dashboard/ni43101",
      label: "Reportes & 43-101",
      detail: "Informes técnicos y validación de datos.",
      icon: FileSignature,
    },
  ],
  trade: [
    {
      to: "/dashboard/trades",
      label: "Mis operaciones",
      detail: "Avanza cada pedido por su etapa comercial.",
      icon: Handshake,
    },
    {
      to: "/dashboard/sourcing",
      label: "Requerimientos y RFQ",
      detail: "Demanda de compradores y tus cotizaciones.",
      icon: PackageSearch,
    },
    {
      to: "/dashboard/documentos",
      label: "Documentos & firmas",
      detail: "NDA, LOI, ICPO y SPA listos para enviar.",
      icon: FileSignature,
    },
  ],
  capital: [
    {
      to: "/dashboard/deals",
      label: "Deal flow",
      detail: "Proyectos disponibles y estado de cada deal.",
      icon: Briefcase,
    },
    {
      to: "/dashboard/investments",
      label: "Mi portafolio",
      detail: "Posiciones y seguimiento de tus inversiones.",
      icon: LineChart,
    },
  ],
};

/**
 * Punto de partida según el rol efectivo del usuario: en vez de mostrar todo
 * el sistema, muestra las 3–4 acciones que le corresponden.
 */
export function RoleQuickStart() {
  const { profile } = useAuth();
  const { roles, role, ready } = useWorkspaceAccess();
  if (!ready || !role) return null;

  const isInvestor = profile?.account_type === "investor";
  const ordered: AccessRole[] = isInvestor
    ? (["capital", ...roles.filter((r) => r !== "capital")] as AccessRole[])
    : roles;

  const seen = new Set<string>();
  const actions: Action[] = [];
  for (const r of ordered) {
    for (const a of BY_ROLE[r] ?? []) {
      if (isInvestor && r !== "capital") continue;
      if (seen.has(a.to)) continue;
      seen.add(a.to);
      actions.push(a);
    }
  }
  if (actions.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            Tu punto de partida
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Accesos según tu rol en el sistema maestro.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {ordered.map((r) => (
            <span
              key={r}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground"
            >
              {ROLE_LABEL[r]}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3">
        {actions.slice(0, 8).map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="group rounded border border-border p-3 hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              <a.icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{a.label}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{a.detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
