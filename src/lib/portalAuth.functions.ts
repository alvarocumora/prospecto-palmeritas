// Acceso a los paneles privados de operación: correo + código de un solo uso.
// El enlace por sí solo ya no abre el panel.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getOperacionAccessInfo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { resolveTradeByOpsToken, allowedEmailsFor, maskEmail } =
      await import("@/lib/portalSession.server");
    const t = await resolveTradeByOpsToken(data.token);
    if (!t) return { valid: false as const };
    const emails = await allowedEmailsFor(t);
    return {
      valid: true as const,
      reference: t.reference,
      commodity: t.commodity,
      role: t.role,
      hints: emails.map(maskEmail),
    };
  });

export const requestPortalOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(10).max(120),
        email: z.string().trim().email().max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { resolveTradeByOpsToken, createOtpChallenge } =
      await import("@/lib/portalSession.server");
    const t = await resolveTradeByOpsToken(data.token);
    // Respuesta uniforme: no revelamos si el correo está o no habilitado.
    if (!t) return { ok: true as const };
    const challenge = await createOtpChallenge(t, data.email);
    if (!challenge) return { ok: true as const };

    const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
    await sendInternalEmail({
      templateName: "portal-otp",
      recipientEmail: data.email,
      templateData: { code: challenge.code, reference: t.reference, minutes: 15 },
      idempotencyKey: `portal-otp:${t.tradeId}:${Date.now()}`,
    });

    try {
      await t.sb.from("trade_events").insert({
        trade_id: t.tradeId,
        kind: "portal_otp_requested",
        detail: `Código de acceso enviado a ${data.email.trim().toLowerCase()}`,
      });
    } catch {
      /* no bloquea */
    }
    return { ok: true as const };
  });

export const verifyPortalOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(10).max(120),
        email: z.string().trim().email().max(200),
        code: z
          .string()
          .trim()
          .regex(/^\d{6}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { resolveTradeByOpsToken, consumeOtpChallenge } =
      await import("@/lib/portalSession.server");
    const t = await resolveTradeByOpsToken(data.token);
    if (!t) return { ok: false as const, error: "Enlace no válido." };
    const res = await consumeOtpChallenge(t, data.email, data.code);
    if (!res) return { ok: false as const, error: "Código incorrecto o vencido." };

    try {
      await t.sb.from("trade_events").insert({
        trade_id: t.tradeId,
        kind: "portal_access_granted",
        detail: `Acceso validado por ${data.email.trim().toLowerCase()}`,
      });
    } catch {
      /* no bloquea */
    }
    return { ok: true as const, session: res.session, expiresAt: res.expiresAt };
  });

export const checkPortalSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(10).max(120),
        session: z.string().min(10).max(200).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getPortalSession } = await import("@/lib/portalSession.server");
    const s = await getPortalSession(data.token, data.session ?? null);
    return s ? { active: true as const, email: s.email } : { active: false as const };
  });
