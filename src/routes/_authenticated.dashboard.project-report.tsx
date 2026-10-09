import { createFileRoute } from "@tanstack/react-router";
import { LegacyWorkspaceEntry } from "@/features/projects/workspace/LegacyWorkspaceEntry";
import { projectWorkspaceSearch } from "@/lib/projects/workspace";

export const Route = createFileRoute("/_authenticated/dashboard/project-report")({
  validateSearch: projectWorkspaceSearch,
  head: () => ({ meta: [{ title: "Workspace de proyecto — Geocapitals" }] }),
  component: LegacyPage,
});

function LegacyPage() {
  return <LegacyWorkspaceEntry section="overview" />;
}
