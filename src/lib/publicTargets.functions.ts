import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PublicTarget = {
  id: string;
  code: string;
  name: string;
  target_type: string;
  commodity: string | null;
  priority: "low" | "medium" | "high" | "critical";
  stage: string;
  score: number | null;
  lat: number | null;
  lng: number | null;
  rationale: string | null;
  evidence: Record<string, string | number | boolean | null> | null;
};

export type PublicTargetsPayload = {
  project: { id: string; code: string; name: string };
  targets: PublicTarget[];
};

export const getPublicProjectTargets = createServerFn({ method: "GET" })
  .inputValidator((input: { projectId: string }) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicTargetsPayload> => {
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, code, name")
      .eq("id", data.projectId)
      .single();
    if (projErr || !project) throw new Error("Proyecto no encontrado");

    const { data: targets, error: tErr } = await supabaseAdmin
      .from("exploration_targets")
      .select(
        "id, code, name, target_type, commodity, priority, stage, score, lat, lng, rationale, evidence",
      )
      .eq("project_id", data.projectId)
      .order("priority", { ascending: false })
      .order("score", { ascending: false });
    if (tErr) throw new Error(tErr.message);

    return {
      project: project as PublicTargetsPayload["project"],
      targets: (targets ?? []) as PublicTarget[],
    };
  });
