import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ContactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  organization: z.string().max(200).optional().nullable(),
  role: z.enum(["owner", "investor", "qp", "other"]),
  message: z.string().min(5).max(4000),
  source: z.string().max(60).optional(),
});

export type ContactInput = z.infer<typeof ContactSchema>;

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ContactSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("contact_messages")
      .insert({
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        organization: data.organization?.trim() || null,
        role: data.role,
        message: data.message.trim(),
        source: data.source || "landing",
      })
      .select("id")
      .single();
    if (error) {
      console.error("[contact] insert failed", error);
      throw new Error("No pudimos registrar tu mensaje. Intenta nuevamente.");
    }

    // Notificar al equipo — un lead que nadie lee es un lead perdido.
    // idempotencyKey por fila para no deduplicar mensajes distintos del mismo remitente.
    try {
      const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
      await sendInternalEmail({
        templateName: "contact-message-internal",
        recipientEmail: "team@geocapitals.com",
        idempotencyKey: `contact-message:${inserted.id}`,
        templateData: {
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          organization: data.organization?.trim() || undefined,
          role: data.role,
          source: data.source || "landing",
          message: data.message.trim(),
        },
      });
    } catch (e) {
      // El insert ya está persistido; el email es best-effort.
      console.error("[contact] notify failed", e);
    }

    return { ok: true as const };
  });
