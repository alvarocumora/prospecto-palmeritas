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

const SingleInput = z.object({
  tradeId: z.string().uuid(),
  partnerId: z.string().uuid().optional(),
  overrideEmail: z.string().trim().email().max(160).optional(),
  overrideName: z.string().trim().max(120).optional(),
});

const BatchInput = z.object({
  tradeIds: z.array(z.string().uuid()).min(1).max(50),
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

// Núcleo compartido por la versión single y batch. Devuelve el resultado
// del envío para un único trade sin lanzar (recolecta el error en `error`).
async function runOnboardingForTrade(
  sb: SupabaseClient,
  userId: string,
  data: z.infer<typeof SingleInput>,
): Promise<{
  tradeId: string;
  ok: boolean;
  emailed: boolean;
  recipient?: string;
  reference?: string;
  ndaSignUrl?: string;
  loiSignUrl?: string;
  portalUrl?: string;
  error?: string;
}> {
  try {
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
      throw new Error("Sin email de contraparte — vincula un partner o pasá overrideEmail.");
    }
    const signerName =
      data.overrideName ?? partner?.name ?? trade.counterparty_name ?? undefined;
    const partnerLine =
      [
        partner?.name ?? trade.counterparty_name ?? signerName ?? "",
        partner?.company ?? trade.counterparty_company ?? "",
      ]
        .filter(Boolean)
        .join(" · ") ||
      signerName ||
      signerEmail;

    const nda = await insertSignRequest(
      sb,
      userId,
      "nda",
      buildDoc("nda", trade, partnerLine),
      signerName,
      signerEmail,
      trade.id,
    );
    const loi = await insertSignRequest(
      sb,
      userId,
      "loi",
      buildDoc("loi", trade, partnerLine),
      signerName,
      signerEmail,
      trade.id,
    );

    const portalUrl = publicUrl(
      `/portal-proveedor?trade=${encodeURIComponent(trade.reference ?? trade.id)}&email=${encodeURIComponent(signerEmail)}`,
    );

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
      console.error("[onboarding] email failed", e);
    }

    try {
      await sb.from("trade_events").insert({
        trade_id: trade.id,
        kind: "supplier_onboarding_sent",
        actor_user_id: userId,
        detail: JSON.stringify({
          to: signerEmail,
          nda_request_id: nda.id,
          loi_request_id: loi.id,
          portal_url: portalUrl,
          emailed,
        }),
      });
    } catch {
      // trade_events schema puede variar; no bloqueamos.
    }

    return {
      tradeId: trade.id,
      ok: true,
      emailed,
      recipient: signerEmail,
      reference: trade.reference ?? undefined,
      ndaSignUrl: buildSignUrl(nda.token),
      loiSignUrl: buildSignUrl(loi.token),
      portalUrl,
    };
  } catch (e) {
    return {
      tradeId: data.tradeId,
      ok: false,
      emailed: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export const sendSupplierOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SingleInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const r = await runOnboardingForTrade(sb, context.userId as string, data);
    if (!r.ok) throw new Error(r.error ?? "No se pudo enviar el onboarding.");
    return {
      emailed: r.emailed,
      recipient: r.recipient!,
      nda: { signUrl: r.ndaSignUrl! },
      loi: { signUrl: r.loiSignUrl! },
      portalUrl: r.portalUrl!,
    };
  });

// Batch: procesa N trades en serie (concurrencia 1) para no saturar el
// motor de emails ni multiplicar el consumo de tokens. Nunca lanza — devuelve
// el reporte por trade para que la UI muestre éxitos y errores.
export const sendSupplierOnboardingBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BatchInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const results: Awaited<ReturnType<typeof runOnboardingForTrade>>[] = [];
    for (const tradeId of data.tradeIds) {
      results.push(
        await runOnboardingForTrade(sb, context.userId as string, { tradeId }),
      );
    }
    const summary = {
      total: results.length,
      sent: results.filter((r) => r.ok && r.emailed).length,
      created: results.filter((r) => r.ok && !r.emailed).length,
      failed: results.filter((r) => !r.ok).length,
    };
    return { results, summary };
  });

// Estado de onboarding derivado para la lista. Un query eficiente:
// (1) último trade_event de tipo supplier_onboarding_sent por trade,
// (2) últimas sign_requests NDA/LOI ligadas a esos trades.
export const listOnboardingStatusForTrades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tradeIds: z.array(z.string().uuid()).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    if (data.tradeIds.length === 0) return { status: {} as Record<string, OnboardingStatus> };

    const [events, signs] = await Promise.all([
      sb
        .from("trade_events")
        .select("trade_id, kind, created_at")
        .in("trade_id", data.tradeIds)
        .eq("kind", "supplier_onboarding_sent"),
      sb
        .from("document_sign_requests")
        .select("trade_id, template_id, status, signed_at, created_at")
        .in("trade_id", data.tradeIds)
        .in("template_id", ["nda", "loi"]),
    ]);

    const sentAt = new Map<string, string>();
    for (const e of (events.data ?? []) as Array<{ trade_id: string; created_at: string }>) {
      const prev = sentAt.get(e.trade_id);
      if (!prev || prev < e.created_at) sentAt.set(e.trade_id, e.created_at);
    }

    type SR = { trade_id: string; template_id: string; status: string | null; signed_at: string | null };
    const byTrade = new Map<string, { nda?: SR; loi?: SR }>();
    for (const r of (signs.data ?? []) as SR[]) {
      const slot = byTrade.get(r.trade_id) ?? {};
      if (r.template_id === "nda") slot.nda = r;
      else if (r.template_id === "loi") slot.loi = r;
      byTrade.set(r.trade_id, slot);
    }

    const status: Record<string, OnboardingStatus> = {};
    for (const id of data.tradeIds) {
      const s = byTrade.get(id) ?? {};
      const isSigned = (r?: SR) =>
        !!r && (r.status === "signed" || r.status === "completed" || !!r.signed_at);
      const ndaSigned = isSigned(s.nda);
      const loiSigned = isSigned(s.loi);
      const wasSent = sentAt.has(id) || !!s.nda || !!s.loi;
      const state: OnboardingStatus["state"] =
        ndaSigned && loiSigned
          ? "signed"
          : ndaSigned || loiSigned
            ? "partial"
            : wasSent
              ? "sent"
              : "pending";
      status[id] = {
        state,
        ndaSigned,
        loiSigned,
        sentAt: sentAt.get(id) ?? null,
      };
    }
    return { status };
  });

export type OnboardingStatus = {
  state: "pending" | "sent" | "partial" | "signed";
  ndaSigned: boolean;
  loiSigned: boolean;
  sentAt: string | null;
};
