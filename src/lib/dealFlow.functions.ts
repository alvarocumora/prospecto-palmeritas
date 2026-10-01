// Spine único de inversión: máquina de estados del deal sobre
// property_deal_inquiries (interesado → NDA → data room → oferta →
// due diligence → cierre) con bitácora en deal_stage_events.
//
// La autorización real vive en el RPC SECURITY DEFINER `deal_advance`
// (titular del listing, interesado o staff), aquí sólo exigimos módulo Capital.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCapitalRole } from "@/lib/access/roleMiddleware";

export const DEAL_STAGES = [
  "interesado",
  "nda_firmado",
  "data_room",
  "oferta",
  "due_diligence",
  "cierre",
] as const;

/** Estados fuera de la línea principal (pausa y salidas). */
export const DEAL_OFF_STAGES = [
  "pausado",
  "retirado",
  "rechazado",
  "expirado",
  "descartado",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number] | (typeof DEAL_OFF_STAGES)[number];

/** Estados finales: el deal ya no admite transiciones. */
export const DEAL_TERMINAL_STAGES: DealStage[] = [
  "cierre",
  "retirado",
  "rechazado",
  "expirado",
  "descartado",
];

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  interesado: "Interesado",
  nda_firmado: "NDA firmado",
  data_room: "Data room",
  oferta: "Oferta",
  due_diligence: "Due diligence",
  cierre: "Cierre",
  pausado: "En pausa",
  retirado: "Retirado",
  rechazado: "Rechazado",
  expirado: "Expirado",
  descartado: "Descartado",
};

export type DealStageEvent = {
  id: string;
  from_stage: string | null;
  to_stage: string;
  note: string | null;
  created_at: string;
};

export type DealFlowState = {
  inquiryId: string;
  listingId: string;
  stage: DealStage;
  stageUpdatedAt: string | null;
  ndaSignedAt: string | null;
  isOwner: boolean;
  nextStages: DealStage[];
  events: DealStageEvent[];
};

const FORWARD: Record<string, DealStage | undefined> = {
  interesado: "nda_firmado",
  nda_firmado: "data_room",
  data_room: "oferta",
  oferta: "due_diligence",
  due_diligence: "cierre",
};

/**
 * Refleja la máquina de estados del RPC `deal_advance`: desde cualquier etapa
 * viva se puede avanzar, pausar, retirarse o rechazar; desde pausa se retoma
 * la etapa previa registrada en la bitácora.
 */
function nextStagesFor(stage: DealStage, resumeStage: DealStage | null): DealStage[] {
  if (DEAL_TERMINAL_STAGES.includes(stage)) return [];
  if (stage === "pausado") {
    return [resumeStage ?? "interesado", "retirado", "rechazado"];
  }
  const forward = FORWARD[stage];
  return [...(forward ? [forward] : []), "pausado", "retirado", "rechazado"];
}

/** Etapa + bitácora del deal del usuario actual (o del titular) para un listing. */
export const getDealFlow = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .inputValidator((d) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DealFlowState | null> => {
    const sb = context.supabase;
    const { data: listing } = await sb
      .from("property_listings")
      .select("id, owner_user_id")
      .eq("id", data.listingId)
      .maybeSingle();
    const isOwner = listing?.owner_user_id === context.userId;

    const { data: inquiry } = await sb
      .from("property_deal_inquiries")
      .select("id, listing_id, stage, stage_updated_at, nda_signed_at")
      .eq("listing_id", data.listingId)
      .eq("inquirer_user_id", context.userId)
      .maybeSingle();
    if (!inquiry) return null;

    const { data: events } = await sb
      .from("deal_stage_events")
      .select("id, from_stage, to_stage, note, created_at")
      .eq("inquiry_id", inquiry.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const stage = (inquiry.stage ?? "interesado") as DealStage;
    const resumeStage =
      stage === "pausado"
        ? (((events ?? []).find((e) => e.to_stage === "pausado")?.from_stage as
            DealStage | undefined) ?? null)
        : null;
    return {
      inquiryId: inquiry.id as string,
      listingId: inquiry.listing_id as string,
      stage,
      stageUpdatedAt: (inquiry.stage_updated_at as string | null) ?? null,
      ndaSignedAt: (inquiry.nda_signed_at as string | null) ?? null,
      isOwner,
      nextStages: nextStagesFor(stage, resumeStage),
      events: (events ?? []) as DealStageEvent[],
    };
  });

/** Avanza la etapa del deal; el RPC valida transición y autorización. */
export const advanceDealStage = createServerFn({ method: "POST" })
  .middleware([requireCapitalRole])
  .inputValidator((d) =>
    z
      .object({
        inquiryId: z.string().uuid(),
        stage: z.enum([...DEAL_STAGES, ...DEAL_OFF_STAGES]),
        note: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("deal_advance", {
      p_inquiry_id: data.inquiryId,
      p_stage: data.stage,
      p_note: data.note ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, stage: data.stage };
  });

export type OwnerPipelineRow = {
  inquiryId: string;
  listingId: string;
  listingTitle: string;
  stage: DealStage;
  stageUpdatedAt: string | null;
  createdAt: string;
  inquirerName: string | null;
};

/** Pipeline agregado de todos los listings del titular (vista Deal Flow). */
export const listOwnerDealPipeline = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .handler(async ({ context }): Promise<OwnerPipelineRow[]> => {
    const sb = context.supabase;
    const { data: listings } = await sb
      .from("property_listings")
      .select("id, title")
      .eq("owner_user_id", context.userId);
    if (!listings || listings.length === 0) return [];
    const byId = new Map(listings.map((l) => [l.id as string, l.title as string]));

    const { data: rows } = await sb
      .from("property_deal_inquiries")
      .select("id, listing_id, stage, stage_updated_at, created_at, inquirer_user_id")
      .in("listing_id", [...byId.keys()])
      .order("stage_updated_at", { ascending: false });
    if (!rows || rows.length === 0) return [];

    const { data: profiles } = await sb
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", Array.from(new Set(rows.map((r) => r.inquirer_user_id as string))));
    const names = new Map(
      (profiles ?? []).map((p) => [p.user_id as string, (p.display_name as string) ?? null]),
    );

    return rows.map((r) => ({
      inquiryId: r.id as string,
      listingId: r.listing_id as string,
      listingTitle: byId.get(r.listing_id as string) ?? "—",
      stage: ((r.stage as string) ?? "interesado") as DealStage,
      stageUpdatedAt: (r.stage_updated_at as string | null) ?? null,
      createdAt: r.created_at as string,
      inquirerName: names.get(r.inquirer_user_id as string) ?? null,
    }));
  });
