import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicUrl } from "@/lib/publicUrl";

// ---------------------------------------------------------------------------
// Módulo Operaciones — workspace transaccional por pedido.
// Cada operación genera automáticamente dos invitaciones (comprador + vendedor)
// con tokens seguros y expiración; GeoCapitals mantiene control central.
// ---------------------------------------------------------------------------

const createSchema = z.object({
  name: z.string().min(2),
  commodity: z.string().min(1),
  subproduct: z.string().optional(),
  quantity_monthly: z.number().nullable().optional(),
  quantity_total: z.number().nullable().optional(),
  unit: z.string().default("MT"),
  origin_country: z.string().optional(),
  destination_country: z.string().optional(),
  destination_port: z.string().optional(),
  incoterm: z.string().optional(),
  duration_months: z.number().int().nullable().optional(),
  target_price_usd: z.number().nullable().optional(),
  priority: z.string().default("normal"),
  buyer_name: z.string().optional(),
  buyer_company: z.string().optional(),
  buyer_email: z.string().email().optional().or(z.literal("")).optional(),
  buyer_phone: z.string().optional(),
  seller_name: z.string().optional(),
  seller_company: z.string().optional(),
  seller_email: z.string().email().optional().or(z.literal("")).optional(),
  seller_phone: z.string().optional(),
  tech_spec: z.record(z.string(), z.unknown()).optional(),
  linked_trade_id: z.string().uuid().optional(),
});

export const createOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => createSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: codeRow, error: codeErr } = await supabaseAdmin.rpc("op_generate_code", {
      _commodity: data.commodity,
    });
    if (codeErr) throw codeErr;
    const code = String(codeRow);

    const { data: op, error } = await supabaseAdmin
      .from("operations")
      .insert({
        code,
        name: data.name,
        commodity: data.commodity,
        subproduct: data.subproduct ?? null,
        quantity_monthly: data.quantity_monthly ?? null,
        quantity_total: data.quantity_total ?? null,
        unit: data.unit,
        origin_country: data.origin_country ?? null,
        destination_country: data.destination_country ?? null,
        destination_port: data.destination_port ?? null,
        incoterm: data.incoterm ?? null,
        duration_months: data.duration_months ?? null,
        target_price_usd: data.target_price_usd ?? null,
        priority: data.priority,
        buyer_name: data.buyer_name ?? null,
        buyer_company: data.buyer_company ?? null,
        buyer_email: data.buyer_email || null,
        buyer_phone: data.buyer_phone ?? null,
        seller_name: data.seller_name ?? null,
        seller_company: data.seller_company ?? null,
        seller_email: data.seller_email || null,
        seller_phone: data.seller_phone ?? null,
        tech_spec: (data.tech_spec ?? {}) as never,
        linked_trade_id: data.linked_trade_id ?? null,
        responsible_user_id: context.userId,
        created_by: context.userId,
        status: "draft",
      })
      .select("id, code")
      .single();
    if (error) throw error;

    // Registra al creador como participante geocapitals
    await supabaseAdmin.from("operation_participants").insert({
      operation_id: op.id,
      user_id: context.userId,
      role: "geocapitals",
      email: null,
      access_status: "active",
      joined_at: new Date().toISOString(),
    });

    // Genera invitaciones si hay correos
    const invitations: Array<{ role: "buyer" | "seller"; url: string; token: string; emailed: boolean }> = [];
    const { sendPortalInvitationEmail } = await import("./dispatch.server");
    // Nombre del emisor (para el correo)
    const { data: inviter } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", context.userId)
      .maybeSingle();
    const invitedByName = inviter?.full_name ?? inviter?.email ?? null;

    for (const kind of ["buyer", "seller"] as const) {
      const email = kind === "buyer" ? data.buyer_email : data.seller_email;
      const name = kind === "buyer" ? data.buyer_name : data.seller_name;
      if (!email) continue;
      const { data: inv, error: invErr } = await supabaseAdmin
        .from("operation_invitations")
        .insert({
          operation_id: op.id,
          participant_type: kind,
          invited_email: email,
          invited_name: name ?? null,
          created_by: context.userId,
        })
        .select("secure_token, expires_at")
        .single();
      if (invErr) throw invErr;
      const token = inv.secure_token as string;
      let emailed = false;
      try {
        const res = await sendPortalInvitationEmail({
          role: kind,
          email,
          name: name ?? null,
          token,
          operationId: op.id,
          operationCode: op.code,
          operationName: data.name,
          commodity: data.commodity,
          incoterm: data.incoterm ?? null,
          quantityMonthly: data.quantity_monthly ?? null,
          quantityTotal: data.quantity_total ?? null,
          unit: data.unit,
          originCountry: data.origin_country ?? null,
          destinationCountry: data.destination_country ?? null,
          expiresAt: (inv.expires_at as string | null) ?? null,
          invitedByName,
        });
        emailed = res.ok === true;
      } catch (e) {
        console.error("[operations] failed to send portal invitation", kind, e);
      }
      await supabaseAdmin.from("operation_access_logs").insert({
        operation_id: op.id,
        actor_user_id: context.userId,
        actor_role: "geocapitals",
        action: emailed ? "invitation_emailed" : "invitation_email_failed",
        metadata: { role: kind, email } as never,
      });
      invitations.push({
        role: kind,
        token,
        url: publicUrl(`/portal/${kind}/${encodeURIComponent(token)}`),
        emailed,
      });
    }

    if (invitations.length > 0) {
      await supabaseAdmin
        .from("operations")
        .update({ status: "counterparties_invited" })
        .eq("id", op.id);
    }

    await supabaseAdmin.from("operation_access_logs").insert({
      operation_id: op.id,
      actor_user_id: context.userId,
      actor_role: "geocapitals",
      action: "operation_created",
      metadata: { code, invitations: invitations.length },
    });

    return { id: op.id, code: op.code, invitations };
  });

export const listOperations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("operations")
      .select(
        "id, code, name, commodity, status, buyer_status, seller_status, buyer_company, seller_company, incoterm, destination_country, priority, updated_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const getOperationDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: op, error } = await context.supabase
      .from("operations")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!op) throw new Error("Operación no encontrada o sin acceso");

    const [participants, invitations, docs, tasks, messages, activity] = await Promise.all([
      context.supabase.from("operation_participants").select("*").eq("operation_id", data.id),
      context.supabase
        .from("operation_invitations")
        .select("id, participant_type, invited_email, invited_name, secure_token, status, expires_at, accepted_at, revoked_at, created_at")
        .eq("operation_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("operation_documents")
        .select("*")
        .eq("operation_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("operation_tasks")
        .select("*")
        .eq("operation_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("operation_messages")
        .select("*")
        .eq("operation_id", data.id)
        .order("created_at", { ascending: true })
        .limit(200),
      context.supabase
        .from("operation_access_logs")
        .select("*")
        .eq("operation_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const invRows = (invitations.data ?? []) as Array<{
      participant_type: "buyer" | "seller" | "geocapitals";
      secure_token: string;
      status: string;
    }>;
    const portalLinks = invRows
      .filter((i) => i.participant_type !== "geocapitals" && i.status === "pending")
      .map((i) => ({
        role: i.participant_type,
        url: publicUrl(`/portal/${i.participant_type}/${encodeURIComponent(i.secure_token)}`),
      }));

    return {
      operation: op,
      participants: participants.data ?? [],
      invitations: invitations.data ?? [],
      documents: docs.data ?? [],
      tasks: tasks.data ?? [],
      messages: messages.data ?? [],
      activity: activity.data ?? [],
      portalLinks,
    };
  });

export const regenerateInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        operation_id: z.string().uuid(),
        role: z.enum(["buyer", "seller"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Revoca todas las invitaciones activas del rol
    await supabaseAdmin
      .from("operation_invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: context.userId })
      .eq("operation_id", data.operation_id)
      .eq("participant_type", data.role)
      .eq("status", "pending");

    const { data: op } = await supabaseAdmin
      .from("operations")
      .select("buyer_email, buyer_name, seller_email, seller_name")
      .eq("id", data.operation_id)
      .maybeSingle();
    if (!op) throw new Error("Operación no encontrada");

    const email = data.role === "buyer" ? op.buyer_email : op.seller_email;
    const name = data.role === "buyer" ? op.buyer_name : op.seller_name;
    if (!email) throw new Error(`Falta email de ${data.role} en la operación`);

    const { data: inv, error } = await supabaseAdmin
      .from("operation_invitations")
      .insert({
        operation_id: data.operation_id,
        participant_type: data.role,
        invited_email: email,
        invited_name: name,
        created_by: context.userId,
      })
      .select("secure_token")
      .single();
    if (error) throw error;

    await supabaseAdmin.from("operation_access_logs").insert({
      operation_id: data.operation_id,
      actor_user_id: context.userId,
      actor_role: "geocapitals",
      action: "invitation_regenerated",
      metadata: { role: data.role },
    });

    return {
      token: inv.secure_token,
      url: publicUrl(`/portal/${data.role}/${encodeURIComponent(inv.secure_token as string)}`),
    };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ invitation_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("operation_invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: context.userId })
      .eq("id", data.invitation_id);
    if (error) throw error;
    return { ok: true };
  });

export const createOperationTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        operation_id: z.string().uuid(),
        title: z.string().min(2),
        description: z.string().optional(),
        target_role: z.enum(["buyer", "seller"]),
        priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        due_date: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("operation_tasks").insert({
      operation_id: data.operation_id,
      title: data.title,
      description: data.description ?? null,
      target_role: data.target_role,
      priority: data.priority,
      due_date: data.due_date || null,
      created_by: context.userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const postOperationMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        operation_id: z.string().uuid(),
        channel: z.enum(["buyer_gc", "seller_gc", "tripartite", "internal"]),
        body: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    // Determina el rol del autor según su participación
    const { data: part } = await context.supabase
      .from("operation_participants")
      .select("role")
      .eq("operation_id", data.operation_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    const role = (part?.role ?? "geocapitals") as "buyer" | "seller" | "geocapitals";
    const { error } = await context.supabase.from("operation_messages").insert({
      operation_id: data.operation_id,
      channel: data.channel,
      author_id: context.userId,
      author_role: role,
      body: data.body,
    });
    if (error) throw error;
    return { ok: true };
  });
