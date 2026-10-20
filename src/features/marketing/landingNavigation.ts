/**
 * Public entry points should let visitors choose an asset before entering
 * project-specific analysis, rather than silently opening a named mine.
 * Keep this separate from the authenticated project-scoped workspace nav.
 */
export const PUBLIC_INTELLIGENCE_PATHS = {
  geologicalLayers: "/catastro/mapa",
  satelliteImagery: "/satelital",
  dataAnalysis: "/terminal",
  projectEvaluation: "/proyectos",
} as const;
