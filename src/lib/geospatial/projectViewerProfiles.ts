import type { GeoViewerPresetId } from "@/lib/geospatial/layerRegistry";

export type CanonicalProjectKey = "cholqui" | "palmeras" | "losverdes" | "toki2";

export type ProjectViewerProfile = {
  key: CanonicalProjectKey;
  title: string;
  subtitle: string;
  twoD: GeoViewerPresetId;
  threeD: GeoViewerPresetId;
  /** Tokens matched against project code and name. */
  matchTokens: readonly string[];
  /** Toki 2 is a focus/preset of Cholqui rather than a standalone project row. */
  parentKey?: Exclude<CanonicalProjectKey, "toki2">;
};

export const PROJECT_VIEWER_PROFILES: Record<CanonicalProjectKey, ProjectViewerProfile> = {
  cholqui: {
    key: "cholqui",
    title: "Cholqui · visor geocientífico",
    subtitle: "Catastro, satélite, terreno, targets y subsuelo desde los motores oficiales.",
    twoD: "official_workbench",
    threeD: "official_3d",
    matchTokens: ["CHOLQUI", "FRC", "FRANCO"],
  },
  palmeras: {
    key: "palmeras",
    title: "Prospecto Palmeras · visor geocientífico",
    subtitle: "Mapa 2D y escena 3D canónica para exploración, muestreo y sondajes.",
    twoD: "official_workbench",
    threeD: "official_3d",
    matchTokens: ["PALM", "PALMERAS", "TRK-ALH"],
  },
  losverdes: {
    key: "losverdes",
    title: "Los Verdes · visor geocientífico",
    subtitle: "Catastro, anomalías, muestreo, targets y modelos sobre la capa canónica.",
    twoD: "official_workbench",
    threeD: "official_3d",
    matchTokens: ["LV5", "VERDES", "TILAMA", "LV-TIL"],
  },
  toki2: {
    key: "toki2",
    title: "Toki 2 · plan de terreno",
    subtitle: "Preset de campo de Cholqui para DEM, catastro, estructuras y targets.",
    twoD: "toki2_field",
    threeD: "official_3d",
    matchTokens: ["CHOLQUI", "FRC", "FRANCO"],
    parentKey: "cholqui",
  },
};

type ProjectIdentity = {
  code?: string | null;
  name?: string | null;
};

function haystack(project: ProjectIdentity): string {
  return `${project.code ?? ""} ${project.name ?? ""}`.toUpperCase();
}

export function projectMatchesProfile(
  project: ProjectIdentity,
  profileKey: CanonicalProjectKey,
): boolean {
  const profile = PROJECT_VIEWER_PROFILES[profileKey];
  const value = haystack(project);
  return profile.matchTokens.some((token) => value.includes(token));
}

export function findProjectForProfile<T extends ProjectIdentity>(
  projects: readonly T[],
  profileKey: CanonicalProjectKey,
): T | null {
  return projects.find((project) => projectMatchesProfile(project, profileKey)) ?? null;
}

export function resolveProjectViewerProfile(
  project: ProjectIdentity | null | undefined,
): ProjectViewerProfile | null {
  if (!project) return null;
  for (const key of ["palmeras", "cholqui", "losverdes"] as const) {
    if (projectMatchesProfile(project, key)) return PROJECT_VIEWER_PROFILES[key];
  }
  return null;
}

export function getProjectViewerProfile(key: CanonicalProjectKey): ProjectViewerProfile {
  return PROJECT_VIEWER_PROFILES[key];
}
