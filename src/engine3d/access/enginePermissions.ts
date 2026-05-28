// Engine permissions — Sprint 6
// Mapea ProjectRole (matriz multi-tenant del proyecto) a roles funcionales del engine
// y a una matriz de capacidades por tab/acción.
import type { ProjectRole } from "@/hooks/useProjectRole";

export type EngineRole = "admin" | "geologist" | "engineer" | "investor" | "auditor";

export type EngineCapability =
  | "viewer.read"
  | "section.read"
  | "section.export"
  | "resource.read"
  | "resource.compute"
  | "estimation.edit"
  | "qaqc.read"
  | "qaqc.write"
  | "ai.read"
  | "ai.generate"
  | "targets.read"
  | "targets.write"
  | "targets.export"
  | "reports.read"
  | "reports.generate"
  | "audit.read"
  | "comments.read"
  | "comments.write"
  | "comments.moderate"
  | "data.import"
  | "model.persist"
  | "model.delete";

const ALL_ENGINE_ROLES: EngineRole[] = ["admin", "geologist", "engineer", "investor", "auditor"];

export function mapProjectRoleToEngine(role: ProjectRole | null): EngineRole | null {
  if (!role) return null;
  switch (role) {
    case "owner":
    case "admin":
    case "project_manager":
      return "admin";
    case "chief_geologist":
    case "geologist":
    case "qaqc_officer":
      return "geologist";
    case "drilling_supervisor":
    case "field_technician":
    case "hse_officer":
    case "community_relations":
      return "engineer";
    case "external_consultant":
      return "auditor";
    case "viewer":
      return "investor";
    default:
      return "investor";
  }
}

const MATRIX: Record<EngineCapability, EngineRole[]> = {
  "viewer.read": ALL_ENGINE_ROLES,
  "section.read": ALL_ENGINE_ROLES,
  "section.export": ["admin", "geologist", "engineer", "auditor"],
  "resource.read": ALL_ENGINE_ROLES,
  "resource.compute": ["admin", "geologist", "engineer"],
  "estimation.edit": ["admin", "geologist"],
  "qaqc.read": ALL_ENGINE_ROLES,
  "qaqc.write": ["admin", "geologist"],
  "ai.read": ALL_ENGINE_ROLES,
  "ai.generate": ["admin", "geologist"],
  "targets.read": ALL_ENGINE_ROLES,
  "targets.write": ["admin", "geologist"],
  "targets.export": ["admin", "geologist", "engineer", "auditor"],
  "reports.read": ALL_ENGINE_ROLES,
  "reports.generate": ["admin", "geologist", "engineer"],
  "audit.read": ["admin", "geologist", "engineer", "auditor"],
  "comments.read": ALL_ENGINE_ROLES,
  "comments.write": ["admin", "geologist", "engineer", "auditor"],
  "comments.moderate": ["admin"],
  "data.import": ["admin", "geologist"],
  "model.persist": ["admin", "geologist"],
  "model.delete": ["admin"],
};

export function canEngine(role: EngineRole | null, capability: EngineCapability): boolean {
  if (!role) return false;
  return MATRIX[capability].includes(role);
}

export function isInvestor(role: EngineRole | null): boolean {
  return role === "investor";
}

export function engineRoleLabel(role: EngineRole | null): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "geologist":
      return "Geologist";
    case "engineer":
      return "Engineer";
    case "investor":
      return "Investor";
    case "auditor":
      return "Auditor";
    default:
      return "—";
  }
}

export function engineRoleColor(role: EngineRole | null): string {
  switch (role) {
    case "admin":
      return "bg-red-500/20 text-red-300 border-red-500/40";
    case "geologist":
      return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    case "engineer":
      return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
    case "investor":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    case "auditor":
      return "bg-violet-500/20 text-violet-300 border-violet-500/40";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
