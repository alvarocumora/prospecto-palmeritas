import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TEMPLATE_BY_ID, buildReference } from "@/lib/documents/templates";
import {
  generateSignToken,
  signTokenPrefix,
  sha256Hex,
  docHash,
} from "@/lib/documents/signing";
import { signUrl as buildSignUrl, publicUrl } from "@/lib/publicUrl";
import { OWN_PARTY_LINE } from "@/lib/documents/company";

// Onboarding de proveedor: en un solo click, Geocapitals (como intermediario)
// crea la solicitud de firma del NDA + LOI y arma el link del Portal Proveedor
// para carga documental. Envía un único correo al proveedor con los 3 enlaces.
//
// Reutiliza el pipeline de `document_sign_requests`: el token viaja en claro
// exactamente una vez, dentro del mail. Nada queda persistido en texto plano.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

const Input = z.object({
  tradeId: z.string().uuid(),
  partnerId: z.string().uuid().optional(),
  overrideEmail: z.string().trim().email().max(160).optional(),
  overrideName: z.string().trim().max(120).optional(),
});

type TradeRow = {
  id: string;
  reference: string | null;
  commodity: string | null;
  form: string | null;
  quantity_t: number | null;
  incoterm: string | null;
  unit_price_usd: number | null;
  total_value_usd: number | null;
  currency: string | null;
  counterparty_name: string | null;
  counterparty_company: string | null;
  counterparty_email: string | null;
};

type PartnerRow = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function insertSignRequest(
  sb: SupabaseClient,
  userId: string,
  templateId: "nda" | "loi",
  doc: Awaited<ReturnType<typeof buildDoc>>,
  signerName: string | undefined,
  signerEmail: string,
  tradeId: string,
): Promise<{ id: string; token: string; expiresAt: string | null }> {
  const token = generateSignToken();
  const base = {
    created_by: userId,
    template_id: templateId,
    reference: doc.reference,
    title: doc.title,
    doc,
    doc_hash: await docHash(doc),
    signer_name_expected: signerName ?? null,
    signer_email: signerEmail,
    token_prefix: signTokenPrefix(token),
    token_hash: await sha256Hex(token),
  };
  let ins = await sb
    .from("document_sign_requests")
    .insert({ ...base, trade_id: tradeId })
    .select("id, expires_at")
    .single();
  // Fallback pre-migración: si trade_id aún no existe, insertar sin el vínculo.
  if (ins.error && /trade_id|schema cache|column/i.test(ins.error.message)) {
    ins = await sb
      .from("document_sign_requests")
      .insert(base)
      .select("id, expires_at")
      .single();
  }
  if (ins.error) throw new Error(ins.error.message);
  const row = ins.data as { id: string; expires_at: string | null };
  return { id: row.id, token, expiresAt: row.expires_at };
}

function buildDoc(
  templateId: "nda" | "loi",
  trade: TradeRow,
  partnerLine: string,
) {
  const tpl = TEMPLATE_BY_ID[templateId];
  if (!tpl) throw new Error(`Plantilla '${templateId}' no encontrada.`);
  const values: Record<string, string> =
    templateId === "nda"
      ? {
          mode: "mutuo",
          partyA: OWN_PARTY_LINE,
          partyB: partnerLine,
          purpose: `evaluación y ejecución de la operación ${trade.reference ?? ""} sobre ${trade.commodity ?? "[producto]"}`,
          termMonths: "24",
          jurisdiction: "República de Chile",
        }
      : {
          buyer: OWN_PARTY_LINE,
          seller: partnerLine,
          project: `${trade.commodity ?? "[producto]"}${trade.form ? ` · ${trade.form}` : ""} — Op. ${trade.reference ?? ""}`,
          amount: trade.total_value_usd
            ? Math.round(trade.total_value_usd).toLocaleString("en-US")
            : "",
          structure: "compra spot / trial order",
          validityDays: "30",
        };
  const active = new Set(tpl.clauses.filter((c) => c.defaultOn !== false).map((c) => c.key));
  const reference = buildReference(templateId);
  return tpl.build(values, active, { reference, date: today() });
}

export const sendSupplierOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);

    // 1. Trade
    const { data: tradeRaw, error: tErr } = await sb
      .from("commodity_trades")
      .select(
        "id, reference, commodity, form, quantity_t, incoterm, unit_price_usd, total_value_usd, currency, counterparty_name, counterparty_company, counterparty_email",
      )
      .eq("id", data.tradeId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tradeRaw) throw new Error("Trade no encontrado o sin acceso.");
    const trade = tradeRaw as TradeRow;

    // 2. Partner (opcional) — puede venir por id o resolverse por counterparty del trade.
    let partner: PartnerRow | null = null;
    if (data.partnerId) {
      const { data: p, error: pErr } = await sb
        .from("business_partners")
        .select("id, name, company, email")
        .eq("id", data.partnerId)
        .maybeSingle();
      if (pErr) throw new Error(pErr.message);
      partner = (p as PartnerRow) ?? null;
    }

    const signerEmail = (
      data.overrideEmail ??
      partner?.email ??
      trade.counterparty_email ??
      ""
    ).trim();
    if (!signerEmail) {
      throw new Error(
        "No hay email del proveedor. Vincula un partner con email o pásalo explícito.",
      );
    }
    const signerName =
      data.overrideName ??
      partner?.name ??
      trade.counterparty_name ??
      undefined;
    const partnerLine = [
      partner?.name ?? trade.counterparty_name ?? signerName ?? "",
      partner?.company ?? trade.counterparty_company ?? "",
    ]
      .filter(Boolean)
      .join(" · ") || signerName || signerEmail;

    // 3. Generar y persistir los dos sign requests.
    const nda = await insertSignRequest(
      sb,
      context.userId as string,
      "nda",
      buildDoc("nda", trade, partnerLine),
      signerName,
      signerEmail,
      trade.id,
    );
    const loi = await insertSignRequest(
      sb,
      context.userId as string,
      "loi",
      buildDoc("loi", trade, partnerLine),
      signerName,
      signerEmail,
      trade.id,
    );

    // 4. Link del Portal Proveedor (ruta pública ya existente).
    const portalUrl = publicUrl(
      `/portal-proveedor?trade=${encodeURIComponent(trade.reference ?? trade.id)}&email=${encodeURIComponent(signerEmail)}`,
    );

    // 5. Enviar un único correo con los 3 enlaces.
    let emailed = false;
    try {
      const [{ sendInternalEmail }, { OWN_COMPANY }] = await Promise.all([
        import("@/lib/email/send-internal.server"),
        import("@/lib/documents/company"),
      ]);
      const expiresAt = nda.expiresAt
        ? new Date(nda.expiresAt).toLocaleDateString("es-CL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : undefined;
      const res = await sendInternalEmail({
        templateName: "supplier-onboarding",
        recipientEmail: signerEmail,
        idempotencyKey: `supplier-onboarding:${trade.id}:${nda.id}`,
        templateData: {
          supplierName: signerName,
          supplierCompany: partner?.company ?? trade.counterparty_company ?? undefined,
          tradeReference: trade.reference ?? undefined,
          commodity: [trade.commodity, trade.form].filter(Boolean).join(" · ") || undefined,
          senderCompany: OWN_COMPANY.name,
          ndaUrl: buildSignUrl(nda.token),
          loiUrl: buildSignUrl(loi.token),
          portalUrl,
          expiresAt,
        },
      });
      emailed = res.ok && "queued" in res && res.queued === true;
    } catch (e) {
      console.error("[sendSupplierOnboarding] email failed", e);
    }

    // 6. Timeline del trade (best-effort).
    try {
      await sb.from("trade_events").insert({
        trade_id: trade.id,
        kind: "supplier_onboarding_sent",
        actor_user_id: context.userId as string,
        payload: {
          to: signerEmail,
          nda_request_id: nda.id,
          loi_request_id: loi.id,
          portal_url: portalUrl,
          emailed,
        },
      });
    } catch {
      // Si la tabla o columnas difieren en el entorno, no bloqueamos el envío.
    }

    return {
      emailed,
      recipient: signerEmail,
      nda: { requestId: nda.id, signUrl: buildSignUrl(nda.token) },
      loi: { requestId: loi.id, signUrl: buildSignUrl(loi.token) },
      portalUrl,
    };
  });
