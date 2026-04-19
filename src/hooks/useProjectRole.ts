import { useProjects } from "./useProjects";

export type ProjectRole = "owner" | "admin" | "geologist" | "viewer";

/** Returns the current user's role on the active project (or null). */
export function useProjectRole(): ProjectRole | null {
  const { active } = useProjects();
  return (active?.role as ProjectRole | undefined) ?? null;
}

/** Permission matrix per module. */
export const MODULE_ROLES: Record<string, ProjectRole[]> = {
  overview: ["owner", "admin", "geologist", "viewer"],
  catastro: ["owner", "admin", "geologist", "viewer"],
  geophysics: ["owner", "admin", "geologist", "viewer"],
  drilling: ["owner", "admin", "geologist", "viewer"],
  sampling: ["owner", "admin", "geologist", "viewer"],
  palmeras: ["owner", "admin", "geologist"],
  projects: ["owner", "admin"],
  team: ["owner", "admin"],
  audit: ["owner", "admin"],
  marketplace: ["owner", "admin", "geologist"],
  profile: ["owner", "admin", "geologist", "viewer"],
  settings: ["owner"],
};

/** Roles allowed to write (create/edit/delete) data. */
export const WRITE_ROLES: ProjectRole[] = ["owner", "admin", "geologist"];

export function canAccess(role: ProjectRole | null, module: keyof typeof MODULE_ROLES): boolean {
  if (!role) return false;
  return MODULE_ROLES[module].includes(role);
}

export function canWrite(role: ProjectRole | null): boolean {
  if (!role) return false;
  return WRITE_ROLES.includes(role);
}
