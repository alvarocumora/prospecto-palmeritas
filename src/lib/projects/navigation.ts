import { canonicalProjectSlug, getPublicProject } from "./catalog";

export type ProjectView = "2d" | "3d";

export type SatelliteSelection = {
  project?: string;
  anomaly?: string;
  insar?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function projectIdFromSearch(value: unknown): string | undefined {
  return typeof value === "string" && UUID.test(value) ? value : undefined;
}

export function privateProjectSearch(search: Record<string, unknown>): { project?: string } {
  if (search.project == null) return { project: undefined };
  const project = projectIdFromSearch(search.project);
  if (!project) throw new Error("El identificador del proyecto no es válido.");
  return { project };
}

export function workspaceProjectId(pathname: string, searchProject: unknown): string | undefined {
  const match = /^(?:\/dashboard)?\/projects\/([^/]+)(?:\/[^/]+)?\/?$/.exec(pathname);
  return projectIdFromSearch(match?.[1]) ?? projectIdFromSearch(searchProject);
}

export function projectView(value: unknown): ProjectView {
  return value === "3d" ? "3d" : "2d";
}

export function satelliteSelection(search: Record<string, unknown>): SatelliteSelection {
  return {
    project: typeof search.project === "string" ? search.project : undefined,
    anomaly: typeof search.anomaly === "string" ? search.anomaly : undefined,
    insar: typeof search.insar === "string" ? search.insar : undefined,
  };
}

export function satelliteTerminalRedirect(search: SatelliteSelection) {
  const slug = search.project ? canonicalProjectSlug(search.project) : null;
  if (!slug || search.anomaly || search.insar) return null;
  return { slug, search: { tab: "mapa" as const, view: "3d" as const } };
}

export function findSatelliteProject<T extends { id: string }>(
  projects: readonly T[],
  requestedId?: string,
): T | null {
  if (requestedId) {
    const id = getPublicProject(requestedId)?.projectId ?? requestedId;
    return projects.find((project) => project.id === id) ?? null;
  }
  return projects[0] ?? null;
}

export function projectNavigationHref(
  pathname: string,
  searchStr: string,
  hash: string,
  projectId: string,
): string {
  const search = new URLSearchParams(searchStr);
  const workspace = /^\/projects\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  if (workspace) {
    pathname = `/projects/${projectId}/${workspace[2]}`;
    search.delete("project");
  } else {
    search.set("project", projectId);
  }
  const fragment = hash.replace(/^#/, "");
  return `${pathname}?${search.toString()}${fragment ? `#${fragment}` : ""}`;
}
