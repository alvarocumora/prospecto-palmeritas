import type { PalmerasProject } from "@/features/palmeras/types";
import { CHOLQUI } from "./cholqui";

// Canonical project identity. Derived from the single source of truth cholqui.ts.
export const CHOLQUI_PROJECT: PalmerasProject = {
  name: CHOLQUI.name,
  ref: CHOLQUI.ref,
  operator: CHOLQUI.operator,
  coords: `${CHOLQUI.center.lat}, ${CHOLQUI.center.lng}`,
  location: CHOLQUI.location,
  status: CHOLQUI.stage,
  created: "2026",
};

/**
 * @deprecated Legacy compatibility only. Franco/Gianfranco is a former name
 * of Proyecto Cholqui and must not be treated as a separate project.
 */
export const FRANCO_PROJECT = CHOLQUI_PROJECT;
