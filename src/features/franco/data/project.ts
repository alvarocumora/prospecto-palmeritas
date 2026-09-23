import type { PalmerasProject } from "@/features/palmeras/types";
import { CHOLQUI } from "./cholqui";

// Derivado de la fuente única `cholqui.ts` — no editar valores aquí.
export const CHOLQUI_PROJECT: PalmerasProject = {
  name: CHOLQUI.name,
  ref: CHOLQUI.ref,
  operator: CHOLQUI.operator,
  coords: `${CHOLQUI.center.lat}, ${CHOLQUI.center.lng}`,
  location: CHOLQUI.location,
  status: CHOLQUI.stage,
  created: "2026",
};

/** @deprecated Legacy alias. Franco/Gianfranco is the former project name. */
export const FRANCO_PROJECT = CHOLQUI_PROJECT;
