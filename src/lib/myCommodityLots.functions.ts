// Lotes de commodities del vendedor: crear y ver estado.
// El lote nace en pending_verification; solo staff lo publica
// (setCommodityLotStatus en adminInbox.functions.ts) tras verificar
// certificaciones y cadena de custodia.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const COMMODITY_KINDS = [
  "cu_concentrate",
  "zn_concentrate",
  "pb_concentrate",
  "cu_cathode",
  "au_dore",
  "ag_dore",
  "au_bullion",
  "rare_earths",
  "li_carbonate",
  "li_spodumene",
  "fe_ore",
  "sn_concentrate",
  "mo_concentrate",
  "co_hydroxide",
  "ni_sulphate",
] as const;

const FORMS = [
  "concentrate",
  "cathode",
  "dore",
  "bullion",
  "oxide",
  "carbonate",
  "sulphate",
  "ore",
  "hydroxide",
] as const;

const FREQUENCIES = ["spot", "monthly", "quarterly", "semiannual", "annual_offtake"] as const;
const INCOTERMS = ["FOB", "CIF", "CFR", "EXW", "DAP", "DDP", "FCA"] as const;

const CreateLotSchema = z.object({
  title: z.string().min(3).max(200),
  commodity: z.enum(COMMODITY_KINDS),
  form: z.enum(FORMS),
  country: z.string().min(2).max(80),
  region: z.string().max(120).optional().nullable(),
  grade_pct: z.number().positive().max(100).optional().nullable(),
  moisture_pct: z.number().min(0).max(100).optional().nullable(),
  tonnage_available_t: z.number().positive().max(100_000_000).optional().nullable(),
  lot_size_t: z.number().positive().max(100_000_000).optional().nullable(),
  frequency: z.enum(FREQUENCIES).optional().nullable(),
  incoterm: z.enum(INCOTERMS).optional().nullable(),
  port_of_loading: z.string().max(120).optional().nullable(),
  price_basis: z.string().max(200).optional().nullable(),
  premium_discount_usd_t: z.number().min(-100_000).max(100_000).optional().nullable(),
  asking_price_usd: z.number().positive().max(1_000_000_000_000).optional().nullable(),
  payment_terms: z.string().max(300).optional().nullable(),
  summary: z.string().max(2000).optional().nullable(),
  description: z.string().max(8000).optional().nullable(),
});

export type CreateLotInput = z.infer<typeof CreateLotSchema>;

export type MyCommodityLotRow = {
  id: string;
  created_at: string;
  title: string;
  commodity: string;
  form: string;
  country: string;
  region: string | null;
  grade_pct: number | null;
  tonnage_available_t: number | null;
  incoterm: string | null;
  status: string;
  is_verified: boolean;
  views_count: number;
  inquiry_count: number;
};

export const createCommodityLot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateLotSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // seller_user_id viene del contexto de auth, nunca del cliente.
    const { data: row, error } = await supabaseAdmin
      .from("commodity_lots")
      .insert({
        seller_user_id: context.userId,
        title: data.title.trim(),
        commodity: data.commodity,
        form: data.form,
        country: data.country.trim(),
        region: data.region?.trim() || null,
        grade_pct: data.grade_pct ?? null,
        moisture_pct: data.moisture_pct ?? null,
        tonnage_available_t: data.tonnage_available_t ?? null,
        lot_size_t: data.lot_size_t ?? null,
        frequency: data.frequency ?? null,
        incoterm: data.incoterm ?? null,
        port_of_loading: data.port_of_loading?.trim() || null,
        price_basis: data.price_basis?.trim() || null,
        premium_discount_usd_t: data.premium_discount_usd_t ?? null,
        asking_price_usd: data.asking_price_usd ?? null,
        payment_terms: data.payment_terms?.trim() || null,
        summary: data.summary?.trim() || null,
        description: data.description?.trim() || null,
        status: "pending_verification", // la publicación es curada por staff
        is_verified: false,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[myCommodityLots] insert failed", error);
      throw new Error("No pudimos crear el lote. Intenta nuevamente.");
    }

    // Avisar al equipo que hay un lote esperando verificación.
    try {
      const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("user_id", context.userId)
        .maybeSingle();
      await sendInternalEmail({
        templateName: "contact-message-internal",
        recipientEmail: "team@geocapitals.com",
        idempotencyKey: `commodity-lot-created:${row.id}`,
        templateData: {
          name: prof?.email ?? "Seller",
          email: prof?.email ?? "",
          role: "other",
          source: `commodity-lot:${row.id}`,
          message: `Nuevo lote esperando verificación: "${data.title}" (${data.commodity} · ${data.country}). Verificar y publicar desde /dashboard/admin/inbox.`,
        },
      });
    } catch (e) {
      console.error("[myCommodityLots] notify failed", e);
    }

    return { ok: true as const, id: row.id };
  });

export const listMyCommodityLots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("commodity_lots")
      .select(
        "id, created_at, title, commodity, form, country, region, grade_pct, tonnage_available_t, incoterm, status, is_verified, views_count, inquiry_count",
      )
      .eq("seller_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      ...r,
      grade_pct: r.grade_pct != null ? Number(r.grade_pct) : null,
      tonnage_available_t: r.tonnage_available_t != null ? Number(r.tonnage_available_t) : null,
      is_verified: !!r.is_verified,
      views_count: r.views_count ?? 0,
      inquiry_count: r.inquiry_count ?? 0,
    })) as MyCommodityLotRow[];
  });
