import { createFileRoute } from "@tanstack/react-router";
import { LegacyWorkspaceEntry } from "@/features/projects/workspace/LegacyWorkspaceEntry";
import { projectWorkspaceSearch } from "@/lib/projects/workspace";

export const Route = createFileRoute("/_authenticated/dashboard/qaqc")({
  validateSearch: projectWorkspaceSearch,
  head: () => ({ meta: [{ title: "QA/QC — Geocapitals" }] }),
  component: LegacyPage,
});

function LegacyPage() {
  return <LegacyWorkspaceEntry section="validation" />;
}
