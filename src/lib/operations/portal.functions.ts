import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Portal público de operaciones (buyer / seller) — acceso por token seguro.
// El token identifica la invitación; validamos expiración + estado y devolvemos
// solo los campos autorizados según el rol.
// ---------------------------------------------------------------------------

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type InvitationRow = {
  id: string;
  operation_id: string;
  participant_type: "buyer" | "seller" | "geocapitals";
  invited_email: string;
  invited_name: string | null;
  status: string;
  expires_at: string;
  revoked_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
};

async function validateToken(token: string, expectedRole: "buyer" | "seller") {
  const admin = await getAdmin();
  const { data: inv } = await admin
    .from("operation_invitations")
    .select(
      "id, operation_id, participant_type, invited_email, invited_name, status, expires_at, revoked_at, accepted_at, accepted_by",
    )
    .eq("secure_token", token)
    .maybeSingle();
  if (!inv) throw new Error("Enlace inválido");
  const invitation = inv as unknown as InvitationRow;
  if (invitation.participant_type !== expectedRole)
    throw new Error("Enlace no corresponde a este portal");
  if (invitation.status === "revoked" || invitation.revoked_at)
    throw new Error("El enlace fue revocado");
  if (new Date(invitation.expires_at) < new Date()) throw new Error("El enlace ha expirado");
  return invitation;
}

/** Vista pública del portal (sólo lo que la contraparte puede ver). */
export const getPortalView = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        token: z.string().min(10),
        role: z.enum(["buyer", "seller"]),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const inv = await validateToken(data.token, data.role);
    const admin = await getAdmin();

    const { data: op } = await admin
      .from("operations")
      .select(
        "id, code, name, commodity, subproduct, quantity_monthly, quantity_total, unit, incoterm, origin_country, destination_country, destination_port, target_price_usd, status, tech_spec, buyer_status, seller_status",
      )
      .eq("id", inv.operation_id)
      .maybeSingle();
    if (!op) throw new Error("Operación no disponible");

    const visibilityFilter: Array<"buyer_shared" | "seller_shared" | "all_parties"> =
      data.role === "buyer" ? ["buyer_shared", "all_parties"] : ["seller_shared", "all_parties"];

    const messageChannels: Array<"buyer_gc" | "seller_gc" | "tripartite"> =
      data.role === "buyer" ? ["buyer_gc", "tripartite"] : ["seller_gc", "tripartite"];

    const [docs, tasks, messages] = await Promise.all([
      admin
        .from("operation_documents")
        .select(
          "id, kind, title, description, version, visibility, review_status, review_notes, created_at, uploaded_by_role, is_frozen",
        )
        .eq("operation_id", inv.operation_id)
        .in("visibility", visibilityFilter)
        .order("created_at", { ascending: false }),
      admin
        .from("operation_tasks")
        .select("id, title, description, priority, due_date, status, created_at")
        .eq("operation_id", inv.operation_id)
        .eq("target_role", data.role)
        .order("created_at", { ascending: false }),
      admin
        .from("operation_messages")
        .select("id, channel, author_role, body, created_at")
        .eq("operation_id", inv.operation_id)
        .in("channel", messageChannels)
        .order("created_at", { ascending: true })
        .limit(100),
    ]);

    return {
      invitation: {
        id: inv.id,
        email: inv.invited_email,
        name: inv.invited_name,
        expires_at: inv.expires_at,
        accepted: !!inv.accepted_at,
      },
      role: data.role,
      operation: op,
      documents: docs.data ?? [],
      tasks: tasks.data ?? [],
      messages: messages.data ?? [],
      status: data.role === "buyer" ? op.buyer_status : op.seller_status,
    };
  });

/** El usuario autenticado canjea el token para vincularse a la operación. */
export const claimPortalInvitation = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({ token: z.string().min(10), role: z.enum(["buyer", "seller"]) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { requireSupabaseAuthDirect } = await import("./portal.helpers.server");
    const { userId, email } = await requireSupabaseAuthDirect();
    const inv = await validateToken(data.token, data.role);
    const admin = await getAdmin();

    if (email && email.toLowerCase() !== inv.invited_email.toLowerCase()) {
      throw new Error(
        `El enlace fue emitido para ${inv.invited_email}. Inicia sesión con ese correo.`,
      );
    }

    // Upsert participante
    await admin.from("operation_participants").upsert(
      {
        operation_id: inv.operation_id,
        user_id: userId,
        role: data.role,
        email: inv.invited_email,
        full_name: inv.invited_name,
        access_status: "active",
        joined_at: new Date().toISOString(),
        last_access_at: new Date().toISOString(),
      },
      { onConflict: "operation_id,user_id,role" },
    );

    // Marca invitación como aceptada
    if (!inv.accepted_at) {
      await admin
        .from("operation_invitations")
        .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: userId })
        .eq("id", inv.id);
    }

    // Actualiza estado de contraparte a access_created si aún era invitation_sent/not_invited
    const patch: Record<string, string> =
      data.role === "buyer"
        ? { buyer_status: "access_created" }
        : { seller_status: "access_created" };
    await admin
      .from("operations")
      .update(patch as never)
      .eq("id", inv.operation_id)
      .in(data.role === "buyer" ? "buyer_status" : "seller_status", [
        "not_invited",
        "invitation_sent",
      ]);

    await admin.from("operation_access_logs").insert({
      operation_id: inv.operation_id,
      actor_user_id: userId,
      actor_role: data.role,
      action: "portal_claimed",
    });

    return { ok: true, operationId: inv.operation_id };
  });

/** Mensaje enviado desde el portal externo. */
export const postPortalMessage = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        token: z.string().min(10),
        role: z.enum(["buyer", "seller"]),
        body: z.string().min(1).max(4000),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { requireSupabaseAuthDirect } = await import("./portal.helpers.server");
    const { userId } = await requireSupabaseAuthDirect();
    const inv = await validateToken(data.token, data.role);
    const admin = await getAdmin();
    const channel = data.role === "buyer" ? "buyer_gc" : "seller_gc";
    await admin.from("operation_messages").insert({
      operation_id: inv.operation_id,
      channel,
      author_id: userId,
      author_role: data.role,
      body: data.body,
    });
    await admin.from("operation_access_logs").insert({
      operation_id: inv.operation_id,
      actor_user_id: userId,
      actor_role: data.role,
      action: "message_posted",
    });
    return { ok: true };
  });
