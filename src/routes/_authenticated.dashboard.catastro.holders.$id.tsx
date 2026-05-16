import { createFileRoute } from "@tanstack/react-router";
import { HolderProfile } from "@/components/ops/HolderProfile";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/dashboard/catastro/holders/$id")({
  head: () => ({ meta: [{ title: "Perfil del titular — Geocapitals" }] }),
  component: HolderProfilePage,
});

function HolderProfilePage() {
  const { id } = Route.useParams();
  const { active } = useProjects();
  const { user } = useAuth();

  if (!active || !user) {
    return <div className="p-6 text-text-secondary text-sm">Selecciona un proyecto.</div>;
  }

  return (
    <div className="p-4 md:p-6 pb-20 md:pb-6">
      <HolderProfile
        holderId={id}
        projectId={active.id}
        projectName={active.name}
        userId={user.id}
      />
    </div>
  );
}
