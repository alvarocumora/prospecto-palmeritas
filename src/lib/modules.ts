import type { ModuleKey } from "@/hooks/useMyModules";

/**
 * Mapea una ruta de dashboard a su módulo SaaS.
 * Rutas "core" son transversales (siempre visibles).
 */
export function moduleForRoute(path: string): ModuleKey | "core" {
  const p = path.replace(/^\/dashboard\/?/, "");
  if (!p || p === "") return "core";
  const seg = p.split("/")[0];

  // Capital & Deals de Minas
  if (
    ["deals", "investments", "inversion-colateral", "listings", "offerings", "agua"].includes(seg)
  ) {
    return "capital";
  }
  // Commodities & Trading
  if (
    [
      "trades",
      "trade-board",
      "commodity-lots",
      "sourcing",
      "rfqs",
      "my-inquiries",
      "clientes",
      "proveedor",
      "proveedores",
      "cobranza",
      "envios",
      "anticipos",
      "precios",
      "documentos",
      "firmas",
    ].includes(seg)
  ) {
    return "commodities";
  }
  // Core / transversal (Administración)
  if (
    [
      "analytics",
      "plan",
      "api",
      "profile",
      "admin",
      "agents",
      "command-center",
      "approvals",
      "finance",
      "hse",
      "team",
      "audit",
      "marketplace",
    ].includes(seg)
  ) {
    return "core";
  }

  // Todo lo demás cae en catastro (proyectos, exploración, catastro, geofísica, etc.)
  return "catastro";
}
