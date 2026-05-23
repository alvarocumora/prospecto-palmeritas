import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LOSVERDES_PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";

export type PublicTarget = {
  id: string;
  code: string;
  name: string;
  target_type: string;
  commodity: string | null;
  lat: number | null;
  lng: number | null;
  elevation_m: number | null;
  stage: string;
  priority: string;
  score: number | null;
  rationale: string | null;
};

export type PublicProjectLayers = {
  project: { id: string; name: string; center_lat: number | null; center_lng: number | null };
  targets: PublicTarget[];
};

export const getLosVerdesPublicLayers = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicProjectLayers> => {
    const { data: project, error: pErr } = await supabaseAdmin
      .from("projects")
      .select("id, name, center_lat, center_lng")
      .eq("id", LOSVERDES_PROJECT_ID)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!project) throw new Error("Proyecto no encontrado");

    const { data: targets, error: tErr } = await supabaseAdmin
      .from("exploration_targets")
      .select(
        "id, code, name, target_type, commodity, lat, lng, elevation_m, stage, priority, score, rationale",
      )
      .eq("project_id", LOSVERDES_PROJECT_ID)
      .neq("stage", "closed")
      .order("priority", { ascending: false })
      .order("score", { ascending: false });
    if (tErr) throw new Error(tErr.message);

    return {
      project: {
        id: project.id,
        name: project.name,
        center_lat: project.center_lat != null ? Number(project.center_lat) : null,
        center_lng: project.center_lng != null ? Number(project.center_lng) : null,
      },
      targets: (targets ?? []) as PublicTarget[],
    };
  },
);
