// Server functions públicas y autenticadas para el marketplace de commodities.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// ---------- Types ----------
export type CommodityLotRow = {
  id: string;
  title: string;
  slug: string | null;
  commodity: string;
  form: string;
  grade_pct: number | null;
  moisture_pct: number | null;
  tonnage_available_t: number | null;
  lot_size_t: number | null;
  frequency: string | null;
  country: string;
  region: string | null;
  port_of_loading: string | null;
  incoterm: string | null;
  payment_terms: string | null;
  price_basis: string | null;
  premium_discount_usd_t: number | null;
  asking_price_usd: number | null;
  currency: string | null;
  certifications_json: string[] | null;
  cover_image_url: string | null;
  summary: string | null;
  description: string | null;
  status: string;
  is_verified: boolean;
  views_count: number;
  inquiry_count: number;
  created_at: string;
};

export type CommodityCertification = {
  id: string;
  code: string;
  name: string;
  issuer: string | null;
  description: string | null;
  category: string | null;
};

function serverPublicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// ---------- Public: list published lots ----------
const listInput = z.object({
  commodity: z.string().optional(),
  country: z.string().optional(),
  form: z.string().optional(),
  certification: z.string().optional(),
  incoterm: z.string().optional(),
  limit: z.number().int().min(1).max(60).optional(),
});

export const listPublishedCommodityLots = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => listInput.parse(d ?? {}))
  .handler(async ({ data }): Promise<CommodityLotRow[]> => {
    const supabase = serverPublicClient();
    let q = supabase
      .from("commodity_lots")
      .select(
        "id,title,slug,commodity,form,grade_pct,moisture_pct,tonnage_available_t,lot_size_t,frequency,country,region,port_of_loading,incoterm,payment_terms,price_basis,premium_discount_usd_t,asking_price_usd,currency,certifications_json,cover_image_url,summary,description,status,is_verified,views_count,inquiry_count,created_at",
      )
      .eq("status", "published")
      .eq("is_verified", true)
      .order("created_at", { ascending: false })
      // El filtro de certificación se aplica en memoria: pedir de más para no
      // truncar resultados antes de filtrar.
      .limit(data.certification ? 200 : (data.limit ?? 40));

    if (data.commodity) q = q.eq("commodity", data.commodity as never);
    if (data.form) q = q.eq("form", data.form as never);
    if (data.country) q = q.eq("country", data.country);
    if (data.incoterm) q = q.eq("incoterm", data.incoterm as never);

    const { data: rows, error } = await q;
    if (error) {
      console.error("[listPublishedCommodityLots]", error);
      return [];
    }
    let list = (rows ?? []).map((r) => ({
      ...(r as unknown as CommodityLotRow),
      certifications_json: Array.isArray(
        (r as { certifications_json: unknown }).certifications_json,
      )
        ? ((r as { certifications_json: unknown[] }).certifications_json as string[])
        : null,
    })) as CommodityLotRow[];
    if (data.certification) {
      list = list
        .filter((r) => (r.certifications_json ?? []).includes(data.certification as string))
        .slice(0, data.limit ?? 40);
    }
    return list;
  });

// ---------- Public: get single lot detail ----------
const detailInput = z.object({ id: z.string().uuid() });

export type CommodityLotDetail = CommodityLotRow & {
  certifications: Array<
    CommodityCertification & {
      certificate_number: string | null;
      issued_at: string | null;
      expires_at: string | null;
      verification_url: string | null;
    }
  >;
};

export const getCommodityLotDetail = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => detailInput.parse(d))
  .handler(async ({ data }): Promise<CommodityLotDetail | null> => {
    const supabase = serverPublicClient();
    const { data: lot, error } = await supabase
      .from("commodity_lots")
      .select("*")
      .eq("id", data.id)
      .eq("status", "published")
      .eq("is_verified", true)
      .maybeSingle();

    if (error || !lot) return null;

    const { data: joins } = await supabase
      .from("commodity_lot_certifications")
      .select(
        "certificate_number,issued_at,expires_at,verification_url,commodity_certifications(id,code,name,issuer,description,category)",
      )
      .eq("lot_id", data.id);

    const certifications = (joins ?? []).map((row) => {
      const c = (row as unknown as { commodity_certifications: CommodityCertification })
        .commodity_certifications;
      return {
        ...c,
        certificate_number: (row as { certificate_number: string | null }).certificate_number,
        issued_at: (row as { issued_at: string | null }).issued_at,
        expires_at: (row as { expires_at: string | null }).expires_at,
        verification_url: (row as { verification_url: string | null }).verification_url,
      };
    });

    // Best-effort bump view count
    supabase
      .from("commodity_lots")
      .update({ views_count: (lot.views_count ?? 0) + 1 })
      .eq("id", data.id)
      .then(() => {});

    const base = {
      ...(lot as unknown as CommodityLotRow),
      certifications_json: Array.isArray(
        (lot as { certifications_json: unknown }).certifications_json,
      )
        ? ((lot as { certifications_json: unknown[] }).certifications_json as string[])
        : null,
    };
    return { ...base, certifications };
  });

// ---------- Public: list certifications catalog ----------
export const listCommodityCertifications = createServerFn({ method: "GET" }).handler(
  async (): Promise<CommodityCertification[]> => {
    const supabase = serverPublicClient();
    const { data, error } = await supabase
      .from("commodity_certifications")
      .select("id,code,name,issuer,description,category")
      .order("code");
    if (error) {
      console.error("[listCommodityCertifications]", error);
      return [];
    }
    return (data ?? []) as CommodityCertification[];
  },
);

// ---------- Authenticated: create inquiry ----------
const inquiryInput = z.object({
  lot_id: z.string().uuid(),
  buyer_role: z.enum([
    "trader",
    "refinery",
    "smelter",
    "offtaker",
    "industrial_end_user",
    "investor",
    "other",
  ]),
  company_name: z.string().max(160).optional(),
  intended_use: z.string().max(500).optional(),
  target_volume_t: z.number().positive().optional(),
  target_price_usd_t: z.number().positive().optional(),
  message: z.string().max(2000).optional(),
});

export const createCommodityInquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inquiryInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("commodity_inquiries")
      .insert({
        lot_id: data.lot_id,
        buyer_user_id: userId,
        buyer_role: data.buyer_role,
        company_name: data.company_name ?? null,
        intended_use: data.intended_use ?? null,
        target_volume_t: data.target_volume_t ?? null,
        target_price_usd_t: data.target_price_usd_t ?? null,
        message: data.message ?? null,
        status: "new",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Notificar al equipo: la UI promete que "el seller te contactará", así que
    // la consulta no puede quedarse muda en la tabla.
    try {
      const [{ sendInternalEmail }, lotRes, profRes] = await Promise.all([
        import("@/lib/email/send-internal.server"),
        supabase.from("commodity_lots").select("title").eq("id", data.lot_id).maybeSingle(),
        supabase.from("profiles").select("email").eq("user_id", userId).maybeSingle(),
      ]);
      await sendInternalEmail({
        templateName: "commodity-inquiry-internal",
        recipientEmail: "team@geocapitals.com",
        idempotencyKey: `commodity-inquiry:${row.id}`,
        templateData: {
          lotTitle: lotRes.data?.title ?? undefined,
          lotId: data.lot_id,
          buyerEmail: profRes.data?.email ?? undefined,
          companyName: data.company_name ?? undefined,
          buyerRole: data.buyer_role,
          targetVolume: data.target_volume_t != null ? `${data.target_volume_t} t` : undefined,
          targetPrice:
            data.target_price_usd_t != null ? `US$ ${data.target_price_usd_t}/t` : undefined,
          intendedUse: data.intended_use ?? undefined,
          message: data.message ?? undefined,
        },
      });
    } catch (e) {
      console.error("[commodityInquiry] notify failed", e);
    }

    return { id: row.id, ok: true };
  });
