import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QualifiedPersonDirectoryRow = {
  id: string;
  user_id: string;
  full_name: string;
  profession: string;
  registration_body: string;
  competency_areas: string[] | null;
  bio: string | null;
  is_verified: boolean;
  country: string | null;
  accreditation_type: string | null;
  accreditation_grade: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Safe Qualified Persons directory (excludes signature_url, cv_url, license_no, cdv_history).
 * Requires an authenticated project member; runs via service_role on the server only.
 */
export const listQualifiedPersonsDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<QualifiedPersonDirectoryRow[]> => {
    const { data: project, error: projErr } = await context.supabase
      .from("projects")
      .select("id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projErr) throw new Error(projErr.message);
    if (!project) throw new Error("Sin acceso al proyecto");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("list_qualified_persons_directory");
    if (error) throw new Error(error.message);
    return (rows ?? []) as QualifiedPersonDirectoryRow[];
  });