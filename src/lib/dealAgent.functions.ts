import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Primer agente real de Geocapitals: dada una "próxima acción" del hub de un
// socio, redacta el mensaje de contacto (email o WhatsApp) usando el gateway de
// IA. El motor de reglas (nextActions) decide QUÉ hacer; el agente redacta el
// CÓMO. Server-only; usa LOVABLE_API_KEY.

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const Input = z.object({
  channel: z.enum(["email", "whatsapp"]),
  partnerName: z.string().trim().min(1).max(160),
  partnerCompany: z.string().trim().max(200).optional(),
  actionTitle: z.string().trim().min(1).max(200),
  actionDetail: z.string().trim().max(600).optional(),
  tradeReference: z.string().trim().max(120).optional(),
  commodity: z.string().trim().max(80).optional(),
});

const SYSTEM =
  "Eres el asistente comercial de Geocapitals, operador de operaciones (deals) de commodities mineros. " +
  "Redactas comunicaciones breves, cordiales y profesionales en español (Chile/LatAm). " +
  "Usas SOLO el contexto entregado: nunca inventes cifras, fechas ni compromisos que no estén en el brief. " +
  "Firmas como «Equipo Geocapitals». No agregues notas ni explicaciones fuera del mensaje.";

export const draftNextActionMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ message: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("El asistente de IA no está configurado (LOVABLE_API_KEY).");

    const who = data.partnerCompany
      ? `${data.partnerName} (${data.partnerCompany})`
      : data.partnerName;
    const op = [data.tradeReference, data.commodity].filter(Boolean).join(" · ");
    const limits =
      data.channel === "email"
        ? "Formato email: primera línea «Asunto: …», luego el cuerpo. Máximo 130 palabras."
        : "Formato WhatsApp: un solo párrafo, tono cercano pero profesional. Máximo 60 palabras.";

    const userPrompt =
      `Redacta un ${data.channel === "email" ? "email" : "mensaje de WhatsApp"} para ${who}.\n` +
      `Objetivo: ${data.actionTitle}.\n` +
      (data.actionDetail ? `Detalle: ${data.actionDetail}.\n` : "") +
      (op ? `Operación de referencia: ${op}.\n` : "") +
      limits;

    try {
      const res = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.5,
        }),
      });
      if (!res.ok) {
        throw new Error(`El asistente respondió ${res.status}. Intenta de nuevo.`);
      }
      const json = await res.json();
      const message = String(json.choices?.[0]?.message?.content ?? "").trim();
      if (!message) throw new Error("El asistente no devolvió contenido.");
      return { message };
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error("No se pudo generar el mensaje.");
    }
  });
