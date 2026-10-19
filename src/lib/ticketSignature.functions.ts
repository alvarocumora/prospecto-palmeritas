/**
 * Firma manuscrita del contrato de un ticket: bucket privado en Supabase
 * Storage (creado perezosamente, sin policies de cliente — mismo patrón que
 * data-room-files en dataRoom.functions.ts), toda subida/descarga pasa por
 * estas funciones con service role. El hash del contrato y el nombre del
 * firmante ya quedan registrados por ticket_sign_contract; esto solo guarda
 * el trazo dibujado para que el PDF "contrato firmado" lo muestre desde
 * cualquier dispositivo, no solo el navegador donde se firmó.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "ticket-signatures";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Admin = Awaited<ReturnType<typeof admin>>;

async function ensureBucket(sb: Admin) {
  const { data } = await sb.storage.getBucket(BUCKET);
  if (!data) {
    await sb.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 2 * 1024 * 1024 });
  }
}

async function isStaff(supabase: Admin, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("is_geocapitals_staff", { _user_id: userId });
  return !!data;
}

function path(ticketId: string) {
  return `${ticketId}/signature.png`;
}

const TicketIdSchema = z.object({ ticketId: z.string().uuid() });

/** El inversionista pide subir el trazo de SU ticket (ya firmado o en curso de firma). */
export const requestTicketSignatureUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => TicketIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: t } = await sb
      .from("investment_tickets")
      .select("investor_user_id")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!t || t.investor_user_id !== context.userId) throw new Error("Ticket no encontrado");
    await ensureBucket(sb);
    const { data: up, error } = await sb.storage
      .from(BUCKET)
      .createSignedUploadUrl(path(data.ticketId), { upsert: true });
    if (error) throw new Error(error.message);
    return { bucket: BUCKET, path: up.path, token: up.token };
  });

/** Dueño del ticket o staff piden ver el trazo (null si nunca se subió). */
export const getTicketSignatureUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => TicketIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: t } = await sb
      .from("investment_tickets")
      .select("investor_user_id")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!t) throw new Error("Ticket no encontrado");
    if (t.investor_user_id !== context.userId && !(await isStaff(sb, context.userId))) {
      throw new Error("No autorizado");
    }
    const { data: signed, error } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(path(data.ticketId), 120);
    if (error) return { url: null };
    return { url: signed?.signedUrl ?? null };
  });
