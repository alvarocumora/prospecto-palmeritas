export const PROJECT_WORKSPACE_SECTIONS = [
  "overview",
  "cadastre",
  "exploration",
  "targets",
  "model",
  "economics",
  "mining",
  "documents",
  "validation",
] as const;

export type ProjectWorkspaceSection = (typeof PROJECT_WORKSPACE_SECTIONS)[number];

export const PROJECT_WORKSPACE_SECTION_LABELS: Record<ProjectWorkspaceSection, string> = {
  overview: "Resumen",
  cadastre: "Catastro",
  exploration: "Exploración",
  targets: "Targets",
  model: "Modelo / 3D",
  economics: "Economía",
  mining: "Explotación",
  documents: "Documentos",
  validation: "Validación",
};

export const PROJECT_EVIDENCE_STATES = [
  "verified",
  "derived",
  "conceptual",
  "pending",
] as const;

export type ProjectEvidenceState = (typeof PROJECT_EVIDENCE_STATES)[number];

export function projectWorkspacePath(
  projectId: string,
  section: ProjectWorkspaceSection = "overview",
): string {
  return `/projects/${encodeURIComponent(projectId)}/${section}`;
}

export function isProjectWorkspaceSection(value: string): value is ProjectWorkspaceSection {
  return PROJECT_WORKSPACE_SECTIONS.includes(value as ProjectWorkspaceSection);
}
