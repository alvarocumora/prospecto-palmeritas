import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deriveRequirement,
  rankLots,
  type InquiryIntent,
  type LotForMatch,
} from "@/lib/matchmaking";

// Agente de matchmaking: recomienda lotes publicados al comprador autenticado
// según su intención histórica (sus commodity_inquiries). Privacidad-segura:
// el comprador solo ve lotes públicos; no expone identidades.

export type RecommendedLot = {
  id: string;
  title: string;
  slug: string | null;
  commodity: string;
  country: string;
  tonnageAvailableT: number | null;
  coverImageUrl: string | null;
  score: number;
  reasons: string[];
};

export const recommendLotsForBuyer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecommendedLot[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Consultas del comprador → intención.
    const { data: inquiries } = await supabaseAdmin
      .from("commodity_inquiries")
      .select("lot_id, target_volume_t, target_price_usd_t")
      .eq("buyer_user_id", context.userId)
      .limit(100);
    if (!inquiries?.length) return [];

    const inquiredLotIds = Array.from(new Set(inquiries.map((i) => i.lot_id)));
    const { data: inquiredLots } = await supabaseAdmin
      .from("commodity_lots")
      .select("id, commodity")
      .in("id", inquiredLotIds);
    const commodityOf = new Map((inquiredLots ?? []).map((l) => [l.id, l.commodity as string]));

    const intents: InquiryIntent[] = inquiries
      .map((i) => ({
        commodity: commodityOf.get(i.lot_id) ?? "",
        targetVolumeT: i.target_volume_t != null ? Number(i.target_volume_t) : null,
        targetPriceUsdT: i.target_price_usd_t != null ? Number(i.target_price_usd_t) : null,
      }))
      .filter((i) => i.commodity);
    if (!intents.length) return [];

    const requirement = deriveRequirement(intents);

    // Lotes publicados y verificados, excluyendo los que ya consultó.
    const { data: lots } = await supabaseAdmin
      .from("commodity_lots")
      .select(
        "id, title, slug, commodity, country, tonnage_available_t, asking_price_usd, premium_discount_usd_t, cover_image_url",
      )
      .eq("status", "published")
      .eq("is_verified", true)
      .limit(300);
    const candidates = (lots ?? []).filter((l) => !inquiredLotIds.includes(l.id));

    const forMatch: LotForMatch[] = candidates.map((l) => ({
      id: l.id,
      commodity: l.commodity as string,
      tonnageAvailableT: l.tonnage_available_t != null ? Number(l.tonnage_available_t) : null,
      askingPriceUsd: l.asking_price_usd != null ? Number(l.asking_price_usd) : null,
      premiumDiscountUsdT:
        l.premium_discount_usd_t != null ? Number(l.premium_discount_usd_t) : null,
    }));

    const ranked = rankLots(requirement, forMatch).slice(0, 6);
    const byId = new Map(candidates.map((l) => [l.id, l]));

    return ranked
      .map((m): RecommendedLot | null => {
        const l = byId.get(m.lotId);
        if (!l) return null;
        return {
          id: l.id,
          title: l.title as string,
          slug: (l.slug as string) ?? null,
          commodity: l.commodity as string,
          country: l.country as string,
          tonnageAvailableT: l.tonnage_available_t != null ? Number(l.tonnage_available_t) : null,
          coverImageUrl: (l.cover_image_url as string) ?? null,
          score: m.score,
          reasons: m.reasons,
        };
      })
      .filter((x): x is RecommendedLot => x !== null);
  });
