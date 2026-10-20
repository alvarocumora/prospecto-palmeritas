// Llamada estructurada a Lovable AI Gateway vía OpenAI Responses (server-only).
// Streaming obligatorio; el objeto final se consume en el servidor.
import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import type { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
export const REPORT_MODEL = "openai/gpt-6-astra";

function runIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has("X-Lovable-AIG-Run-ID")) headers.set("X-Lovable-AIG-Run-ID", runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get("X-Lovable-AIG-Run-ID")?.trim() || undefined;
    return res;
  };
}

export type StructuredResult<T> = { value: T | null; error: string | null };

export async function generateStructured<T>(opts: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  effort?: "low" | "medium" | "high";
}): Promise<StructuredResult<T>> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { value: null, error: "IA no configurada." };
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch(),
  });
  let streamError: unknown = null;
  try {
    const result = streamText({
      model: provider.responses(REPORT_MODEL),
      system: opts.system,
      prompt: opts.prompt,
      output: Output.object({ schema: opts.schema }),
      onError: ({ error }) => {
        streamError = error;
      },
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: opts.effort ?? "medium",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
          strictJsonSchema: true,
        },
      },
    });
    const value = (await result.output) as T;
    return { value, error: null };
  } catch (err) {
    const e = streamError ?? err;
    console.error("[ai-responses]", e);
    const msg = String((e as Error)?.message ?? e);
    const status = (e as { statusCode?: number })?.statusCode;
    if (NoObjectGeneratedError.isInstance(err)) return { value: null, error: "La IA devolvió un formato inválido." };
    if (status === 429 || /429/.test(msg)) return { value: null, error: "Límite de uso de IA alcanzado; intenta en unos minutos." };
    if (status === 402 || /402/.test(msg)) return { value: null, error: "Sin créditos de IA disponibles (Ajustes → Planes y créditos)." };
    if (status === 403) return { value: null, error: "Acceso a IA bloqueado por la configuración del espacio de trabajo." };
    return { value: null, error: "La IA no respondió." };
  }
}
