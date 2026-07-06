// Bandeja de entrada admin (staff-only): todo lo que la web pública captura
// tiene que poder leerse y gestionarse desde un solo lugar. Antes de esto,
// contact_messages, commodity_inquiries y property_deal_inquiries eran tablas
// de solo-escritura: los leads entraban y nadie los veía.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Mismo patrón que investors.functions.ts: el rpc tipado del cliente de
// usuario no acepta un genérico, así que se relaja aquí.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertStaff(supabase: any, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("is_geocapitals_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No autorizado");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ── Mensajes de contacto (web pública) ────────────────────────────────────────

export type ContactMessageRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  organization: string | null;
  role: string;
  source: string;
  status: string;
  message: string;
};

export const listContactMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ status: z.enum(["new", "handled", "all"]).default("new") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = await admin();
    let q = sb
      .from("contact_messages")
      .select("id, created_at, name, email, organization, role, source, status, message")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ContactMessageRow[];
  });

export const setContactMessageStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(["new", "handled"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb
      .from("contact_messages")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ── Consultas del marketplace de commodities ─────────────────────────────────

export type CommodityInquiryRow = {
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
};

export const listCommodityInquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ status: z.enum(["new", "contacted", "all"]).default("new") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = await admin();
    let q = sb
      .from("commodity_inquiries")
      .select(
        "id, created_at, lot_id, buyer_user_id, buyer_role, company_name, intended_use, target_volume_t, target_price_usd_t, message, status",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status as never);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const lotIds = Array.from(new Set((rows ?? []).map((r) => r.lot_id)));
    const buyerIds = Array.from(new Set((rows ?? []).map((r) => r.buyer_user_id)));
    const [lots, profs] = await Promise.all([
      lotIds.length
        ? sb.from("commodity_lots").select("id, title").in("id", lotIds)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
      buyerIds.length
        ? sb.from("profiles").select("user_id, email").in("user_id", buyerIds)
        : Promise.resolve({ data: [] as Array<{ user_id: string; email: string | null }> }),
    ]);
    const lotTitle = new Map((lots.data ?? []).map((l) => [l.id, l.title]));
    const buyerEmail = new Map((profs.data ?? []).map((p) => [p.user_id, p.email]));

    return (rows ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      lot_id: r.lot_id,
      lot_title: lotTitle.get(r.lot_id) ?? null,
      buyer_email: buyerEmail.get(r.buyer_user_id) ?? null,
      buyer_role: r.buyer_role,
      company_name: r.company_name,
      intended_use: r.intended_use,
      target_volume_t: r.target_volume_t != null ? Number(r.target_volume_t) : null,
      target_price_usd_t: r.target_price_usd_t != null ? Number(r.target_price_usd_t) : null,
      message: r.message,
      status: r.status,
    })) as CommodityInquiryRow[];
  });

export const setCommodityInquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(["new", "contacted"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb
      .from("commodity_inquiries")
      .update({ status: data.status as never })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ── Solicitudes de deal (property_deal_inquiries) ─────────────────────────────

export type DealInquiryRow = {
  id: string;
  created_at: string;
  listing_id: string;
  listing_title: string | null;
  inquirer_email: string | null;
  message: string | null;
  nda_signed_at: string | null;
  status: string;
};

export const listDealInquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = await admin();
    const { data: rows, error } = await sb
      .from("property_deal_inquiries")
      .select("id, created_at, listing_id, inquirer_user_id, message, nda_signed_at, status")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const listingIds = Array.from(new Set((rows ?? []).map((r) => r.listing_id)));
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.inquirer_user_id)));
    const [listings, profs] = await Promise.all([
      listingIds.length
        ? sb.from("property_listings").select("id, title").in("id", listingIds)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
      userIds.length
        ? sb.from("profiles").select("user_id, email").in("user_id", userIds)
        : Promise.resolve({ data: [] as Array<{ user_id: string; email: string | null }> }),
    ]);
    const titleOf = new Map((listings.data ?? []).map((l) => [l.id, l.title]));
    const emailOf = new Map((profs.data ?? []).map((p) => [p.user_id, p.email]));

    return (rows ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      listing_id: r.listing_id,
      listing_title: titleOf.get(r.listing_id) ?? null,
      inquirer_email: emailOf.get(r.inquirer_user_id) ?? null,
      message: r.message,
      nda_signed_at: r.nda_signed_at,
      status: r.status,
    })) as DealInquiryRow[];
  });

// ── Publicación de listings (curaduría staff) ─────────────────────────────────

export type AdminListingRow = {
  id: string;
  created_at: string;
  title: string;
  commodity: string;
  country: string;
  region: string | null;
  modality: string;
  stage: string;
  asking_price_usd: number | null;
  is_published: boolean;
  owner_email: string | null;
};

export const listAllListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = await admin();
    const { data: rows, error } = await sb
      .from("property_listings")
      .select(
        "id, created_at, title, commodity, country, region, modality, stage, asking_price_usd, is_published, owner_user_id",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ownerIds = Array.from(new Set((rows ?? []).map((r) => r.owner_user_id)));
    const { data: profs } = ownerIds.length
      ? await sb.from("profiles").select("user_id, email").in("user_id", ownerIds)
      : { data: [] as Array<{ user_id: string; email: string | null }> };
    const emailOf = new Map((profs ?? []).map((p) => [p.user_id, p.email]));

    return (rows ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      title: r.title,
      commodity: r.commodity,
      country: r.country,
      region: r.region,
      modality: r.modality,
      stage: r.stage,
      asking_price_usd: r.asking_price_usd != null ? Number(r.asking_price_usd) : null,
      is_published: !!r.is_published,
      owner_email: emailOf.get(r.owner_user_id) ?? null,
    })) as AdminListingRow[];
  });

export const setListingPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ listingId: z.string().uuid(), published: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb
      .from("property_listings")
      .update({ is_published: data.published })
      .eq("id", data.listingId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ── Verificación y publicación de lotes de commodities ────────────────────────

export type AdminCommodityLotRow = {
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
  seller_email: string | null;
};

export const listAllCommodityLots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = await admin();
    const { data: rows, error } = await sb
      .from("commodity_lots")
      .select(
        "id, created_at, title, commodity, form, country, region, grade_pct, tonnage_available_t, incoterm, status, is_verified, seller_user_id",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const sellerIds = Array.from(new Set((rows ?? []).map((r) => r.seller_user_id)));
    const { data: profs } = sellerIds.length
      ? await sb.from("profiles").select("user_id, email").in("user_id", sellerIds)
      : { data: [] as Array<{ user_id: string; email: string | null }> };
    const emailOf = new Map((profs ?? []).map((p) => [p.user_id, p.email]));

    return (rows ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      title: r.title,
      commodity: r.commodity,
      form: r.form,
      country: r.country,
      region: r.region,
      grade_pct: r.grade_pct != null ? Number(r.grade_pct) : null,
      tonnage_available_t: r.tonnage_available_t != null ? Number(r.tonnage_available_t) : null,
      incoterm: r.incoterm,
      status: r.status,
      is_verified: !!r.is_verified,
      seller_email: emailOf.get(r.seller_user_id) ?? null,
    })) as AdminCommodityLotRow[];
  });

/**
 * publish: verifica y publica (is_verified=true + status=published).
 * archive: retira el lote del marketplace.
 */
export const setCommodityLotStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ lotId: z.string().uuid(), action: z.enum(["publish", "archive"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = await admin();
    const patch =
      data.action === "publish"
        ? {
            status: "published" as const,
            is_verified: true,
            verified_at: new Date().toISOString(),
            verified_by: context.userId,
          }
        : { status: "archived" as const };
    const { error } = await sb.from("commodity_lots").update(patch).eq("id", data.lotId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ── Métricas del marketplace (staff) ──────────────────────────────────────────

export type AdminMarketplaceStats = {
  lots: { total: number; byStatus: Record<string, number>; verified: number };
  inquiries: { total: number; byStatus: Record<string, number> };
  buyers: { byReviewStatus: Record<string, number> };
  /** Suma volumen×precio objetivo de consultas cerradas ganadas (GTV estimado). */
  closedWonValueUsd: number;
  /** Ídem para estados activos (contactado→negociación): pipeline abierto. */
  openPipelineValueUsd: number;
};

export const getAdminMarketplaceStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminMarketplaceStats> => {
    await assertStaff(context.supabase, context.userId);
    const sb = await admin();

    const [{ data: lots }, { data: inquiries }, { data: buyers }] = await Promise.all([
      sb.from("commodity_lots").select("status, is_verified"),
      sb.from("commodity_inquiries").select("status, target_volume_t, target_price_usd_t"),
      sb.from("investor_profiles").select("review_status"),
    ]);

    const lotByStatus: Record<string, number> = {};
    let verified = 0;
    for (const l of lots ?? []) {
      lotByStatus[l.status] = (lotByStatus[l.status] ?? 0) + 1;
      if (l.is_verified) verified++;
    }

    const inqByStatus: Record<string, number> = {};
    let closedWonValueUsd = 0;
    let openPipelineValueUsd = 0;
    const OPEN = new Set(["contacted", "sample_requested", "offer_sent", "negotiating"]);
    for (const i of inquiries ?? []) {
      inqByStatus[i.status] = (inqByStatus[i.status] ?? 0) + 1;
      const value = (Number(i.target_volume_t) || 0) * (Number(i.target_price_usd_t) || 0);
      if (i.status === "closed_won") closedWonValueUsd += value;
      else if (OPEN.has(i.status)) openPipelineValueUsd += value;
    }

    const buyerByStatus: Record<string, number> = {};
    for (const b of buyers ?? []) {
      buyerByStatus[b.review_status] = (buyerByStatus[b.review_status] ?? 0) + 1;
    }

    return {
      lots: { total: (lots ?? []).length, byStatus: lotByStatus, verified },
      inquiries: { total: (inquiries ?? []).length, byStatus: inqByStatus },
      buyers: { byReviewStatus: buyerByStatus },
      closedWonValueUsd,
      openPipelineValueUsd,
    };
  });

// ── Activación manual de suscripciones (staff · gateway concierge) ─────────────

export type AdminSubscriptionRow = {
  user_id: string;
  email: string | null;
  plan: string;
  status: string;
  current_period_end: string | null;
  updated_at: string;
};

export const listSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminSubscriptionRow[]> => {
    await assertStaff(context.supabase, context.userId);
    const sb = await admin();
    const { data: rows, error } = await sb
      .from("subscriptions")
      .select("user_id, plan, status, current_period_end, updated_at")
      .neq("plan", "free")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profs } = ids.length
      ? await sb.from("profiles").select("user_id, email").in("user_id", ids)
      : { data: [] as Array<{ user_id: string; email: string | null }> };
    const emailOf = new Map((profs ?? []).map((p) => [p.user_id, p.email]));
    return (rows ?? []).map((r) => ({
      user_id: r.user_id,
      email: emailOf.get(r.user_id) ?? null,
      plan: r.plan,
      status: r.status,
      current_period_end: r.current_period_end,
      updated_at: r.updated_at,
    }));
  });

/**
 * Activa/cambia el plan de un usuario por email tras confirmar el cobro.
 * Es el write path a subscriptions que faltaba (nadie escribía la tabla).
 */
export const setUserSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        plan: z.enum(["free", "pro", "enterprise"]),
        months: z.number().int().min(1).max(36).default(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = await admin();

    const { data: prof, error: profErr } = await sb
      .from("profiles")
      .select("user_id")
      .eq("email", data.email.trim().toLowerCase())
      .maybeSingle();
    if (profErr) throw new Error(profErr.message);
    if (!prof) throw new Error("No existe un usuario con ese email.");

    const periodEnd =
      data.plan === "free"
        ? null
        : new Date(Date.now() + data.months * 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await sb.from("subscriptions").upsert(
      {
        user_id: prof.user_id,
        plan: data.plan,
        status: "active",
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
