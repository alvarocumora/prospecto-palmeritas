// Server function que agrega TODOS los datos del proyecto para el informe pre-NI 43-101.
// Devuelve un DTO serializable plano.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ projectId: z.string().uuid() });

export type Pre43101Data = Awaited<ReturnType<typeof getPre43101Data>>;

export const getPre43101Data = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const pid = data.projectId;

    const [
      projectRes,
      concessionsRes,
      satAnomsRes,
      veinsRes,
      targetsRes,
      magTargetsRes,
      resourceModelRes,
      drillHolesRes,
      geophysRes,
      qaqcRes,
    ] = await Promise.all([
      supabase.from("projects").select("*").eq("id", pid).maybeSingle(),
      supabase.from("mining_concessions").select("id,name,code,status,area_ha,holder,concession_type,expiry_date").eq("project_id", pid).limit(200),
      supabase.from("satellite_anomalies").select("id,lat,lng,score,anomaly_type,detected_at,confidence,area_m2").eq("project_id", pid).order("score", { ascending: false }).limit(500),
      supabase.from("veins").select("id,name,strike,dip,length_m,thickness_m,grade_au,grade_cu,grade_ag,depth_top_m,depth_bottom_m").eq("project_id", pid).limit(50),
      supabase.from("exploration_targets").select("id,name,target_type,priority,status,easting,northing,elevation,depth_m,commodity").eq("project_id", pid).order("priority", { ascending: false }).limit(200),
      supabase.from("mag_targets").select("id,name,score,intensity_nt,depth_estimate_m,centroid_lat,centroid_lng").eq("project_id", pid).order("score", { ascending: false }).limit(50),
      supabase.from("resource_models").select("*").eq("project_id", pid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("drill_holes").select("id,name,easting,northing,elevation,azimuth,dip,total_depth_m").eq("project_id", pid).limit(200),
      supabase.from("geophysics_surveys").select("id,name,method,line_count,station_count,acquired_at").eq("project_id", pid).limit(50),
      supabase.from("qaqc_results").select("id,batch_id,passed,note,created_at").eq("project_id", pid).limit(200),
    ]);

    return {
      project: projectRes.data ?? null,
      concessions: concessionsRes.data ?? [],
      satAnomalies: satAnomsRes.data ?? [],
      veins: veinsRes.data ?? [],
      targets: targetsRes.data ?? [],
      magTargets: magTargetsRes.data ?? [],
      resourceModel: resourceModelRes.data ?? null,
      drillHoles: drillHolesRes.data ?? [],
      geophysicsSurveys: geophysRes.data ?? [],
      qaqcResults: qaqcRes.data ?? [],
      counts: {
        concessions: concessionsRes.data?.length ?? 0,
        satAnomalies: satAnomsRes.data?.length ?? 0,
        veins: veinsRes.data?.length ?? 0,
        targets: targetsRes.data?.length ?? 0,
        magTargets: magTargetsRes.data?.length ?? 0,
        drillHoles: drillHolesRes.data?.length ?? 0,
        geophysicsSurveys: geophysRes.data?.length ?? 0,
        qaqcResults: qaqcRes.data?.length ?? 0,
        hasResourceModel: !!resourceModelRes.data,
      },
      generatedAt: new Date().toISOString(),
    };
  });
