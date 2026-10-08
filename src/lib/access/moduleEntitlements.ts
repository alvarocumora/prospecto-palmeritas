type ModuleKey = "catastro" | "commodities" | "capital";

export type ModuleEntitlements = {
  unrestricted: boolean;
  modules: ModuleKey[];
};

/** Missing, failed or malformed entitlement lookups never grant module access. */
export function parseModuleEntitlements(
  data: unknown,
  error: unknown,
): ModuleEntitlements {
  const denied: ModuleEntitlements = { unrestricted: false, modules: [] };
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return denied;
  const payload = data as Record<string, unknown>;
  if (typeof payload.unrestricted !== "boolean" || !Array.isArray(payload.modules)) {
    return denied;
  }
  const modules: ModuleKey[] = [];
  for (const value of payload.modules) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return denied;
    const key = (value as Record<string, unknown>).key;
    if (key !== "catastro" && key !== "commodities" && key !== "capital") return denied;
    if (!modules.includes(key)) modules.push(key);
  }
  return { unrestricted: payload.unrestricted, modules };
}
