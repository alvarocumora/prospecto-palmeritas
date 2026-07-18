import { createFileRoute, redirect } from "@tanstack/react-router";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import { HolderProfile } from "@/components/ops/HolderProfile";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/catastro/proyecto/titulares/$id")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
  },
  head: () => ({ meta: [{ title: "Perfil del titular — Geocapitals" }] }),
  component: HolderProfilePage,
});

function HolderProfilePage() {
  const { id } = Route.useParams();
  const { active } = useProjects();
  const { user } = useAuth();

  if (!active || !user) {
    return (
      <PublicCatastroShell>
        <div className="p-6 text-muted-foreground text-sm">Selecciona un proyecto.</div>
      </PublicCatastroShell>
    );
  }

  return (
    <PublicCatastroShell>
      <div className="p-4 md:p-6 pb-20 md:pb-6">
        <HolderProfile
          holderId={id}
          projectId={active.id}
          projectName={active.name}
          userId={user.id}
        />
      </div>
    </PublicCatastroShell>
  );
}
