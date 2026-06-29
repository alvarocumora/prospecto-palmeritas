import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { sendInternalEmail } from "@/lib/email/send-internal.server";

const IdInput = z.object({ userId: z.string().uuid() });
const RejectInput = z.object({ userId: z.string().uuid(), reason: z.string().min(3).max(500) });

async function assertStaff(supabase: ReturnType<typeof requireSupabaseAuth> extends never ? never : any, userId: string) {
  const { data, error } = await supabase.rpc("is_geocapitals_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No autorizado");
}

/** Lista perfiles inversionistas con estado de revisión (staff-only). */
export const listInvestorProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ status: z.enum(["pending_review", "approved", "rejected", "all"]).default("pending_review") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStaff(supabase, userId);
    let q = supabase
      .from("investor_profiles")
      .select(
        "id, user_id, full_name, company_name, country, investor_type, ticket_min_usd, ticket_max_usd, commodities, accepted_standards, website, review_status, reviewed_at, reviewed_by, terms_accepted_at, created_at, notes",
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
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, email, display_name")
        .in("user_id", ids);
      emails = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.email]));
    }
    return (rows ?? []).map((r) => ({ ...r, email: emails[r.user_id] ?? null }));
  });

/** Aprueba un inversionista y envía email de bienvenida. */
export const approveInvestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

    const { data: p } = await supabase
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
        templateData: { fullName: prof?.full_name ?? "", reviewerName: reviewer?.display_name ?? "Equipo Geocapitals" },
        idempotencyKey: `investor-approved:${data.userId}`,
      });
    }
    return { ok: true as const };
  });

/** Rechaza un inversionista con motivo. */
export const rejectInvestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RejectInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStaff(supabase, userId);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("investor_profiles")
      .update({
        review_status: "rejected",
        rejection_reason: data.reason,
        reviewed_at: now,
        reviewed_by: userId,
      })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Disparado por el wizard al completar perfil: envía welcome + notifica equipo. */
export const notifyInvestorSubmitted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

    const fmtUsd = (n: number | null | undefined) => (n ? `USD ${(n / 1000).toLocaleString()}K` : "—");
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
