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
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      organization: data.organization?.trim() || null,
      role: data.role,
      message: data.message.trim(),
      source: data.source || "landing",
    });
    if (error) {
      console.error("[contact] insert failed", error);
      throw new Error("No pudimos registrar tu mensaje. Intenta nuevamente.");
    }
    return { ok: true as const };
  });
