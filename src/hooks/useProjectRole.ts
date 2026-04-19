import { useProjects } from "./useProjects";

export type ProjectRole =
  | "owner"
  | "admin"
  | "project_manager"
  | "chief_geologist"
  | "geologist"
  | "qaqc_officer"
  | "field_technician"
  | "drilling_supervisor"
  | "hse_officer"
  | "community_relations"
  | "viewer"
  | "external_consultant";

/** Returns the current user's role on the active project (or null). */
export function useProjectRole(): ProjectRole | null {
  const { active } = useProjects();
  return (active?.role as ProjectRole | undefined) ?? null;
}

const ALL_VIEW: ProjectRole[] = [
  "owner", "admin", "project_manager", "chief_geologist", "geologist",
  "qaqc_officer", "field_technician", "drilling_supervisor", "hse_officer",
  "community_relations", "viewer", "external_consultant",
];

/** Permission matrix per module. */
export const MODULE_ROLES: Record<string, ProjectRole[]> = {
  overview: ALL_VIEW,
  catastro: ALL_VIEW,
  geophysics: ALL_VIEW,
  drilling: ALL_VIEW,
  sampling: ALL_VIEW,
  qaqc: ["owner", "admin", "project_manager", "chief_geologist", "geologist", "qaqc_officer"],
  palmeras: ["owner", "admin", "project_manager", "chief_geologist", "geologist"],
  projects: ["owner", "admin", "project_manager"],
  team: ["owner", "admin", "project_manager"],
  audit: ["owner", "admin", "project_manager", "chief_geologist"],
  approvals: ["owner", "admin", "project_manager", "chief_geologist", "geologist", "qaqc_officer"],
  targets: ["owner", "admin", "project_manager", "chief_geologist", "geologist", "external_consultant", "viewer"],
  inventory: ["owner", "admin", "project_manager", "chief_geologist", "geologist", "qaqc_officer", "field_technician", "drilling_supervisor"],
  finance: ["owner", "admin", "project_manager", "chief_geologist"],
  marketplace: ["owner", "admin", "project_manager", "chief_geologist", "geologist"],
  profile: ALL_VIEW,
  settings: ["owner"],
};

/** Roles allowed to write (create/edit/delete) data. */
export const WRITE_ROLES: ProjectRole[] = [
  "owner", "admin", "project_manager", "chief_geologist", "geologist",
  "qaqc_officer", "field_technician", "drilling_supervisor",
];

export function canAccess(role: ProjectRole | null, module: keyof typeof MODULE_ROLES): boolean {
  if (!role) return false;
  return MODULE_ROLES[module].includes(role);
}

export function canWrite(role: ProjectRole | null): boolean {
  if (!role) return false;
  return WRITE_ROLES.includes(role);
}
