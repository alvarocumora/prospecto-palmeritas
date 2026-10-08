// Verificación de rol EN EL SERVIDOR (espejo de src/lib/access/workspaceAccess.ts).
//
// El gate de rutas del cliente sólo protege la UI: el endpoint RPC de cada
// server function sigue siendo invocable directamente. Estos middlewares son
// la frontera real de seguridad: resuelven el rol efectivo del usuario contra
// la base (app_roles, profiles.account_type y get_my_modules) y rechazan con
// 403 cualquier consulta o generación de documentos sin autorización válida.
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseModuleEntitlements } from "./moduleEntitlements";

export type ServerAccessRole = "admin" | "catastro" | "trade" | "capital";

type ModuleKey = "catastro" | "commodities" | "capital";

const MODULE_TO_ROLE: Record<ModuleKey, ServerAccessRole> = {
  catastro: "catastro",
  commodities: "trade",
  capital: "capital",
};

export type ServerAccess = {
  userId: string;
  isSuperAdmin: boolean;
  isStaff: boolean;
  accountType: "investor" | "mining_owner" | "geocapitals_team" | null;
  unrestricted: boolean;
  modules: ModuleKey[];
  roles: ServerAccessRole[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type SupabaseLike = {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Resuelve el rol efectivo del usuario autenticado desde la base. */
export async function resolveServerAccess(
  supabase: SupabaseLike,
  userId: string,
): Promise<ServerAccess> {
  const [roleRes, profileRes, modulesRes] = await Promise.all([
    supabase
      .from("app_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle(),
    supabase.from("profiles").select("account_type").eq("id", userId).maybeSingle(),
    supabase.rpc("get_my_modules"),
  ]);

  const isSuperAdmin = !!roleRes?.data;
  const accountType = (profileRes?.data?.account_type ?? null) as ServerAccess["accountType"];
  const { unrestricted, modules } = parseModuleEntitlements(modulesRes?.data, modulesRes?.error);

  const roles = new Set<ServerAccessRole>();
  const isStaff = isSuperAdmin || accountType === "geocapitals_team";
  if (isStaff) roles.add("admin");
  const effective: ModuleKey[] = unrestricted ? ["catastro", "commodities", "capital"] : modules;
  for (const m of effective) roles.add(MODULE_TO_ROLE[m]);

  return { userId, isSuperAdmin, isStaff, accountType, unrestricted, modules, roles: [...roles] };
}

/**
 * Middleware factory: exige sesión válida + uno de los roles indicados.
 * Deja `access` en el contexto para reglas adicionales dentro del handler.
 */
export function requireWorkspaceRole(...allowed: ServerAccessRole[]) {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ next, context }) => {
      const access = await resolveServerAccess(
        context.supabase as unknown as SupabaseLike,
        context.userId,
      );
      const ok = access.roles.includes("admin") || allowed.some((r) => access.roles.includes(r));
      if (!ok) {
        throw new Response(
          `Forbidden: se requiere rol ${allowed.join(" o ")} para esta operación`,
          { status: 403 },
        );
      }
      return next({ context: { access } });
    });
}

/** Sólo staff de Geocapitals / super admin. */
export const requireAdminRole = requireWorkspaceRole("admin");
/** Módulo Trade & Commodities. */
export const requireTradeRole = requireWorkspaceRole("trade");
/** Módulo Catastro & Exploración. */
export const requireCatastroRole = requireWorkspaceRole("catastro");
/** Módulo Capital & Deals. */
export const requireCapitalRole = requireWorkspaceRole("capital");

/** Cualquier módulo del sistema maestro (documentos y firmas transversales). */
export const requireAnyModuleRole = requireWorkspaceRole("trade", "capital", "catastro");
