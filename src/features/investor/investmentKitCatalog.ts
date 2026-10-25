/**
 * Public investor kit discovery (no storage/download ACL in this module).
 *
 * "view" means an existing project page, NOT a downloadable private document.
 * Restricted and transaction items never expose a URL from the public catalogue.
 * Future authenticated document service must enforce project/ticket ACL separately.
 */
export type KitAccess = "public_page" | "requires_project_permission" | "ticket_owner_only";

export type KitCatalogueItem = {
  id: string;
  title: string;
  description: string;
  access: KitAccess;
  tab?: "mapa" | "tesis" | "simulador" | "dataroom";
};

export const INVESTOR_KIT_CATALOGUE: readonly KitCatalogueItem[] = [
  {
    id: "map",
    title: "Mapa y contexto geoespacial",
    description: "Consulta las capas y su procedencia en el visor del proyecto.",
    access: "public_page",
    tab: "mapa",
  },
  {
    id: "thesis",
    title: "Ficha, tesis y riesgos",
    description: "Etapa declarada, hipótesis y términos referenciales sujetos a revisión.",
    access: "public_page",
    tab: "tesis",
  },
  {
    id: "simulation",
    title: "Simulación personalizada",
    description: "Escenarios ilustrativos; no crea un ticket ni una posición.",
    access: "public_page",
    tab: "simulador",
  },
  {
    id: "technical",
    title: "Informes técnicos y antecedentes",
    description: "Se facilitan solo si existen, están autorizados y se concede acceso.",
    access: "requires_project_permission",
  },
  {
    id: "financial",
    title: "Modelo financiero confidencial",
    description: "Sujeto a autorización específica del proyecto; no basta con registrarse.",
    access: "requires_project_permission",
  },
  {
    id: "contract",
    title: "Contrato y documento firmado",
    description: "Solo si el equipo emite el contrato para el ticket correspondiente.",
    access: "ticket_owner_only",
  },
  {
    id: "statement",
    title: "Certificado y cartola de participación",
    description: "Disponible al titular únicamente después de la liquidación confirmada.",
    access: "ticket_owner_only",
  },
];

export function publicKitItems(): readonly KitCatalogueItem[] {
  return INVESTOR_KIT_CATALOGUE.filter((item) => item.access === "public_page");
}
