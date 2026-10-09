import { createFileRoute } from "@tanstack/react-router";
import { LegacyWorkspaceEntry } from "@/features/projects/workspace/LegacyWorkspaceEntry";
import { projectWorkspaceSearch } from "@/lib/projects/workspace";

export const Route = createFileRoute("/_authenticated/dashboard/targets")({
  validateSearch: projectWorkspaceSearch,
  head: () => ({ meta: [{ title: "Targets Pipeline — Geocapitals" }] }),
  component: LegacyPage,
});

function LegacyPage() {
  return <LegacyWorkspaceEntry section="targets" />;
}
