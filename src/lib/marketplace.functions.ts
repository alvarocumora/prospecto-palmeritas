// Server functions públicas y autenticadas para el marketplace de commodities.
import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireCapitalRole } from "@/lib/access/roleMiddleware";
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
  .middleware([requireCapitalRole])
  .inputValidator((d: unknown) => inquiryInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Enforcement KYC: consultar lotes requiere perfil de inversionista
    // aprobado — la promesa "KYC/AML institucional" del marketing se cumple
    // en el servidor, no solo en el copy.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("investor_profiles")
      .select("review_status")
      .eq("user_id", userId)
      .maybeSingle();
    if (profile?.review_status !== "approved") {
      throw new Error(
        profile?.review_status === "pending_review"
          ? "Tu verificación KYC está en revisión. Te avisaremos por email cuando esté aprobada."
          : "Consultar lotes requiere verificación KYC aprobada. Completa tu perfil de inversionista en el dashboard.",
      );
    }

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

// ---------- Verificación KYC del usuario actual ----------

export const getMyVerificationStatus = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .handler(async ({ context }): Promise<{ status: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("investor_profiles")
      .select("review_status")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { status: data?.review_status ?? null };
  });

// ---------- Pipeline de negociación del seller ----------

export const INQUIRY_PIPELINE = [
  "new",
  "contacted",
  "sample_requested",
  "offer_sent",
  "negotiating",
  "closed_won",
  "closed_lost",
] as const;

export const INQUIRY_STATUS_LABELS: Record<string, string> = {
  new: "Nueva",
  contacted: "Contactado",
  sample_requested: "Muestra solicitada",
  offer_sent: "Oferta enviada",
  negotiating: "En negociación",
  closed_won: "Cerrada ganada",
  closed_lost: "Cerrada perdida",
};

export type MyLotInquiryRow = {
  id: string;
  created_at: string;
  lot_id: string;
  lot_title: string | null;
  buyer_email: string | null;
  buyer_role: string;
  company_name: string | null;
  intended_use: string | null;
  target_volume_t: number | null;
  target_price_usd_t: number | null;
  message: string | null;
  status: string;
  seller_notes: string | null;
};

/** Consultas recibidas sobre los lotes del seller autenticado. */
export const listMyLotInquiries = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .inputValidator((d: unknown) => z.object({ lotId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<MyLotInquiryRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Lotes del seller (el filtro de propiedad ocurre en el servidor)
    let lotsQ = supabaseAdmin
      .from("commodity_lots")
      .select("id, title")
      .eq("seller_user_id", context.userId);
    if (data.lotId) lotsQ = lotsQ.eq("id", data.lotId);
    const { data: lots, error: lotsErr } = await lotsQ;
    if (lotsErr) throw new Error(lotsErr.message);
    const lotIds = (lots ?? []).map((l) => l.id);
    if (!lotIds.length) return [];
    const titleOf = new Map((lots ?? []).map((l) => [l.id, l.title]));

    const { data: rows, error } = await supabaseAdmin
      .from("commodity_inquiries")
      .select(
        "id, created_at, lot_id, buyer_user_id, buyer_role, company_name, intended_use, target_volume_t, target_price_usd_t, message, status, seller_notes",
      )
      .in("lot_id", lotIds)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const buyerIds = Array.from(new Set((rows ?? []).map((r) => r.buyer_user_id)));
    const { data: profs } = buyerIds.length
      ? await supabaseAdmin.from("profiles").select("user_id, email").in("user_id", buyerIds)
      : { data: [] as Array<{ user_id: string; email: string | null }> };
    const emailOf = new Map((profs ?? []).map((p) => [p.user_id, p.email]));

    return (rows ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      lot_id: r.lot_id,
      lot_title: titleOf.get(r.lot_id) ?? null,
      buyer_email: emailOf.get(r.buyer_user_id) ?? null,
      buyer_role: r.buyer_role,
      company_name: r.company_name,
      intended_use: r.intended_use,
      target_volume_t: r.target_volume_t != null ? Number(r.target_volume_t) : null,
      target_price_usd_t: r.target_price_usd_t != null ? Number(r.target_price_usd_t) : null,
      message: r.message,
      status: r.status,
      seller_notes: r.seller_notes,
    }));
  });

/** Avanza una consulta por el pipeline (solo el seller dueño del lote). */
export const updateMyLotInquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireCapitalRole])
  .inputValidator((d: unknown) =>
    z
      .object({
        inquiryId: z.string().uuid(),
        status: z.enum(INQUIRY_PIPELINE),
        sellerNotes: z.string().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Propiedad: la consulta debe pertenecer a un lote del seller
    const { data: inquiry, error: findErr } = await supabaseAdmin
      .from("commodity_inquiries")
      .select("id, lot_id, buyer_user_id, status")
      .eq("id", data.inquiryId)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!inquiry) throw new Error("Consulta no encontrada");
    const { data: lot } = await supabaseAdmin
      .from("commodity_lots")
      .select("seller_user_id, title")
      .eq("id", inquiry.lot_id)
      .maybeSingle();
    if (lot?.seller_user_id !== context.userId) throw new Error("No autorizado");

    const patch: { status: (typeof INQUIRY_PIPELINE)[number]; seller_notes?: string | null } = {
      status: data.status,
    };
    if (data.sellerNotes !== undefined) patch.seller_notes = data.sellerNotes;
    const { error } = await supabaseAdmin
      .from("commodity_inquiries")
      .update(patch)
      .eq("id", data.inquiryId);
    if (error) throw new Error(error.message);

    // Avance de cotización → email al buyer (best-effort, solo si cambió)
    if (inquiry.status !== data.status) {
      try {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .eq("user_id", inquiry.buyer_user_id)
          .maybeSingle();
        if (prof?.email) {
          const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
          await sendInternalEmail({
            templateName: "inquiry-update-buyer",
            recipientEmail: prof.email,
            idempotencyKey: `inquiry-status:${data.inquiryId}:${data.status}`,
            templateData: {
              lotTitle: lot.title,
              kind: "status",
              statusLabel: INQUIRY_STATUS_LABELS[data.status] ?? data.status,
            },
          });
        }
      } catch (e) {
        console.error("[updateMyLotInquiryStatus] notify failed", e);
      }
    }

    return { ok: true as const };
  });

// ---------- Lado buyer: mis cotizaciones ----------

export type MyBuyerInquiryRow = {
  id: string;
  created_at: string;
  status: string;
  target_volume_t: number | null;
  target_price_usd_t: number | null;
  message: string | null;
  lot: {
    id: string;
    title: string;
    commodity: string;
    form: string;
    country: string;
    incoterm: string | null;
    cover_image_url: string | null;
    status: string;
  } | null;
};

export const listMyBuyerInquiries = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .handler(async ({ context }): Promise<MyBuyerInquiryRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("commodity_inquiries")
      .select("id, created_at, status, target_volume_t, target_price_usd_t, message, lot_id")
      .eq("buyer_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const lotIds = Array.from(new Set((rows ?? []).map((r) => r.lot_id)));
    const { data: lots } = lotIds.length
      ? await supabaseAdmin
          .from("commodity_lots")
          .select("id, title, commodity, form, country, incoterm, cover_image_url, status")
          .in("id", lotIds)
      : { data: [] as never[] };
    const lotOf = new Map((lots ?? []).map((l) => [l.id, l]));

    return (rows ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      status: r.status,
      target_volume_t: r.target_volume_t != null ? Number(r.target_volume_t) : null,
      target_price_usd_t: r.target_price_usd_t != null ? Number(r.target_price_usd_t) : null,
      message: r.message,
      lot: (lotOf.get(r.lot_id) as MyBuyerInquiryRow["lot"]) ?? null,
    }));
  });

// ---------- Hilo de mensajes buyer↔seller ----------
// La tabla commodity_inquiry_messages vive en una migración nueva; hasta
// regenerar los types de Supabase se accede con un cliente sin tipar.

export type InquiryMessage = {
  id: string;
  inquiry_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  mine: boolean;
};

async function untypedAdmin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/** Valida que el usuario sea participante (buyer o seller) y devuelve roles. */
async function assertInquiryParticipant(
  inquiryId: string,
  userId: string,
): Promise<{ buyerUserId: string; sellerUserId: string; lotTitle: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: inquiry, error } = await supabaseAdmin
    .from("commodity_inquiries")
    .select("id, buyer_user_id, lot_id")
    .eq("id", inquiryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!inquiry) throw new Error("Consulta no encontrada");
  const { data: lot } = await supabaseAdmin
    .from("commodity_lots")
    .select("seller_user_id, title")
    .eq("id", inquiry.lot_id)
    .maybeSingle();
  if (!lot) throw new Error("Lote no encontrado");
  if (inquiry.buyer_user_id !== userId && lot.seller_user_id !== userId) {
    throw new Error("No autorizado");
  }
  return {
    buyerUserId: inquiry.buyer_user_id,
    sellerUserId: lot.seller_user_id,
    lotTitle: lot.title,
  };
}

export const listInquiryMessages = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .inputValidator((d: unknown) => z.object({ inquiryId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<InquiryMessage[]> => {
    await assertInquiryParticipant(data.inquiryId, context.userId);
    const sb = await untypedAdmin();
    const { data: rows, error } = await sb
      .from("commodity_inquiry_messages")
      .select("id, inquiry_id, sender_user_id, body, created_at")
      .eq("inquiry_id", data.inquiryId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) {
      // Tabla aún no migrada: el hilo se muestra vacío en vez de romper la vista
      if (/does not exist|relation/i.test(error.message)) return [];
      throw new Error(error.message);
    }
    return ((rows ?? []) as Array<Omit<InquiryMessage, "mine">>).map((m) => ({
      ...m,
      mine: m.sender_user_id === context.userId,
    }));
  });

export const sendInquiryMessage = createServerFn({ method: "POST" })
  .middleware([requireCapitalRole])
  .inputValidator((d: unknown) =>
    z.object({ inquiryId: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { buyerUserId, sellerUserId, lotTitle } = await assertInquiryParticipant(
      data.inquiryId,
      context.userId,
    );
    const sb = await untypedAdmin();
    const { error } = await sb.from("commodity_inquiry_messages").insert({
      inquiry_id: data.inquiryId,
      sender_user_id: context.userId,
      body: data.body.trim(),
    });
    if (error) {
      if (/does not exist|relation/i.test(error.message)) {
        throw new Error("La mensajería estará disponible tras aplicar la última migración.");
      }
      throw new Error(error.message);
    }

    // Notificar al otro participante (best-effort)
    try {
      const recipientId = context.userId === buyerUserId ? sellerUserId : buyerUserId;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("user_id", recipientId)
        .maybeSingle();
      if (prof?.email) {
        const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
        await sendInternalEmail({
          templateName: "inquiry-update-buyer",
          recipientEmail: prof.email,
          idempotencyKey: `inquiry-msg:${data.inquiryId}:${Date.now()}`,
          templateData: {
            lotTitle,
            kind: "message",
            messagePreview: data.body.slice(0, 140),
          },
        });
      }
    } catch (e) {
      console.error("[sendInquiryMessage] notify failed", e);
    }

    return { ok: true as const };
  });

// ---------- Perfil de actividad del usuario (buyer + vendedor) ----------

export type MyMarketplaceProfile = {
  kycStatus: string | null;
  inquiriesSent: number;
  inquiriesSentOpen: number;
  lotsTotal: number;
  lotsPublished: number;
  inquiriesReceived: number;
  inquiriesReceivedNew: number;
  listingsTotal: number;
};

export const getMyMarketplaceProfile = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .handler(async ({ context }): Promise<MyMarketplaceProfile> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;

    const [{ data: kyc }, { data: sent }, { data: myLots }, { data: myListings }] =
      await Promise.all([
        supabaseAdmin
          .from("investor_profiles")
          .select("review_status")
          .eq("user_id", uid)
          .maybeSingle(),
        supabaseAdmin.from("commodity_inquiries").select("status").eq("buyer_user_id", uid),
        supabaseAdmin.from("commodity_lots").select("id, status").eq("seller_user_id", uid),
        supabaseAdmin
          .from("property_listings")
          .select("id", { count: "exact", head: true })
          .eq("owner_user_id", uid),
      ]);

    const lotIds = (myLots ?? []).map((l) => l.id);
    const { data: received } = lotIds.length
      ? await supabaseAdmin.from("commodity_inquiries").select("status").in("lot_id", lotIds)
      : { data: [] as Array<{ status: string }> };

    const CLOSED = new Set(["closed_won", "closed_lost"]);
    return {
      kycStatus: kyc?.review_status ?? null,
      inquiriesSent: (sent ?? []).length,
      inquiriesSentOpen: (sent ?? []).filter((i) => !CLOSED.has(i.status)).length,
      lotsTotal: (myLots ?? []).length,
      lotsPublished: (myLots ?? []).filter((l) => l.status === "published").length,
      inquiriesReceived: (received ?? []).length,
      inquiriesReceivedNew: (received ?? []).filter((i) => i.status === "new").length,
      listingsTotal: (myListings as unknown as { count?: number })?.count ?? 0,
    };
  });
