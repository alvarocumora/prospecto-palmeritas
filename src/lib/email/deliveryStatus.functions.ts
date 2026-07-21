import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

// Consulta el estado de envío y apertura de correos recientes por destinatario
// y plantilla. Sirve para mostrar badges "enviado / abierto" tras el despacho
// del paquete Antimonio (NDA/LOI a Ana + fichas a Carpio & Kaddu).

export type DeliveryRow = {
  recipient: string;
  templateName: string;
  status: string; // pending | sent | failed | dlq | bounced | complained | suppressed
  messageId: string | null;
  sentAt: string | null;
  openedAt: string | null;
  errorMessage?: string | null;
};

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

const InputSchema = z.object({
  recipients: z.array(z.string().email()).min(1).max(20),
  templateNames: z.array(z.string().min(1)).min(1).max(10),
  sinceHours: z.number().int().min(1).max(24 * 30).default(72),
});

export const getEmailDeliveryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }): Promise<DeliveryRow[]> => {
    const sb = asSb(context.supabase);
    const since = new Date(Date.now() - data.sinceHours * 3600 * 1000).toISOString();
    const emails = data.recipients.map((e) => e.trim().toLowerCase());

    const { data: logs } = await sb
      .from("email_send_log")
      .select("message_id, template_name, recipient_email, status, error_message, created_at")
      .in("recipient_email", emails)
      .in("template_name", data.templateNames)
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    // Dedup por message_id: nos quedamos con el estado más reciente.
    const latestByMsg = new Map<
      string,
      {
        message_id: string;
        template_name: string;
        recipient_email: string;
        status: string;
        error_message: string | null;
        created_at: string;
      }
    >();
    for (const r of (logs ?? []) as Array<{
      message_id: string | null;
      template_name: string;
      recipient_email: string;
      status: string;
      error_message: string | null;
      created_at: string;
    }>) {
      const key = r.message_id ?? `${r.template_name}:${r.recipient_email}:${r.created_at}`;
      if (!latestByMsg.has(key)) {
        latestByMsg.set(key, {
          message_id: r.message_id ?? key,
          template_name: r.template_name,
          recipient_email: r.recipient_email,
          status: r.status,
          error_message: r.error_message,
          created_at: r.created_at,
        });
      }
    }

    // Nos quedamos con la fila más reciente por (recipient, template).
    const latestPerPair = new Map<string, ReturnType<typeof latestByMsg.get>>();
    for (const row of latestByMsg.values()) {
      const key = `${row!.template_name}::${row!.recipient_email}`;
      const cur = latestPerPair.get(key);
      if (!cur || new Date(row!.created_at) > new Date(cur.created_at)) {
        latestPerPair.set(key, row);
      }
    }

    const messageIds = Array.from(latestPerPair.values())
      .map((r) => r?.message_id)
      .filter((x): x is string => !!x);

    let opens: Map<string, string> = new Map();
    if (messageIds.length > 0) {
      const { data: events } = await sb
        .from("email_delivery_events")
        .select("message_id, event, occurred_at")
        .eq("event", "opened")
        .in("message_id", messageIds)
        .order("occurred_at", { ascending: true });
      for (const ev of (events ?? []) as Array<{
        message_id: string;
        event: string;
        occurred_at: string;
      }>) {
        if (!opens.has(ev.message_id)) opens.set(ev.message_id, ev.occurred_at);
      }
    }

    return Array.from(latestPerPair.values()).map((r) => ({
      recipient: r!.recipient_email,
      templateName: r!.template_name,
      status: r!.status,
      messageId: r!.message_id,
      sentAt: r!.created_at,
      openedAt: opens.get(r!.message_id) ?? null,
      errorMessage: r!.error_message,
    }));
  });
