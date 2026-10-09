import { createFileRoute } from "@tanstack/react-router";
import { LegacyProjectEntry } from "@/features/projects/LegacyProjectEntry";

export const Route = createFileRoute("/_authenticated/dashboard/palmeras")({
  component: () => <LegacyProjectEntry profileKey="palmeras" />,
});
