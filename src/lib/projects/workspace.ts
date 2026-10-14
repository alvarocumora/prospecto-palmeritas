import { projectIdFromSearch, projectView, type ProjectView } from "./navigation";
import { getPublicProjectById } from "./catalog";
import type { TerminalTabKey } from "@/features/terminal/terminalProjects";

export const PROJECT_WORKSPACE_SECTIONS = [
  { id: "overview", label: "Resumen", legacyPath: "/dashboard/project-report" },
  { id: "exploration", label: "Exploración", legacyPath: "/dashboard/geophysics" },
  { id: "targets", label: "Targets", legacyPath: "/dashboard/targets" },
  { id: "model", label: "Modelo 3D", legacyPath: "/dashboard/project-report" },
  { id: "validation", label: "Validación", legacyPath: "/dashboard/qaqc" },
] as const;

export type ProjectWorkspaceSection = (typeof PROJECT_WORKSPACE_SECTIONS)[number]["id"];
export type ProjectWorkspacePanel = "mapa" | "satelite" | "spv";
export type ProjectWorkspaceSearch = {
  view?: ProjectView;
  panel?: ProjectWorkspacePanel;
};

export function projectWorkspaceSection(value: unknown): ProjectWorkspaceSection | null {
  return PROJECT_WORKSPACE_SECTIONS.find((section) => section.id === value)?.id ?? null;
}

export function projectWorkspaceSearch(search: Record<string, unknown>): ProjectWorkspaceSearch {
  return {
    view: search.view == null ? undefined : projectView(search.view),
    panel: search.panel === "satelite" || search.panel === "spv" ? search.panel : undefined,
  };
}

export function projectWorkspacePath(projectId: string, section: ProjectWorkspaceSection): string {
  if (!projectIdFromSearch(projectId))
    throw new Error("El identificador del proyecto no es válido.");
  return `/projects/${projectId}/${section}`;
}

/** Las secciones nuevas conservan la política de acceso de la pantalla migrada. */
export function projectWorkspaceLegacyPath(pathname: string): string {
  const match = /^\/projects\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  if (!match || !projectIdFromSearch(match[1])) return pathname;
  return (
    PROJECT_WORKSPACE_SECTIONS.find((section) => section.id === match[2])?.legacyPath ?? pathname
  );
}

/** Published projects use the terminal for their map and target views. */
export function publishedTerminalDestination(
  projectId: string,
  section: ProjectWorkspaceSection,
): { slug: string; tab: TerminalTabKey; view: ProjectView } | null {
  const project = getPublicProjectById(projectId);
  if (!project || project.status !== "published") return null;

  if (section === "overview" || section === "targets") {
    return { slug: project.slug, tab: "mapa", view: "2d" };
  }
  if (section === "model") return { slug: project.slug, tab: "mapa", view: "3d" };
  return null;
}
