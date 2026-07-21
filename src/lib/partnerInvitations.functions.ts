// Server functions para invitaciones cruzadas broker/cliente
// (acceso a N proyectos + N trades con NCNDA generado por Geocapitals).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { onboardingUrl, verifyDocUrl } from "@/lib/publicUrl";

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export type PartnerInvitationRole = "broker" | "investor" | "both";

export type PartnerInvitationRow = {
  id: string;
  token: string;
  email: string;
  full_name: string | null;
  company: string | null;
  suggested_role: PartnerInvitationRole;
  chosen_role: PartnerInvitationRole | null;
  status: "pending" | "sent" | "opened" | "signed" | "accepted" | "void";
  project_ids: string[];
  trade_ids: string[];
  ncnda_ref: string | null;
  ncnda_pdf_url: string | null;
  sent_at: string | null;
  opened_at: string | null;
  signed_at: string | null;
  accepted_at: string | null;
  invited_by: string;
  expires_at: string;
  created_at: string;
  message: string | null;
};

async function assertAdmin(sb: SupabaseClient, userId: string) {
  const { data } = await sb
    .from("app_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Solo administradores pueden gestionar invitaciones");
}

// --- Crear invitación ---------------------------------------------------------
export const createPartnerInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().optional(),
        company: z.string().optional(),
        suggestedRole: z.enum(["broker", "investor", "both"]).default("both"),
        projectIds: z.array(z.string().uuid()).default([]),
        tradeIds: z.array(z.string().uuid()).default([]),
        message: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    await assertAdmin(sb, context.userId);

    const { data: row, error } = await sb
      .from("partner_invitations")
      .insert({
        email: data.email.toLowerCase().trim(),
        full_name: data.fullName ?? null,
        company: data.company ?? null,
        suggested_role: data.suggestedRole,
        project_ids: data.projectIds,
        trade_ids: data.tradeIds,
        message: data.message ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await sb
      .from("partner_invitation_events")
      .insert({ invitation_id: row.id, event: "created" });

    return row as PartnerInvitationRow;
  });

// --- Listar (admin) ----------------------------------------------------------
export const listPartnerInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = asSb(context.supabase);
    await assertAdmin(sb, context.userId);
    const { data, error } = await sb
      .from("partner_invitations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PartnerInvitationRow[];
  });

// --- Obtener por token (público, sin auth) ----------------------------------
export const getInvitationByToken = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY as string;
    const sb = createClient(url, key);
    const { data: inv, error } = await sb
      .from("partner_invitations")
      .select(
        "id, token, email, full_name, company, suggested_role, chosen_role, status, project_ids, trade_ids, ncnda_ref, ncnda_pdf_url, expires_at, message",
      )
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invitación no encontrada");

    // Traer nombres de proyectos y trades
    const [projRes, tradeRes] = await Promise.all([
      inv.project_ids?.length
        ? sb.from("projects").select("id, name, commodity, country").in("id", inv.project_ids)
        : Promise.resolve({ data: [] as { id: string; name: string; commodity: string | null; country: string | null }[] }),
      inv.trade_ids?.length
        ? sb
            .from("commodity_trades")
            .select("id, reference, commodity")
            .in("id", inv.trade_ids)
        : Promise.resolve({ data: [] as { id: string; reference: string; commodity: string }[] }),
    ]);

    // Marca como "opened" (best-effort)
    await sb.rpc("mark_partner_invitation_opened", { _token: data.token }).then(() => null, () => null);

    return {
      invitation: inv,
      projects: (projRes.data ?? []) as Array<{ id: string; name: string; commodity: string | null; country: string | null }>,
      trades: (tradeRes.data ?? []) as Array<{ id: string; reference: string; commodity: string }>,
    };
  });

// --- Aceptar invitación (público con token) ---------------------------------
export const acceptPartnerInvitation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(8),
        chosenRole: z.enum(["broker", "investor", "both"]),
        fullName: z.string().min(2),
        company: z.string().optional(),
        signatureName: z.string().min(2),
        password: z.string().min(8),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const anon = process.env.SUPABASE_PUBLISHABLE_KEY as string;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    if (!url || !anon || !service) throw new Error("Server misconfigured");
    const admin = createClient(url, service);
    const publicSb = createClient(url, anon);

    // 1) valida invitación
    const { data: inv } = await publicSb
      .from("partner_invitations")
      .select("id, email, status, expires_at, ncnda_ref")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invitación no encontrada");
    if (inv.status === "void") throw new Error("Invitación anulada");
    if (inv.status === "accepted") throw new Error("Esta invitación ya fue aceptada");
    if (new Date(inv.expires_at) < new Date()) throw new Error("Invitación expirada");

    // 2) crea o recupera el usuario
    let userId: string | null = null;
    const created = await admin.auth.admin.createUser({
      email: inv.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, company: data.company },
    });
    if (created.error) {
      // Si ya existe, buscar por email
      const list = await admin.auth.admin.listUsers();
      const found = list.data.users.find((u) => u.email?.toLowerCase() === inv.email.toLowerCase());
      if (!found) throw new Error(created.error.message);
      userId = found.id;
      // Actualiza password
      await admin.auth.admin.updateUserById(found.id, { password: data.password });
    } else {
      userId = created.data.user!.id;
    }

    // 3) upsert profile
    await admin.from("profiles").upsert(
      {
        user_id: userId,
        email: inv.email,
        display_name: data.fullName,
        organization: data.company ?? null,
      },
      { onConflict: "user_id" },
    );

    // 4) RPC de aceptación (crea project_members, actualiza account_type)
    const { error: rpcErr } = await admin.rpc("accept_partner_invitation", {
      _token: data.token,
      _user_id: userId,
      _chosen_role: data.chosenRole,
      _full_name: data.fullName,
      _company: data.company ?? null,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    // 5) el RPC ya marcó signed_at y registró el evento 'accepted' con el user_id.
    // La traza de firma del NCNDA vive en partner_invitations.signed_at +
    // partner_invitation_events. Para adjuntar una firma electrónica formal a
    // otros documentos usamos signature_envelopes desde el dashboard.

    return { ok: true, userId };
  });

// --- Reenviar / anular (admin) -----------------------------------------------
export const resendPartnerInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    await assertAdmin(sb, context.userId);
    const { dispatchPartnerInvitation } = await import("@/lib/partnerDispatch.functions");
    return await dispatchPartnerInvitation({ data: { invitationId: data.id, force: true } });
  });

export const voidPartnerInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    await assertAdmin(sb, context.userId);
    const { error } = await sb
      .from("partner_invitations")
      .update({ status: "void" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.from("partner_invitation_events").insert({ invitation_id: data.id, event: "voided" });
    return { ok: true };
  });

export function partnerOnboardingLink(token: string): string {
  return onboardingUrl(token);
}
export function partnerNcndaVerifyLink(ref: string): string {
  return verifyDocUrl(ref);
}
