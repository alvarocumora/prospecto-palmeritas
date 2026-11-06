// Solicitud pública de reunión con el equipo de estructuración. Solo notifica
// internamente a team@geocapitals.com; nunca escribe a terceros.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const MEETING_TOPICS = {
  cholqui: "Ronda Cholqui (USD 1,5 M)",
  losverdes: "Ronda Los Verdes–Tilama (USD 1,5 M)",
  colateral: "Mutuo con colateral (UF + 25 % anual)",
  general: "Consulta general",
} as const;
export type MeetingTopic = keyof typeof MEETING_TOPICS;

const Schema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional().nullable(),
  topic: z.enum(["cholqui", "losverdes", "colateral", "general"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.string().regex(/^\d{2}:\d{2}$/),
  message: z.string().trim().max(2000).optional().nullable(),
});

export const requestMeeting = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data }) => {
    try {
      const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
      await sendInternalEmail({
        templateName: "contact-message-internal",
        recipientEmail: "team@geocapitals.com",
        idempotencyKey: `meeting:${data.email.toLowerCase()}:${data.date}:${data.slot}`,
        templateData: {
          name: data.name,
          email: data.email.toLowerCase(),
          organization: data.phone || undefined,
          role: "investor",
          source: "agendar-reunion",
          message: `Reunión solicitada: ${data.date} ${data.slot} (hora Santiago)\nTema: ${MEETING_TOPICS[data.topic]}\n\n${data.message ?? ""}`,
        },
      });
    } catch (e) {
      console.error("[meeting] notify failed", e);
      throw new Error("No pudimos registrar tu solicitud. Intenta nuevamente.");
    }
    return { ok: true as const };
  });
