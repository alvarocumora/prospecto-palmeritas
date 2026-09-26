import type { ProjectSpatialContext } from "@/lib/spatial/projectSpatialContext";
import { searchCadastre, type GlobalCadastreResult } from "@/lib/cadastre/searchCadastre";
import type { CadastreCountry } from "@/lib/cadastre/types";

export type ProjectCadastreContext = {
  projectId: string;
  result: GlobalCadastreResult;
  queriedAt: string;
};

/** Resolve official concessions intersecting the project AOI through the single Global Cadastre Core. */
export async function resolveProjectCadastre(
  context: ProjectSpatialContext,
): Promise<ProjectCadastreContext> {
  if (context.countryCode !== "CL") {
    const result = await searchCadastre({
      scope: { kind: "bbox", country: context.countryCode as CadastreCountry, bbox: context.bboxWgs84 },
    });
    return { projectId: context.projectId, result, queriedAt: new Date().toISOString() };
  }
  const result = await searchCadastre({
    scope: {
      kind: "project",
      country: "CL",
      projectId: context.projectId,
      bbox: context.bboxWgs84,
    },
  });
  return { projectId: context.projectId, result, queriedAt: new Date().toISOString() };
}
