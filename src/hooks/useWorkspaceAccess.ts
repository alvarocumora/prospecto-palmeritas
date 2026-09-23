import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useProjectRole } from "@/hooks/useProjectRole";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useMyModules } from "@/hooks/useMyModules";
import {
  canEnterEntry,
  canEnterPath,
  canEnterTab,
  primaryRole,
  resolveRoles,
  type AccessContext,
  type AccessRole,
} from "@/lib/access/workspaceAccess";
import type { WorkspaceEntry, WorkspaceTab } from "@/lib/workspace";

/**
 * Acceso por rol del sistema maestro (Catastro / Trade / Capital / Admin).
 * Se usa en el rail, en las pestañas y en el gate de contenido para que la
 * puerta de acceso y el interior de cada módulo digan siempre lo mismo.
 */
export function useWorkspaceAccess() {
  const { profile } = useAuth();
  const { projects } = useProjects();
  const projectRole = useProjectRole();
  const { isAdmin: isSuperAdmin, loading: adminLoading } = useIsSuperAdmin();
  const { data: myModules, isLoading: modulesLoading } = useMyModules();

  const ctx = useMemo<AccessContext>(
    () => ({
      isSuperAdmin,
      accountType: (profile?.account_type ?? null) as AccessContext["accountType"],
      unrestricted: myModules?.unrestricted ?? true,
      modules: (myModules?.modules ?? []).map((m) => m.key),
      projectRole,
      hasProjects: projects.length > 0,
    }),
    [isSuperAdmin, profile?.account_type, myModules, projectRole, projects.length],
  );

  return useMemo(() => {
    const roles = resolveRoles(ctx);
    return {
      ctx,
      roles,
      role: primaryRole(roles) as AccessRole | null,
      ready: !adminLoading && !modulesLoading,
      is: (r: AccessRole) => roles.includes(r),
      canEntry: (entry: WorkspaceEntry) => canEnterEntry(entry, ctx),
      canTab: (tab: WorkspaceTab) => canEnterTab(tab, ctx),
      canPath: (pathname: string) => canEnterPath(pathname, ctx),
    };
  }, [ctx, adminLoading, modulesLoading]);
}
