import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Trade Copilot: resume el estado del trade y sugiere el siguiente paso usando
// exclusivamente evidencia de la BD (RLS del usuario). Nunca inventa cifras.
// Server-only. Modelo: google/gemini-3-flash-preview vía Lovable AI Gateway.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export type TradeCopilotBrief = {
  headline: string;
  summary: string;
  nextAction: {
    title: string;
    detail: string;
    urgency: "baja" | "media" | "alta";
  };
  risks: string[];
  evidence: {
    docs: number;
    signedDocs: number;
    payments: number;
    paidPayments: number;
    shipments: number;
    events: number;
    packVersions: number;
    daysSinceLastEvent: number | null;
    missingTerms: string[];
  };
};

const Input = z.object({ tradeId: z.string().uuid() });

const SYSTEM =
  "Eres el copiloto de Trade Desk de Geocapitals: operador de deals de commodities mineros (LatAm, ES). " +
  "Analizas el estado real del trade y recomiendas el próximo paso, usando SOLO la evidencia entregada. " +
  "Nunca inventes contrapartes, cifras, fechas ni compromisos. Si falta un dato, dilo con claridad. " +
  "Sé breve, ejecutivo, sin adornos. Español neutro (Chile).";

export const getTradeCopilotBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<TradeCopilotBrief> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("El copiloto de IA no está configurado (LOVABLE_API_KEY).");

    const sb = asSb(context.supabase);

    const { data: trade, error } = await sb
      .from("commodity_trades")
      .select(
        "id, reference, commodity, form, quantity_t, incoterm, unit_price_usd, total_value_usd, currency, payment_instrument, stage, status, counterparty_name, counterparty_company, counterparty_country, counterparty_role, created_at",
      )
      .eq("id", data.tradeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!trade) throw new Error("Trade no encontrado o sin acceso.");

    const [docsQ, paysQ, shipsQ, eventsQ, packQ] = await Promise.all([
      sb
        .from("trade_documents")
        .select("doc_type, status, signed_at")
        .eq("trade_id", data.tradeId),
      sb
        .from("trade_payments")
        .select("kind, amount_usd, status, due_date, paid_at, instrument, label")
        .eq("trade_id", data.tradeId),
      sb
        .from("trade_shipments")
        .select("vessel_name, port_loading, port_discharge, eta, status, bl_number")
        .eq("trade_id", data.tradeId),
      sb
        .from("trade_events")
        .select("kind, detail, doc_type, created_at")
        .eq("trade_id", data.tradeId)
        .order("created_at", { ascending: false })
        .limit(20),
      sb
        .from("trade_pack_versions")
        .select("version, created_at")
        .eq("trade_id", data.tradeId)
        .order("version", { ascending: false })
        .limit(1),
    ]);

    const docs = (docsQ.data ?? []) as Array<{
      doc_type: string;
      status: string;
      signed_at: string | null;
    }>;
    const pays = (paysQ.data ?? []) as Array<{
      kind: string;
      amount_usd: number | null;
      status: string;
      due_date: string | null;
      paid_at: string | null;
      instrument: string | null;
      label: string | null;
    }>;
    const ships = (shipsQ.data ?? []) as Array<{
      vessel_name: string | null;
      port_loading: string | null;
      port_discharge: string | null;
      eta: string | null;
      status: string;
      bl_number: string | null;
    }>;
    const events = (eventsQ.data ?? []) as Array<{
      kind: string;
      detail: string | null;
      doc_type: string | null;
      created_at: string;
    }>;
    const packVersions = (packQ.data ?? []).length;

    const signedDocs = docs.filter((d) => d.signed_at || d.status === "signed").length;
    const paidPayments = pays.filter((p) => p.status === "paid" || p.paid_at).length;
    const lastEvent = events[0]?.created_at ?? null;
    const daysSinceLastEvent = lastEvent
      ? Math.floor((Date.now() - new Date(lastEvent).getTime()) / 86_400_000)
      : null;

    const missingTerms: string[] = [];
    if (trade.quantity_t == null) missingTerms.push("cantidad (t)");
    if (trade.incoterm == null) missingTerms.push("Incoterm");
    if (trade.unit_price_usd == null && trade.total_value_usd == null)
      missingTerms.push("precio");
    if (trade.payment_instrument == null) missingTerms.push("instrumento de pago");

    // Contexto compacto para el modelo (solo datos, ninguna instrucción).
    const context_ = {
      trade: {
        ref: trade.reference,
        commodity: trade.commodity,
        form: trade.form,
        quantity_t: trade.quantity_t,
        incoterm: trade.incoterm,
        unit_price_usd: trade.unit_price_usd,
        total_value_usd: trade.total_value_usd,
        payment_instrument: trade.payment_instrument,
        stage: trade.stage,
        status: trade.status,
        counterparty: [
          trade.counterparty_name,
          trade.counterparty_company,
          trade.counterparty_country,
        ]
          .filter(Boolean)
          .join(" · "),
        counterparty_role: trade.counterparty_role,
        created_at: trade.created_at,
      },
      docs: docs.map((d) => ({ type: d.doc_type, status: d.status, signed: !!d.signed_at })),
      payments: pays.map((p) => ({
        kind: p.kind,
        label: p.label,
        amount_usd: p.amount_usd,
        status: p.status,
        due: p.due_date,
        paid: !!p.paid_at,
        instrument: p.instrument,
      })),
      shipments: ships,
      recent_events: events.slice(0, 10),
      pack_versions: packVersions,
      missing_terms: missingTerms,
      days_since_last_event: daysSinceLastEvent,
    };

    const userPrompt =
      `Contexto del trade (JSON, exhaustivo, es tu única fuente de verdad):\n` +
      "```json\n" +
      JSON.stringify(context_, null, 2) +
      "\n```\n\n" +
      "Devuelve un JSON estricto con esta forma exacta (sin markdown, sin texto extra):\n" +
      `{
  "headline": "1 línea que resume el estado (máx 90 caracteres, no repitas la referencia)",
  "summary": "2-3 frases con hechos citando docs/pagos/embarques reales",
  "nextAction": {
    "title": "acción concreta a ejecutar hoy (máx 70 chars)",
    "detail": "cómo ejecutarla, 1-2 frases con datos del contexto",
    "urgency": "baja" | "media" | "alta"
  },
  "risks": ["riesgo 1", "riesgo 2"]
}\n` +
      "Reglas duras: si falta información, dilo (ej. \"falta cantidad\"). No agregues campos. No uses cifras ausentes del contexto.";

    const res = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429)
      throw new Error("Copiloto saturado (rate limit). Reintenta en unos segundos.");
    if (res.status === 402)
      throw new Error("Créditos de IA agotados en el workspace. Recárgalos para continuar.");
    if (!res.ok) throw new Error(`El copiloto respondió ${res.status}.`);
    const json = await res.json();
    const content = String(json.choices?.[0]?.message?.content ?? "").trim();
    if (!content) throw new Error("El copiloto no devolvió contenido.");

    let parsed: {
      headline?: unknown;
      summary?: unknown;
      nextAction?: { title?: unknown; detail?: unknown; urgency?: unknown };
      risks?: unknown;
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("El copiloto devolvió un formato inválido.");
    }

    const urgency = ["baja", "media", "alta"].includes(String(parsed.nextAction?.urgency))
      ? (parsed.nextAction!.urgency as "baja" | "media" | "alta")
      : "media";

    return {
      headline: String(parsed.headline ?? "").slice(0, 140) || "Sin resumen",
      summary: String(parsed.summary ?? "").slice(0, 800) || "—",
      nextAction: {
        title: String(parsed.nextAction?.title ?? "").slice(0, 120) || "Definir próximo paso",
        detail: String(parsed.nextAction?.detail ?? "").slice(0, 600) || "—",
        urgency,
      },
      risks: Array.isArray(parsed.risks)
        ? parsed.risks.map((r) => String(r).slice(0, 200)).slice(0, 5)
        : [],
      evidence: {
        docs: docs.length,
        signedDocs,
        payments: pays.length,
        paidPayments,
        shipments: ships.length,
        events: events.length,
        packVersions,
        daysSinceLastEvent,
        missingTerms,
      },
    };
  });

// ---------- Backfill: sugerir términos faltantes leyendo el LOI del pack ----------

const BackfillInput = z.object({ tradeId: z.string().uuid() });

export type TradeTermsSuggestion = {
  source: "pack_loi" | "trade_only" | "none";
  suggestions: {
    quantity_t?: number;
    incoterm?: string;
    unit_price_usd?: number;
    payment_instrument?: string;
  };
  rationale: string;
};

const BACKFILL_SYSTEM =
  "Eres el copiloto de Trade Desk de Geocapitals. Recibes el contexto de un trade con términos " +
  "faltantes y, si existe, el LOI/ICPO más reciente. Extrae SOLO valores citados textualmente. " +
  "Si no aparece un valor, omite ese campo (no lo inventes). Responde JSON estricto.";

export const suggestTradeTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BackfillInput.parse(d))
  .handler(async ({ data, context }): Promise<TradeTermsSuggestion> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("El copiloto de IA no está configurado (LOVABLE_API_KEY).");
    const sb = asSb(context.supabase);

    const { data: trade } = await sb
      .from("commodity_trades")
      .select(
        "id, reference, commodity, quantity_t, incoterm, unit_price_usd, payment_instrument, notes",
      )
      .eq("id", data.tradeId)
      .maybeSingle();
    if (!trade) throw new Error("Trade no encontrado o sin acceso.");

    const { data: pack } = await sb
      .from("trade_pack_versions")
      .select("version, terms_snapshot, created_at")
      .eq("trade_id", data.tradeId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const packRow = pack as { version?: number; terms_snapshot?: unknown } | null;
    const packSnapshot = packRow?.terms_snapshot ?? null;

    const userPrompt =
      "Trade actual (algunos campos pueden estar vacíos):\n```json\n" +
      JSON.stringify(trade, null, 2) +
      "\n```\n" +
      (packSnapshot
        ? "Términos del LOI/pack v" +
          (packRow?.version ?? "?") +
          " (fuente de verdad si contradice al trade):\n```json\n" +
          JSON.stringify(packSnapshot, null, 2) +
          "\n```\n"
        : "No hay pack de documentos generado para este trade.\n") +
      'Devuelve JSON estricto:\n{ "suggestions": { "quantity_t"?: number, "incoterm"?: string, "unit_price_usd"?: number, "payment_instrument"?: "sblc_mt760"|"dlc"|"tt"|"escrow" }, "rationale": "1-2 frases citando el origen del dato" }\n' +
      "Solo incluye campos con evidencia textual. Omite el resto.";

    const res = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: BACKFILL_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("Copiloto saturado. Reintenta en unos segundos.");
    if (res.status === 402) throw new Error("Créditos de IA agotados en el workspace.");
    if (!res.ok) throw new Error(`El copiloto respondió ${res.status}.`);
    const json = await res.json();
    const raw = String(json.choices?.[0]?.message?.content ?? "").trim();
    let parsed: { suggestions?: Record<string, unknown>; rationale?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("El copiloto devolvió un formato inválido.");
    }

    const s = parsed.suggestions ?? {};
    const clean: TradeTermsSuggestion["suggestions"] = {};
    if (typeof s.quantity_t === "number" && Number.isFinite(s.quantity_t) && s.quantity_t > 0)
      clean.quantity_t = s.quantity_t;
    if (typeof s.incoterm === "string" && s.incoterm.trim())
      clean.incoterm = s.incoterm.trim().slice(0, 20);
    if (
      typeof s.unit_price_usd === "number" &&
      Number.isFinite(s.unit_price_usd) &&
      s.unit_price_usd > 0
    )
      clean.unit_price_usd = s.unit_price_usd;
    if (
      typeof s.payment_instrument === "string" &&
      ["sblc_mt760", "dlc", "tt", "escrow"].includes(s.payment_instrument)
    )
      clean.payment_instrument = s.payment_instrument;

    return {
      source: packSnapshot ? "pack_loi" : "trade_only",
      suggestions: clean,
      rationale: String(parsed.rationale ?? "").slice(0, 400) || "—",
    };
  });

// ---------- Aplicar sugerencias al trade (solo campos permitidos) ----------

const ApplyInput = z.object({
  tradeId: z.string().uuid(),
  quantity_t: z.number().positive().max(1e9).optional(),
  incoterm: z.string().trim().max(20).optional(),
  unit_price_usd: z.number().positive().max(1e12).optional(),
  payment_instrument: z.enum(["sblc_mt760", "dlc", "tt", "escrow"]).optional(),
});

export const applyTradeTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ApplyInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; applied: string[] }> => {
    const sb = asSb(context.supabase);
    const patch: Record<string, unknown> = {};
    const applied: string[] = [];
    if (data.quantity_t != null) {
      patch.quantity_t = data.quantity_t;
      applied.push("quantity_t");
    }
    if (data.incoterm) {
      patch.incoterm = data.incoterm;
      applied.push("incoterm");
    }
    if (data.unit_price_usd != null) {
      patch.unit_price_usd = data.unit_price_usd;
      applied.push("unit_price_usd");
    }
    if (data.payment_instrument) {
      patch.payment_instrument = data.payment_instrument;
      applied.push("payment_instrument");
    }
    if (applied.length === 0) return { ok: true, applied: [] };

    const { error } = await sb.from("commodity_trades").update(patch).eq("id", data.tradeId);
    if (error) throw new Error(error.message);

    // Traza en el feed del trade (best-effort).
    try {
      await sb.from("trade_events").insert({
        trade_id: data.tradeId,
        actor_user_id: context.userId,
        kind: "terms_updated",
        detail: `Términos actualizados por copiloto: ${applied.join(", ")}`,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, applied };
  });
