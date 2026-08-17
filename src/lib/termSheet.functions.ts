import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCapitalRole } from "@/lib/access/roleMiddleware";
import { buildTermSheet, termSheetToMarkdown, type TermSheet } from "@/lib/termSheet";
import { computePayableValue, normalizeDeleterious } from "@/lib/payableValue";
import { fetchLivePrices } from "@/lib/payableValue.functions";
import { commodityLabel, formLabel, countryName } from "@/lib/commodityLabels";

// Agente redactor de term sheet: genera un borrador de condiciones comerciales
// para una consulta del pipeline del vendedor. Solo el vendedor dueño del lote.

export type TermSheetDraft = {
  termSheet: TermSheet;
  markdown: string;
  aiSummary: string | null;
};

const input = z.object({ inquiryId: z.string().uuid() });

async function aiSummary(ts: TermSheet): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      signal: AbortSignal.timeout(9000),
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Eres un ejecutivo comercial de minería. En 2 frases en español, resume este term sheet para acompañar el envío al comprador, en tono profesional. Usa SOLO los datos entregados.",
          },
          { role: "user", content: JSON.stringify(ts) },
        ],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text = j.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

export const draftTermSheet = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }): Promise<TermSheetDraft | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inq } = await supabaseAdmin
      .from("commodity_inquiries")
      .select("id, lot_id, buyer_user_id, company_name, target_volume_t")
      .eq("id", data.inquiryId)
      .maybeSingle();
    if (!inq) return null;

    const { data: lot } = await supabaseAdmin
      .from("commodity_lots")
      .select(
        "id, title, commodity, form, grade_pct, moisture_pct, deleterious_json, tonnage_available_t, incoterm, port_of_loading, country, price_basis, premium_discount_usd_t, payment_terms, asking_price_usd, seller_user_id, organization_id",
      )
      .eq("id", inq.lot_id)
      .maybeSingle();
    if (!lot) return null;
    // Autorización: solo el vendedor dueño del lote.
    if (lot.seller_user_id !== context.userId) return null;

    // Nombres de las partes.
    let sellerName = "Vendedor";
    if (lot.organization_id) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("name")
        .eq("id", lot.organization_id)
        .maybeSingle();
      if (org?.name) sellerName = org.name;
    }
    let buyerName = inq.company_name ?? "Comprador";
    if (!inq.company_name) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("user_id", inq.buyer_user_id)
        .maybeSingle();
      if (prof?.email) buyerName = prof.email;
    }

    // Valor pagable estimado a precio de mercado en vivo.
    const prices = await fetchLivePrices();
    const valuation = computePayableValue({
      commodity: lot.commodity as string,
      gradePct: lot.grade_pct != null ? Number(lot.grade_pct) : null,
      moisturePct: lot.moisture_pct != null ? Number(lot.moisture_pct) : null,
      tonnage: lot.tonnage_available_t != null ? Number(lot.tonnage_available_t) : null,
      deleterious: normalizeDeleterious(lot.deleterious_json),
      prices,
    });

    const ref = `TS-${new Date().getFullYear()}-${data.inquiryId.slice(0, 6).toUpperCase()}`;
    const termSheet = buildTermSheet({
      ref,
      sellerName,
      buyerName,
      lotTitle: lot.title as string,
      commodityLabel: commodityLabel(lot.commodity as string),
      formLabel: formLabel(lot.form as string),
      gradePct: lot.grade_pct != null ? Number(lot.grade_pct) : null,
      moisturePct: lot.moisture_pct != null ? Number(lot.moisture_pct) : null,
      deleterious: normalizeDeleterious(lot.deleterious_json),
      tonnageT: lot.tonnage_available_t != null ? Number(lot.tonnage_available_t) : null,
      targetVolumeT: inq.target_volume_t != null ? Number(inq.target_volume_t) : null,
      incoterm: (lot.incoterm as string) ?? null,
      portOfLoading: (lot.port_of_loading as string) ?? null,
      country: countryName(lot.country as string),
      priceBasis: (lot.price_basis as string) ?? null,
      premiumDiscountUsdT:
        lot.premium_discount_usd_t != null ? Number(lot.premium_discount_usd_t) : null,
      paymentTerms: (lot.payment_terms as string) ?? null,
      netUsdT: valuation.supported ? valuation.netUsdDmt : null,
      band: valuation.supported ? valuation.band : null,
    });

    return {
      termSheet,
      markdown: termSheetToMarkdown(termSheet),
      aiSummary: await aiSummary(termSheet),
    };
  });
