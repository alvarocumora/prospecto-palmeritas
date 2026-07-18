import { createFileRoute, redirect } from "@tanstack/react-router";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import { CatastroProjectPage } from "@/features/catastro-project/CatastroProjectPage";
import { supabase } from "@/integrations/supabase/client";

// Vista "catastro por proyecto" bajo el árbol público /catastro/*.
// Requiere sesión — si no hay usuario, redirige a /auth conservando el retorno.
export const Route = createFileRoute("/catastro/proyecto")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth", search: { redirect: "/catastro/proyecto" } as never });
    }
  },
  head: () => ({
    meta: [
      { title: "Catastro · vista proyecto — Geocapitals" },
      {
        name: "description",
        content:
          "Concesiones, titulares, patentes, conflictos y vigilancia SERNAGEOMIN para tu proyecto minero.",
      },
    ],
  }),
  component: ProjectCatastroRoute,
});

function ProjectCatastroRoute() {
  return (
    <PublicCatastroShell>
      <CatastroProjectPage />
    </PublicCatastroShell>
  );
}
