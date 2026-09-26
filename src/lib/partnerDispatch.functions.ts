// Despacho de invitaciones de socios: genera NCNDA firmado por Geocapitals,
// lo sube a storage privado con URL firmada y despacha correo con link al
// wizard de onboarding. Reutiliza sendInternalEmail (queue transaccional).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { onboardingUrl } from "@/lib/publicUrl";

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

async function assertAdmin(sb: SupabaseClient, userId: string) {
  const { data } = await sb
    .from("app_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Solo administradores pueden despachar invitaciones");
}

async function ensureNcndaPdf(args: {
  invitationId: string;
  email: string;
  fullName: string | null;
  company: string | null;
  existingRef: string | null;
  existingUrl: string | null;
}): Promise<{ ref: string; url: string }> {
  if (args.existingRef && args.existingUrl) {
    return { ref: args.existingRef, url: args.existingUrl };
  }
  const { buildNdaPdf } = await import("@/lib/documents/officialPdfs.server");
  const { uploadPdfSigned } = await import("@/lib/documents/pdfServer.server");

  const ref = `NCNDA-PARTNER-${args.invitationId.slice(0, 8).toUpperCase()}`;
  const bytes = await buildNdaPdf({
    reference: ref,
    counterparty: {
      role: "Parte B",
      name: args.fullName ?? args.email,
      company: args.company ?? undefined,
      email: args.email,
    },
    purpose:
      "acceso institucional a Geocapitals (data rooms de proyectos, operaciones activas de commodities y flujo de deals) en calidad de broker y/o cliente/inversionista",
    termMonths: 24,
  });
  const url = await uploadPdfSigned({
    bytes,
    path: `partner-invitations/${args.invitationId}/${ref}.pdf`,
    ttlDays: 60,
  });
  return { ref, url };
}

export const dispatchPartnerInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        invitationId: z.string().uuid(),
        force: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    await assertAdmin(sb, context.userId);

    const { data: inv, error } = await sb
      .from("partner_invitations")
      .select("*")
      .eq("id", data.invitationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invitación no encontrada");
    if (inv.status === "void") throw new Error("Invitación anulada — no se puede despachar");

    // 1) NCNDA
    const { ref, url } = await ensureNcndaPdf({
      invitationId: inv.id,
      email: inv.email,
      fullName: inv.full_name,
      company: inv.company,
      existingRef: inv.ncnda_ref,
      existingUrl: inv.ncnda_pdf_url,
    });

    // 2) Contexto de proyectos + trades para el correo
    const [projRes, tradeRes, meRes] = await Promise.all([
      inv.project_ids?.length
        ? sb.from("projects").select("id, name").in("id", inv.project_ids)
        : Promise.resolve({ data: [] }),
      inv.trade_ids?.length
        ? sb.from("commodity_trades").select("id, reference, commodity").in("id", inv.trade_ids)
        : Promise.resolve({ data: [] }),
      sb.from("profiles").select("display_name").eq("user_id", context.userId).maybeSingle(),
    ]);

    // 3) Envío del correo
    const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
    const send = await sendInternalEmail({
      templateName: "partner-invitation",
      recipientEmail: inv.email,
      idempotencyKey: `partner-invitation:${inv.id}${data.force ? `:${Date.now()}` : ""}`,
      templateData: {
        fullName: inv.full_name,
        invitedByName: (meRes.data as { display_name?: string } | null)?.display_name ?? undefined,
        onboardingUrl: onboardingUrl(inv.token),
        ncndaUrl: url,
        projects: projRes.data ?? [],
        trades: tradeRes.data ?? [],
        personalMessage: inv.message,
      },
    });

    // 4) Actualiza estado + traza
    await sb
      .from("partner_invitations")
      .update({
        ncnda_ref: ref,
        ncnda_pdf_url: url,
        status: inv.status === "accepted" ? inv.status : "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", inv.id);
    await sb
      .from("partner_invitation_events")
      .insert({ invitation_id: inv.id, event: data.force ? "resent" : "sent", metadata: send });

    return { ok: true, ncndaUrl: url, ncndaRef: ref, send };
  });

// Despacho inicial one-shot para los 2 correos aprobados por el fundador.
export const dispatchInitialPartners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = asSb(context.supabase);
    await assertAdmin(sb, context.userId);

    // 1) Localiza los 4 proyectos y el trade de cobre
    const [projRes, tradeRes] = await Promise.all([
      sb.from("projects").select("id, name").in("id", [
        "8dc8e288-b22c-4bd4-9626-bb7fb85d1745", // Palmeras
        "7a499b02-ecdf-447b-8956-b106fe4ec087", // Los Verdes
        "e5360f13-1647-4e44-bb13-c0614e6f39fe", // Gianfranco (Franco)
        "eacd71bc-6872-4a11-ba14-cca630401682", // La Cornellana
      ]),
      sb
        .from("commodity_trades")
        .select("id")
        .eq("id", "4a11ad91-fb9b-4091-8c33-e6decdbbc65c") // CU-CONC-202607-CKG
        .maybeSingle(),
    ]);
    const projectIds = (projRes.data ?? []).map((p: { id: string }) => p.id);
    const tradeIds = tradeRes.data ? [tradeRes.data.id] : [];

    const contacts: Array<{ email: string; full_name: string; company: string }> = [
      { email: "joaquin.belmar@zbalatam.com", full_name: "Joaquín Belmar", company: "Zbala Latam" },
      { email: "eduardo@singularx.io", full_name: "Eduardo", company: "SingularX" },
    ];

    const results: Array<{ email: string; onboardingUrl: string; ncndaUrl: string }> = [];
    for (const c of contacts) {
      // Reutiliza invitación existente para el mismo correo si no está aceptada
      const { data: existing } = await sb
        .from("partner_invitations")
        .select("*")
        .eq("email", c.email.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let invId = existing?.id as string | undefined;
      let token = existing?.token as string | undefined;
      if (!invId || existing?.status === "void") {
        const { data: created, error } = await sb
          .from("partner_invitations")
          .insert({
            email: c.email.toLowerCase(),
            full_name: c.full_name,
            company: c.company,
            suggested_role: "both",
            project_ids: projectIds,
            trade_ids: tradeIds,
            message:
              "Hola, adjunto el NCNDA firmado por Geocapitals para tu firma y el link para activar acceso a los data rooms de nuestros 4 proyectos + la operación de cobre 2.000 MT/mes en curso. Cualquier duda, WhatsApp +56 9 6218 4071.",
          })
          .select("id, token")
          .single();
        if (error) throw new Error(`${c.email}: ${error.message}`);
        invId = created.id;
        token = created.token;
      }

      const res = await dispatchPartnerInvitation({
        data: { invitationId: invId!, force: true },
      });
      results.push({
        email: c.email,
        onboardingUrl: onboardingUrl(token!),
        ncndaUrl: res.ncndaUrl,
      });
    }

    return { ok: true, results };
  });
