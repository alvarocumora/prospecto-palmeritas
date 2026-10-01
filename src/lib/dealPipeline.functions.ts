// Pipeline interno de deals (tabla `deals`): etapas PROSPECCIÓN → EXIT,
// con pedimentos y alertas hijas. Acceso: módulo Capital + RLS del deal.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCapitalRole } from "@/lib/access/roleMiddleware";

export const PIPELINE_STAGES = [
  "PROSPECCION",
  "PEDIMENTO",
  "EXPLORACION",
  "CERTIFICACION",
  "EXIT",
] as const;
export const PIPELINE_LABEL: Record<string, string> = {
  PROSPECCION: "Prospección",
  PEDIMENTO: "Pedimento",
  EXPLORACION: "Exploración",
  CERTIFICACION: "Certificación",
  EXIT: "Exit",
};

export type DealProfile = {
  status?: string;
  subtype?: string;
  aoi_ha?: number;
  pedimentos?: number;
  ha_per_pedimento?: number;
  datum?: string;
  center_lat?: number;
  center_lon?: number;
  elevation_m?: number;
  owner?: string;
  datasheet_url?: string;
  geochem?: {
    ree_max_ppm?: number;
    provenance?: string;
    ree_type?: string;
    regolith_depth_m?: number;
    host_rock?: string;
    ree_carrier?: string;
  };
  comparable?: { name?: string; ticker?: string; event?: string };
  qp?: { name?: string; phone?: string; email?: string; standard?: string; status?: string };
  target_standard?: string;
  exit_options?: string[];
  spectral_indices?: string[];
  scientific_refs?: string[];
};

export type PipelineAlert = {
  id: string;
  alert_type: string;
  priority: string;
  title: string;
  description: string | null;
  resolved: boolean;
};

export type PipelineDeal = {
  id: string;
  code: string;
  name: string;
  region: string | null;
  commodity: string | null;
  pipeline_stage: string;
  description: string | null;
  created_at: string;
  profile: DealProfile;
  alerts: PipelineAlert[];
};

export type PipelinePedimento = {
  id: string;
  seq: number;
  name: string;
  ha: number | null;
  court: string | null;
  status: string;
  n_from: number | null;
  n_to: number | null;
  e_from: number | null;
  e_to: number | null;
  datum: string | null;
};

export const listPipelineDeals = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("deals")
      .select(
        "id,code,name,region,commodity,pipeline_stage,description,created_at,profile,deal_alerts(id,alert_type,priority,title,description,resolved)",
      )
      .order("code");
    if (error) throw new Error(error.message);
    return (data ?? []).map((d) => {
      const { deal_alerts, ...rest } = d as typeof d & { deal_alerts: PipelineAlert[] };
      return { ...rest, profile: (rest.profile ?? {}) as DealProfile, alerts: deal_alerts ?? [] };
    }) as PipelineDeal[];
  });

export const getPipelineDeal = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .inputValidator((d) => z.object({ code: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: deal, error } = await context.supabase
      .from("deals")
      .select(
        "id,code,name,region,commodity,pipeline_stage,description,created_at,profile,deal_alerts(id,alert_type,priority,title,description,resolved),deal_pedimentos(id,seq,name,ha,court,status,n_from,n_to,e_from,e_to,datum)",
      )
      .eq("code", data.code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deal) return null;
    const { deal_alerts, deal_pedimentos, ...rest } = deal as typeof deal & {
      deal_alerts: PipelineAlert[];
      deal_pedimentos: PipelinePedimento[];
    };
    return {
      deal: {
        ...rest,
        profile: (rest.profile ?? {}) as DealProfile,
        alerts: deal_alerts ?? [],
      } as PipelineDeal,
      pedimentos: [...(deal_pedimentos ?? [])].sort((a, b) => a.seq - b.seq),
    };
  });
