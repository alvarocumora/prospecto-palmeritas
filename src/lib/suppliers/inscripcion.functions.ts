// Server fn público: recibe la ficha de inscripción de un proveedor.
// Usa supabaseAdmin (service role) para escribir; jamás el cliente publishable.
// Rate-limit por IP en public_form_hits + honeypot.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";

const OfferSchema = z.object({
  product: z.string().min(1),
  presentation: z.string().optional(),
  gradeValue: z.number().nullable().optional(),
  gradeUnit: z.string().optional(),
  tonnageAvailable: z.number().nullable().optional(),
  tonnageMonthly: z.number().nullable().optional(),
  portOrDelivery: z.string().optional(),
  incoterm: z.string().optional(),
  priceAsk: z.string().optional(),
  priceBasis: z.string().optional(),
  acceptsInspection: z.enum(["si", "no", "depende"]),
  canSendSample: z.boolean().optional(),
  mineName: z.string().optional(),
  region: z.string().optional(),
  concessionRef: z.string().optional(),
  concessionMissingReason: z.string().optional(),
  hasExportPermit: z.string().optional(),
  chainOfCustody: z.string().optional(),
  materialAvailability: z.string().optional(),
  penalizables: z.array(z.object({ element: z.string(), value: z.number().nullable() })).optional(),
});

const InputSchema = z.object({
  country: z.enum(["CL", "PE", "AR", "BO", "OTRO"]),
  legalName: z.string().min(2).max(200),
  taxId: z.string().min(3).max(40),
  contactName: z.string().min(2).max(120),
  contactRole: z.string().max(120).optional(),
  phoneE164: z.string().min(6).max(30),
  email: z.string().email().max(200),
  supplierRole: z.enum(["titular", "mandatario", "intermediario", "trader"]),
  intermediariesCount: z.string().optional(),
  ref: z.string().max(60).optional(),
  policyVersion: z.string().min(3),
  honeypot: z.string().optional(),
  offer: OfferSchema,
});

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type SubmitResult =
  { ok: true; folio: string; supplierId: string } | { ok: false; error: string };

export const submitInscripcion = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data }): Promise<SubmitResult> => {
    // Honeypot: bot rellena el campo oculto → devolvemos ok falso silencioso.
    if (data.honeypot && data.honeypot.trim().length > 0) {
      return { ok: false, error: "spam" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const req = getRequest();
    const ipRaw =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const ua = req.headers.get("user-agent") ?? "";
    const ipHash = await sha256(ipRaw);
    const phoneHash = await sha256(data.phoneE164);

    // Rate-limit: máx 5 envíos por IP en 1 h.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("public_form_hits")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= 5) {
      return { ok: false, error: "rate_limit" };
    }
    await supabaseAdmin.from("public_form_hits").insert({
      ip_hash: ipHash,
      phone_hash: phoneHash,
      form_name: "inscripcion",
    });

    // Insertar proveedor.
    const { data: supplier, error: supErr } = await supabaseAdmin
      .from("suppliers")
      .insert({
        country: data.country,
        legal_name: data.legalName,
        tax_id: data.taxId,
        contact_name: data.contactName,
        contact_role: data.contactRole ?? null,
        phone_e164: data.phoneE164,
        email: data.email.toLowerCase(),
        supplier_role: data.supplierRole,
        intermediaries_count: data.intermediariesCount ?? null,
        invitation_token: data.ref ?? null,
        source: data.ref ? `link:${data.ref}` : "direct",
      })
      .select("id, folio")
      .single();
    if (supErr || !supplier) {
      return { ok: false, error: supErr?.message ?? "insert_supplier_failed" };
    }

    // Insertar la oferta principal.
    const { data: offer, error: offErr } = await supabaseAdmin
      .from("supplier_offers")
      .insert({
        supplier_id: supplier.id,
        product: data.offer.product,
        presentation: data.offer.presentation ?? null,
        grade_value: data.offer.gradeValue ?? null,
        grade_unit: data.offer.gradeUnit ?? null,
        tonnage_available_t: data.offer.tonnageAvailable ?? null,
        tonnage_monthly_t: data.offer.tonnageMonthly ?? null,
        port_or_delivery: data.offer.portOrDelivery ?? null,
        incoterm: data.offer.incoterm ?? null,
        price_ask: data.offer.priceAsk ?? null,
        price_basis: data.offer.priceBasis ?? null,
        accepts_inspection: data.offer.acceptsInspection,
        can_send_sample: data.offer.canSendSample ?? null,
        mine_name: data.offer.mineName ?? null,
        region: data.offer.region ?? null,
        concession_ref: data.offer.concessionRef ?? null,
        concession_missing_reason: data.offer.concessionMissingReason ?? null,
        has_export_permit: data.offer.hasExportPermit ?? null,
        chain_of_custody: data.offer.chainOfCustody ?? null,
        material_availability: data.offer.materialAvailability ?? null,
        status: "enviada",
      })
      .select("id")
      .single();
    if (offErr) {
      return { ok: false, error: offErr.message };
    }

    // Elementos declarados (ley + penalizables).
    const rows: Array<{
      offer_id: string;
      element: string;
      value: number | null;
      unit: string | null;
      source: string;
    }> = [];
    if (data.offer.gradeValue != null) {
      rows.push({
        offer_id: offer!.id,
        element: "principal",
        value: data.offer.gradeValue,
        unit: data.offer.gradeUnit ?? null,
        source: "declarado",
      });
    }
    for (const p of data.offer.penalizables ?? []) {
      rows.push({
        offer_id: offer!.id,
        element: p.element,
        value: p.value,
        unit: null,
        source: "declarado",
      });
    }
    if (rows.length > 0) await supabaseAdmin.from("offer_elements").insert(rows);

    // Consentimiento privacidad (Ley 21.719).
    await supabaseAdmin.from("privacy_consents").insert({
      supplier_id: supplier.id,
      email: data.email.toLowerCase(),
      policy_version: data.policyVersion,
      ip_hash: ipHash,
      user_agent: ua.slice(0, 500),
    });

    // Event log.
    await supabaseAdmin.from("supplier_events").insert({
      supplier_id: supplier.id,
      event_type: "supplier.registered",
      payload: { ref: data.ref ?? null, country: data.country },
    });

    // Contador del link de invitación (update manual).
    if (data.ref) {
      const { data: link } = await supabaseAdmin
        .from("invitation_links")
        .select("id, completions_count")
        .eq("token", data.ref)
        .maybeSingle();
      if (link) {
        await supabaseAdmin
          .from("invitation_links")
          .update({ completions_count: (link.completions_count ?? 0) + 1 })
          .eq("id", link.id);
      }
    }

    return { ok: true, folio: supplier.folio, supplierId: supplier.id };
  });

// Bump de aperturas del link (llamado al cargar /inscripcion?ref=TOKEN).
export const trackInvitationOpen = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ token: z.string().min(1).max(60) }).parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("invitation_links")
      .select("id, opens_count, active")
      .eq("token", data.token)
      .maybeSingle();
    if (!link || !link.active) return { ok: false as const };
    await supabaseAdmin
      .from("invitation_links")
      .update({ opens_count: (link.opens_count ?? 0) + 1 })
      .eq("id", link.id);
    return { ok: true as const };
  });

// Política de privacidad vigente (para versionar el consentimiento).
export const getActivePrivacyPolicy = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("privacy_policy_versions")
    .select("version, effective_at, content_md")
    .order("effective_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? { version: "unknown", effective_at: null, content_md: "" };
});
