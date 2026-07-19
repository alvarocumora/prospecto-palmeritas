import type { PalmerasProject } from "@/features/palmeras/types";

// NOTA: Ficha de presentación del proyecto (antes "Gianfranco/Distrito Franco",
// renombrado a "Proyecto Cholqui"). El slug/rutas internas siguen siendo
// `franco` para no romper enlaces. Las coordenadas son aproximadas, derivadas
// del UTM PSAD'56 Zona 19H de los documentos del proyecto; confirmar centroide
// oficial contra el plano de pertenencias.
export const FRANCO_PROJECT: PalmerasProject = {
  name: "Proyecto Cholqui",
  ref: "CHQ-001",
  operator: "Volcania Minerals SpA",
  coords: "-33.72, -71.04",
  location: "Cholqui, Cajón de Panamá, Melipilla, Región Metropolitana, Chile",
  status: "Exploración avanzada",
  created: "2026",
};
