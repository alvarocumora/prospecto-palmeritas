// Participantes de una operación: comprador, vendedor, brókers, asesores u
// observadores. Cada participante recibe su propio enlace privado (solo se
// persiste el hash) que abre la ficha de la operación con los permisos que se
// le hayan concedido. El acceso se puede revocar o rotar en cualquier momento.

import { createServerFn } from "@tanstack/react-start";
import { type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireTradeRole } from "@/lib/access/roleMiddleware";
import { sha256Hex } from "@/lib/documents/signing";
import { publicUrl } from "@/lib/publicUrl";
import { sendInternalEmail } from "@/lib/email/send-internal.server";

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

const TOKEN_PREFIX = "gcops_";

function newToken(): string {
  const arr = new Uint8Array(32);
  globalThis.crypto.getRandomValues(arr);
  return `${TOKEN_PREFIX}${Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export const PARTICIPANT_ROLES = [
  { value: "buyer", label: "Comprador" },
  { value: "seller", label: "Vendedor" },
  { value: "broker", label: "Bróker / intermediario" },
  { value: "advisor", label: "Asesor legal o técnico" },
  { value: "observer", label: "Observador" },
] as const;

export type ParticipantRow = {
  id: string;
  role: string;
  name: string | null;
  company: string | null;
  email: string;
  can_view_ficha: boolean;
  can_view_documents: boolean;
  can_negotiate: boolean;
  can_upload: boolean;
  token_prefix: string | null;
  status: string;
  invited_at: string | null;
  revoked_at: string | null;
  last_access_at: string | null;
  created_at: string;
};

const idInput = (d: unknown) => z.object({ tradeId: z.string().uuid() }).parse(d);

export const listTradeParticipants = createServerFn({ method: "POST" })
  .middleware([requireTradeRole])
  .inputValidator(idInput)
  .handler(async ({ data, context }): Promise<ParticipantRow[]> => {
    const sb = asSb(context.supabase);
    const { data: rows, error } = await sb
      .from("trade_participants")
      .select(
        "id, role, name, company, email, can_view_ficha, can_view_documents, can_negotiate, can_upload, token_prefix, status, invited_at, revoked_at, last_access_at, created_at",
      )
      .eq("trade_id", data.tradeId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ParticipantRow[];
  });

const inviteInput = (d: unknown) =>
  z
    .object({
      tradeId: z.string().uuid(),
      role: z.enum(["buyer", "seller", "broker", "advisor", "observer"]),
      email: z.string().trim().email().max(255),
      name: z.string().trim().max(160).optional(),
      company: z.string().trim().max(160).optional(),
      canViewDocuments: z.boolean().default(true),
      canNegotiate: z.boolean().default(false),
      canUpload: z.boolean().default(false),
      sendEmail: z.boolean().default(true),
    })
    .parse(d);

/** Crea el participante, emite su enlace privado y (opcional) envía el correo. */
export const inviteTradeParticipant = createServerFn({ method: "POST" })
  .middleware([requireTradeRole])
  .inputValidator(inviteInput)
  .handler(async ({ data, context }): Promise<{ url: string; prefix: string }> => {
    const sb = asSb(context.supabase);

    const { data: trade, error: tErr } = await sb
      .from("commodity_trades")
      .select("id, reference, commodity")
      .eq("id", data.tradeId)
      .maybeSingle();
    if (tErr || !trade) throw new Error("Operación no encontrada o sin acceso.");

    const token = newToken();
    const prefix = token.slice(0, TOKEN_PREFIX.length + 6);
    const email = data.email.toLowerCase();

    const { error } = await sb.from("trade_participants").insert({
      trade_id: data.tradeId,
      role: data.role,
      name: data.name ?? null,
      company: data.company ?? null,
      email,
      can_view_ficha: true,
      can_view_documents: data.canViewDocuments,
      can_negotiate: data.canNegotiate,
      can_upload: data.canUpload,
      token_hash: await sha256Hex(token),
      token_prefix: prefix,
      status: "active",
      invited_by: context.userId as string,
      invited_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    const t = trade as { reference: string | null; commodity: string | null };
    const url = publicUrl(`/ficha/${token}`);

    if (data.sendEmail) {
      try {
        await sendInternalEmail({
          templateName: "trade-participant-invitation",
          recipientEmail: email,
          idempotencyKey: `trade-participant-${prefix}`,
          templateData: {
            name: data.name ?? null,
            company: data.company ?? null,
            role: PARTICIPANT_ROLES.find((r) => r.value === data.role)?.label ?? data.role,
            commodity: t.commodity,
            reference: t.reference,
            accessUrl: url,
          },
        });
      } catch {
        /* el enlace ya existe; el correo es best-effort */
      }
    }

    try {
      await sb.from("trade_events").insert({
        trade_id: data.tradeId,
        actor_user_id: context.userId as string,
        kind: "participant_invited",
        detail: `Participante ${data.role} invitado · ${email}`,
      });
    } catch {
      /* noop */
    }

    return { url, prefix };
  });

/** Rota el enlace de un participante y devuelve la nueva URL. */
export const rotateParticipantLink = createServerFn({ method: "POST" })
  .middleware([requireTradeRole])
  .inputValidator((d: unknown) => z.object({ participantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ url: string; prefix: string }> => {
    const sb = asSb(context.supabase);
    const token = newToken();
    const prefix = token.slice(0, TOKEN_PREFIX.length + 6);
    const { error } = await sb
      .from("trade_participants")
      .update({
        token_hash: await sha256Hex(token),
        token_prefix: prefix,
        status: "active",
        revoked_at: null,
      })
      .eq("id", data.participantId);
    if (error) throw new Error(error.message);
    return { url: publicUrl(`/ficha/${token}`), prefix };
  });

/** Revoca el acceso: el enlace deja de resolver de inmediato. */
export const revokeTradeParticipant = createServerFn({ method: "POST" })
  .middleware([requireTradeRole])
  .inputValidator((d: unknown) => z.object({ participantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sb = asSb(context.supabase);
    const { error } = await sb
      .from("trade_participants")
      .update({ status: "revoked", token_hash: null, revoked_at: new Date().toISOString() })
      .eq("id", data.participantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
