import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "./useProjects";
import { useAuth } from "./useAuth";
import { useProjectRole, MODULE_ROLES, WRITE_ROLES, type ProjectRole } from "./useProjectRole";
import { toast } from "sonner";

export type Capability = {
  id: string;
  project_id: string;
  user_id: string;
  capability: string; // "module:view" | "module:edit" | "module:deny"
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
};

export type ModuleAction = "view" | "edit" | "deny";

export const MANAGEABLE_MODULES: { key: keyof typeof MODULE_ROLES; label: string }[] = [
  { key: "overview", label: "Resumen" },
  { key: "catastro", label: "Catastro" },
  { key: "geophysics", label: "Geofísica" },
  { key: "drilling", label: "Sondajes" },
  { key: "sampling", label: "Muestreo" },
  { key: "qaqc", label: "QA/QC" },
  { key: "palmeras", label: "Palmeras 3D" },
  { key: "targets", label: "Targets" },
  { key: "inventory", label: "Inventario" },
  { key: "finance", label: "Finanzas" },
  { key: "marketplace", label: "Marketplace" },
  { key: "hse", label: "HSE" },
  { key: "reports", label: "Reportes 43-101" },
  { key: "approvals", label: "Aprobaciones" },
  { key: "audit", label: "Auditoría" },
];

export function buildCapKey(module: string, action: ModuleAction) {
  return `${module}:${action}`;
}

export function parseCapKey(cap: string): { module: string; action: ModuleAction } | null {
  const [module, action] = cap.split(":");
  if (!module || !action) return null;
  if (action !== "view" && action !== "edit" && action !== "deny") return null;
  return { module, action };
}

/** Hook for managers to view/edit ALL capabilities in the project. */
export function useProjectCapabilities() {
  const { active } = useProjects();
  const { user } = useAuth();
  const [caps, setCaps] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!active?.id) { setCaps([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("project_member_capabilities")
      .select("*")
      .eq("project_id", active.id);
    if (error) toast.error(error.message);
    setCaps((data ?? []) as Capability[]);
    setLoading(false);
  }, [active?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const setCapability = async (userId: string, module: string, action: ModuleAction, enabled: boolean) => {
    if (!active?.id || !user) return;
    const cap = buildCapKey(module, action);
    if (enabled) {
      const { error } = await supabase.from("project_member_capabilities").upsert({
        project_id: active.id,
        user_id: userId,
        capability: cap,
        granted_by: user.id,
      }, { onConflict: "project_id,user_id,capability" });
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase
        .from("project_member_capabilities")
        .delete()
        .eq("project_id", active.id)
        .eq("user_id", userId)
        .eq("capability", cap);
      if (error) { toast.error(error.message); return; }
    }
    await refresh();
  };

  const clearMember = async (userId: string) => {
    if (!active?.id) return;
    const { error } = await supabase
      .from("project_member_capabilities")
      .delete()
      .eq("project_id", active.id)
      .eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Permisos restablecidos al rol por defecto");
    await refresh();
  };

  return { caps, loading, refresh, setCapability, clearMember };
}

/** Hook for the CURRENT user to know what they can see/edit. */
export function useMyCapabilities() {
  const { active } = useProjects();
  const { user } = useAuth();
  const role = useProjectRole();
  const [overrides, setOverrides] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!active?.id || !user) { setOverrides(new Set()); return; }
    let cancelled = false;
    supabase
      .from("project_member_capabilities")
      .select("capability,expires_at")
      .eq("project_id", active.id)
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const now = Date.now();
        const set = new Set<string>();
        for (const row of data ?? []) {
          if (row.expires_at && new Date(row.expires_at).getTime() < now) continue;
          set.add(row.capability as string);
        }
        setOverrides(set);
      });
    return () => { cancelled = true; };
  }, [active?.id, user?.id]);

  return {
    role,
    canView: (module: keyof typeof MODULE_ROLES) =>
      effectiveCanView(role, module, overrides),
    canEdit: (module: keyof typeof MODULE_ROLES) =>
      effectiveCanEdit(role, module, overrides),
  };
}

export function effectiveCanView(
  role: ProjectRole | null,
  module: keyof typeof MODULE_ROLES,
  overrides: Set<string>,
): boolean {
  if (overrides.has(buildCapKey(module, "deny"))) return false;
  if (overrides.has(buildCapKey(module, "view"))) return true;
  if (overrides.has(buildCapKey(module, "edit"))) return true;
  if (!role) return false;
  return MODULE_ROLES[module]?.includes(role) ?? false;
}

export function effectiveCanEdit(
  role: ProjectRole | null,
  module: keyof typeof MODULE_ROLES,
  overrides: Set<string>,
): boolean {
  if (overrides.has(buildCapKey(module, "deny"))) return false;
  if (overrides.has(buildCapKey(module, "edit"))) return true;
  if (!role) return false;
  // default: needs both module access AND role in WRITE_ROLES
  const inModule = MODULE_ROLES[module]?.includes(role) ?? false;
  const canWrite = WRITE_ROLES.includes(role);
  return inModule && canWrite;
}
