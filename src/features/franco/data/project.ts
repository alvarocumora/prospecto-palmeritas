import type { PalmerasProject } from "@/features/palmeras/types";

// NOTA: Estas constantes reflejan el centroide oficial guardado en la tabla
// `projects` (id e5360f13-...). Cualquier ajuste debe hacerse primero en DB
// y luego sincronizarse aquí — projectFacts.functions.ts es la fuente única.
export const FRANCO_PROJECT: PalmerasProject = {
  name: "Prospecto Gianfranco",
  ref: "GF-001",
  operator: "Geocapitals · en representación",
  coords: "-32.4278, -71.0669",
  location: "Comuna de Cabildo, Provincia Petorca, Región de Valparaíso, Chile",
  status: "Exploración",
  created: "2026",
};
