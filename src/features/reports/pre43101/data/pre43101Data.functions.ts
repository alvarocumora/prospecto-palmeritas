// Server function que agrega TODOS los datos del proyecto para el informe pre-NI 43-101.
// Devuelve un DTO serializable plano. PÚBLICO (demo Los Verdes) — usa admin
// client dentro del handler para lectura RLS-bypass de datos ya publicables.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ projectId: z.string().uuid() });

export type Pre43101Data = Awaited<ReturnType<typeof getPre43101Data>>;

export const getPre43101Data = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabase = supabaseAdmin;
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
      supabase
        .from("mining_concessions")
        .select("id,name,code,status,area_ha,holder,concession_type,expires_at")
        .eq("project_id", pid)
        .limit(200),
      supabase
        .from("satellite_anomalies")
        .select("id,index_code,severity,score,detected_at,area_ha")
        .eq("project_id", pid)
        .order("score", { ascending: false })
        .limit(500),
      supabase
        .from("veins")
        .select(
          "id,name,code,commodity,strike_deg,dip_deg,length_m,thickness_m,grade_estimate,depth_top_m,depth_bottom_m",
        )
        .eq("project_id", pid)
        .limit(50),
      supabase
        .from("exploration_targets")
        .select(
          "id,name,code,target_type,priority,stage,commodity,score,confidence_pct,lat,lng,elevation_m,rationale",
        )
        .eq("project_id", pid)
        .order("priority", { ascending: false })
        .limit(200),
      supabase
        .from("mag_targets")
        .select("id,name,lat,lon,mag_nt,rank,radius_m,source")
        .eq("project_id", pid)
        .order("rank", { ascending: true })
        .limit(50),
      supabase
        .from("resource_models")
        .select("*")
        .eq("project_id", pid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("drill_holes")
        .select(
          "id,hole_id,easting,northing,elevation,azimuth,dip,planned_depth,actual_depth,status,target_zone",
        )
        .eq("project_id", pid)
        .limit(200),
      supabase
        .from("geophysics_surveys")
        .select(
          "id,name,method,instrument,planned_km,line_spacing_m,station_spacing_m,status,acquisition_date",
        )
        .eq("project_id", pid)
        .limit(50),
      supabase
        .from("qaqc_results")
        .select("id,sample_code,qc_type,element,measured_value,status,measured_at")
        .eq("project_id", pid)
        .limit(200),
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
