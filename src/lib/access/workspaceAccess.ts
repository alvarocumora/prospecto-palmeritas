import { projectWorkspaceLegacyPath } from "@/lib/projects/workspace";
// Control de acceso por rol del SISTEMA MAESTRO.
// Única fuente de verdad usada por: rail (puerta de acceso), pestañas de cada
// pantalla canónica y el gate de ruta del layout autenticado. Así la puerta y
// el interior de cada módulo nunca se contradicen.
import type { ModuleKey } from "@/hooks/useMyModules";
import { canAccess, type ProjectRole } from "@/hooks/useProjectRole";
import { findWorkspaceEntry, type WorkspaceEntry, type WorkspaceTab } from "@/lib/workspace";

export type AccessRole = "admin" | "catastro" | "trade" | "capital";

export type AccessContext = {
  /** super_admin en app_roles */
  isSuperAdmin: boolean;
  accountType: "investor" | "mining_owner" | "geocapitals_team" | null;
  /** El plan no restringe módulos. */
  unrestricted: boolean;
  /** Módulos habilitados por el plan. */
  modules: ModuleKey[];
  /** Rol del usuario en el proyecto activo. */
  projectRole: ProjectRole | null;
  /** Tiene al menos un proyecto asignado. */
  hasProjects: boolean;
};

export type AccessDecision = { allowed: true } | { allowed: false; reason: AccessDenyReason };

export type AccessDenyReason =
  | { kind: "role"; role: AccessRole }
  | { kind: "plan"; module: ModuleKey }
  | { kind: "capability"; capability: string }
  | { kind: "projects" }
  | { kind: "investor" };

const MODULE_TO_ROLE: Record<ModuleKey, AccessRole> = {
  catastro: "catastro",
  commodities: "trade",
  capital: "capital",
};

export const ROLE_LABEL: Record<AccessRole, string> = {
  admin: "Admin",
  catastro: "Catastro",
  trade: "Trade",
  capital: "Capital",
};

/** Conjunto de roles efectivos del usuario. */
export function resolveRoles(ctx: AccessContext): AccessRole[] {
  const roles = new Set<AccessRole>();
  if (ctx.isSuperAdmin || ctx.accountType === "geocapitals_team") roles.add("admin");
  const modules: ModuleKey[] = ctx.unrestricted
    ? ["catastro", "commodities", "capital"]
    : ctx.modules;
  for (const m of modules) roles.add(MODULE_TO_ROLE[m]);
  return [...roles];
}

/** Rol principal para mostrar en la UI (badge de la puerta de acceso). */
export function primaryRole(roles: AccessRole[]): AccessRole | null {
  if (roles.includes("admin")) return "admin";
  return roles[0] ?? null;
}

export function hasRole(ctx: AccessContext, role: AccessRole): boolean {
  return resolveRoles(ctx).includes(role);
}

function moduleAllowed(module: ModuleKey | "core", ctx: AccessContext): boolean {
  if (module === "core") return true;
  if (ctx.isSuperAdmin) return true;
  if (ctx.unrestricted) return true;
  return ctx.modules.includes(module);
}

/** ¿Puede entrar a una pantalla canónica del rail? */
export function canEnterEntry(entry: WorkspaceEntry, ctx: AccessContext): AccessDecision {
  const roles = resolveRoles(ctx);
  const isAdmin = roles.includes("admin");
  const isInvestor = ctx.accountType === "investor";

  if (entry.superAdminOnly && !ctx.isSuperAdmin) {
    return { allowed: false, reason: { kind: "role", role: "admin" } };
  }
  if (entry.hideForInvestor && isInvestor && !isAdmin) {
    return { allowed: false, reason: { kind: "investor" } };
  }
  if (entry.requiresProjects && isInvestor && !ctx.hasProjects) {
    return { allowed: false, reason: { kind: "projects" } };
  }
  if (!moduleAllowed(entry.module, ctx)) {
    return { allowed: false, reason: { kind: "plan", module: entry.module as ModuleKey } };
  }
  if (entry.capability && !isAdmin && !canAccess(ctx.projectRole, entry.capability)) {
    return { allowed: false, reason: { kind: "capability", capability: entry.capability } };
  }
  return { allowed: true };
}

/** ¿Puede ver una pestaña dentro de una pantalla canónica? */
export function canEnterTab(tab: WorkspaceTab, ctx: AccessContext): boolean {
  const roles = resolveRoles(ctx);
  const isAdmin = roles.includes("admin");
  const isInvestor = ctx.accountType === "investor";
  if (tab.hideForInvestor && isInvestor && !isAdmin) return false;
  if (tab.capability && !isAdmin && !canAccess(ctx.projectRole, tab.capability)) return false;
  return true;
}

/** ¿Puede entrar a un pathname interno? (gate de ruta y de contenido) */
export function canEnterPath(pathname: string, ctx: AccessContext): AccessDecision {
  pathname = projectWorkspaceLegacyPath(pathname);
  const entry = findWorkspaceEntry(pathname);
  if (!entry) return { allowed: true };
  const decision = canEnterEntry(entry, ctx);
  if (!decision.allowed) return decision;
  const tab = entry.tabs?.find((t) => pathname === t.to || pathname.startsWith(t.to + "/"));
  if (tab && !canEnterTab(tab, ctx)) {
    return tab.capability
      ? { allowed: false, reason: { kind: "capability", capability: tab.capability } }
      : { allowed: false, reason: { kind: "investor" } };
  }
  return { allowed: true };
}

export function denyMessage(reason: AccessDenyReason): { title: string; detail: string } {
  switch (reason.kind) {
    case "role":
      return {
        title: `Requiere rol ${ROLE_LABEL[reason.role]}`,
        detail: "Tu cuenta no tiene el rol necesario para esta sección del sistema maestro.",
      };
    case "plan":
      return {
        title: "Módulo no incluido en tu plan",
        detail: `El espacio ${ROLE_LABEL[MODULE_TO_ROLE[reason.module]]} no está habilitado. Actualiza tu plan para acceder.`,
      };
    case "capability":
      return {
        title: "Permiso insuficiente en el proyecto",
        detail: `Tu rol en el proyecto activo no permite abrir “${reason.capability}”. Pide acceso al administrador del proyecto.`,
      };
    case "projects":
      return {
        title: "Sin proyecto asignado",
        detail: "Necesitas al menos un proyecto activo para usar esta pantalla.",
      };
    case "investor":
      return {
        title: "Vista no disponible para inversionistas",
        detail: "Esta pantalla es operativa y está reservada a los equipos técnicos y de trade.",
      };
  }
}
