// Server fns públicos para el landing (sin auth). Sirven para SSR/prerender.
import { createServerFn } from "@tanstack/react-start";

export type PublicCommodityLot = {
  id: string;
  slug: string | null;
  title: string;
  commodity: string;
  form: string | null;
  grade_pct: number | null;
  grade_unit: string | null;
  tonnage_available_t: number | null;
  country: string | null;
  region: string | null;
  incoterm: string | null;
  asking_price_usd: number | null;
  currency: string | null;
  cover_image_url: string | null;
  summary: string | null;
  is_verified: boolean;
};

export const getPublicCommodityLots = createServerFn({ method: "GET" }).handler(async () => {
  // Lote público: RLS ya permite SELECT a rol `public` cuando
  // status='published' AND is_verified=true. Usamos admin sólo para saltar
  // el envelope de auth; proyectamos únicamente columnas seguras (sin
  // seller_user_id, organization_id, chain_of_custody, assay_report_url).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("commodity_lots")
    .select(
      "id,slug,title,commodity,form,grade_pct,grade_unit,tonnage_available_t,country,region,incoterm,asking_price_usd,currency,cover_image_url,summary,is_verified",
    )
    .eq("status", "published")
    .eq("is_verified", true)
    .order("verified_at", { ascending: false, nullsFirst: false })
    .limit(8);

  if (error) return [] as PublicCommodityLot[];
  return (data ?? []) as PublicCommodityLot[];
});
