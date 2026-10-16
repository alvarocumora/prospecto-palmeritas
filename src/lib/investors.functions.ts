import { createServerFn } from "@tanstack/react-start";
import { requireCapitalRole } from "@/lib/access/roleMiddleware";
import { z } from "zod";
import { sendInternalEmail } from "@/lib/email/send-internal.server";

const IdInput = z.object({ userId: z.string().uuid() });
const RejectInput = z.object({ userId: z.string().uuid(), reason: z.string().min(3).max(500) });

// El rpc tipado del cliente de usuario no acepta un genérico, así que se relaja aquí.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertStaff(supabase: any, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("is_geocapitals_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No autorizado");
}

/** Lista perfiles inversionistas con estado de revisión (staff-only). */
export const listInvestorProfiles = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .inputValidator((d) =>
    z
      .object({
        status: z.enum(["pending_review", "approved", "rejected", "all"]).default("pending_review"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStaff(supabase, userId);
    let q = supabase
      .from("investor_profiles")
      .select(
        "id, user_id, full_name, company_name, country, investor_type, ticket_min_usd, ticket_max_usd, commodities, accepted_standards, website, review_status, reviewed_at, reviewed_by, terms_accepted_at, created_at, notes, tax_id, is_accredited, accreditation_basis, risk_disclosure_accepted_at, nda_signed_at, nda_signature_name, nda_hash, nda_version",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("review_status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // hydrate emails
    const ids = (rows ?? []).map((r) => r.user_id);
    let emails: Record<string, string | null> = {};
    if (ids.length) {
      // Staff verificado arriba; profiles ya no expone email entre usuarios
      // (RLS endurecido), así que la hidratación va por el cliente admin.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, email, display_name")
        .in("user_id", ids);
      emails = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.email]));
    }
    return (rows ?? []).map((r) => ({ ...r, email: emails[r.user_id] ?? null }));
  });

/** Aprueba un inversionista y envía email de bienvenida. */
export const approveInvestor = createServerFn({ method: "POST" })
  .middleware([requireCapitalRole])
  .inputValidator((d) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStaff(supabase, userId);
    const now = new Date().toISOString();
    const { data: prof, error } = await supabase
      .from("investor_profiles")
      .update({ review_status: "approved", reviewed_at: now, reviewed_by: userId })
      .eq("user_id", data.userId)
      .select("full_name, user_id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", data.userId)
      .maybeSingle();
    const { data: reviewer } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (p?.email) {
      await sendInternalEmail({
        templateName: "investor-approved",
        recipientEmail: p.email,
        templateData: {
          fullName: prof?.full_name ?? "",
          reviewerName: reviewer?.display_name ?? "Equipo Geocapitals",
        },
        idempotencyKey: `investor-approved:${data.userId}`,
      });
    }
    return { ok: true as const };
  });

/** Rechaza un inversionista con motivo. */
export const rejectInvestor = createServerFn({ method: "POST" })
  .middleware([requireCapitalRole])
  .inputValidator((d) => RejectInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStaff(supabase, userId);
    const now = new Date().toISOString();
    const { data: prof, error } = await supabase
      .from("investor_profiles")
      .update({
        review_status: "rejected",
        rejection_reason: data.reason,
        reviewed_at: now,
        reviewed_by: userId,
      })
      .eq("user_id", data.userId)
      .select("full_name")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Notificar el rechazo con el motivo — un rechazo silencioso destruye
    // la confianza más que el rechazo mismo.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (p?.email) {
      await sendInternalEmail({
        templateName: "investor-rejected",
        recipientEmail: p.email,
        templateData: { fullName: prof?.full_name ?? "", reason: data.reason },
        idempotencyKey: `investor-rejected:${data.userId}:${now}`,
      });
    }
    return { ok: true as const };
  });

/** Disparado por el wizard al completar perfil: envía welcome + notifica equipo. */
export const notifyInvestorSubmitted = createServerFn({ method: "POST" })
  .middleware([requireCapitalRole])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("investor_profiles")
      .select(
        "full_name, company_name, country, investor_type, ticket_min_usd, ticket_max_usd, commodities, accepted_standards, website",
      )
      .eq("user_id", userId)
      .maybeSingle();
    const { data: p } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();
    if (!prof || !p?.email) return { ok: false as const, error: "missing-profile" };

    const fmtUsd = (n: number | null | undefined) =>
      n ? `USD ${(n / 1000).toLocaleString()}K` : "—";
    const ticketRange = `${fmtUsd(prof.ticket_min_usd)} – ${fmtUsd(prof.ticket_max_usd)}`;
    const commodities = (prof.commodities ?? []).join(", ");
    const standards = (prof.accepted_standards ?? []).join(", ");

    await sendInternalEmail({
      templateName: "investor-welcome",
      recipientEmail: p.email,
      templateData: {
        fullName: prof.full_name,
        companyName: prof.company_name,
        ticketRange,
        commodities,
      },
      idempotencyKey: `investor-welcome:${userId}`,
    });
    await sendInternalEmail({
      templateName: "investor-lead-internal",
      recipientEmail: "team@geocapitals.com",
      templateData: {
        fullName: prof.full_name,
        companyName: prof.company_name,
        email: p.email,
        country: prof.country,
        investorType: prof.investor_type,
        ticketRange,
        commodities,
        standards,
        website: prof.website ?? "",
      },
      idempotencyKey: `investor-lead-internal:${userId}`,
    });
    return { ok: true as const };
  });

/** Historial y estado de inversiones del usuario actual (perfil KYC + liquidaciones + inquiries). */
export const getMyInvestmentHistory = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, settlementsRes, inquiriesRes] = await Promise.all([
      supabase
        .from("investor_profiles")
        .select(
          "review_status, reviewed_at, rejection_reason, terms_accepted_at, created_at, full_name, company_name",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("deal_settlements")
        .select(
          "id, listing_id, amount_usd, amount_clp, success_fee_pct, status, wire_reference, received_at, recorded_at, created_at, notes",
        )
        .eq("investor_user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("property_deal_inquiries")
        .select(
          "id, listing_id, status, message, nda_signed_at, closed_at, closed_reason, created_at, updated_at",
        )
        .eq("inquirer_user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (profileRes.error) throw new Error(profileRes.error.message);
    if (settlementsRes.error) throw new Error(settlementsRes.error.message);
    if (inquiriesRes.error) throw new Error(inquiriesRes.error.message);

    const settlements = settlementsRes.data ?? [];
    const inquiries = inquiriesRes.data ?? [];
    const listingIds = Array.from(
      new Set(
        [...settlements.map((s) => s.listing_id), ...inquiries.map((i) => i.listing_id)].filter(
          (x): x is string => typeof x === "string" && x.length > 0,
        ),
      ),
    );
    let listings: Record<
      string,
      { title: string; commodity: string | null; country: string | null }
    > = {};
    if (listingIds.length) {
      const { data: ls } = await supabase
        .from("property_listings")
        .select("id, title, commodity, country")
        .in("id", listingIds);
      listings = Object.fromEntries(
        (ls ?? []).map((l) => [
          l.id,
          { title: l.title, commodity: l.commodity, country: l.country },
        ]),
      );
    }

    const totalPaidUsd = settlements
      .filter((s) => s.status === "paid" || s.status === "received")
      .reduce((acc, s) => acc + Number(s.amount_usd ?? 0), 0);
    const totalCommittedUsd = settlements
      .filter((s) => ["pending", "invoiced", "paid", "received"].includes(s.status))
      .reduce((acc, s) => acc + Number(s.amount_usd ?? 0), 0);

    return {
      profile: profileRes.data,
      settlements: settlements.map((s) => ({
        ...s,
        listing: s.listing_id ? (listings[s.listing_id] ?? null) : null,
      })),
      inquiries: inquiries.map((i) => ({
        ...i,
        listing: i.listing_id ? (listings[i.listing_id] ?? null) : null,
      })),
      totals: {
        paidUsd: totalPaidUsd,
        committedUsd: totalCommittedUsd,
        count: settlements.length,
      },
    };
  });
