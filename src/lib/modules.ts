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
  if (["deals", "investments", "listings", "offerings", "opportunities"].includes(seg)) {
    return "capital";
  }
  // Commodities & Trading
  if (
    [
      "trades",
      "trade-board",
      "commodity-lots",
      "sourcing",
      "marketplace",
      "my-inquiries",
      "clientes",
      "proveedor",
      "proveedores",
      "cobranza",
      "envios",
      "fletes",
      "anticipos",
      "precios",
      "documentos",
      "firmas",
      "finance",
      "invitaciones",
      "enlaces",
    ].includes(seg)
  ) {
    return "commodities";
  }
  // Core / transversal
  if (
    [
      "analytics",
      "plan",
      "api",
      "profile",
      "admin",
      "agents",
      "command-center",
    ].includes(seg)
  ) {
    return "core";
  }
  // Todo lo demás cae en catastro (proyectos, exploración, catastro, geofísica, etc.)
  return "catastro";
}
