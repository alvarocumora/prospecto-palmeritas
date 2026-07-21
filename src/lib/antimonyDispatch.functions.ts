import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicUrl } from "@/lib/publicUrl";

// Despacho ejecutivo específico del trade de antimonio Sb Grade 2#
// (SB-ANTIMONIO-202607-4434, Aupal Propiedades ↔ Carpio & Kaddu Group).
// Hace en una sola llamada:
//   1) Onboarding a Ana Rojo (NDA + LOI + link al Portal Proveedor) reutilizando
//      `sendSupplierOnboarding` internamente (mismo pipeline de firma/tokens).
//   2) Ficha técnica del antimonio (CoA + SGS) a Marcela Cimino y Vincent Carpio.
// Devuelve un reporte por destinatario. No lanza si un envío falla.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

const TRADE_REF = "SB-ANTIMONIO-202607-4434";

export const dispatchAntimonyPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tradeId: z.string().uuid().optional(),
        buyers: z
          .array(
            z.object({
              name: z.string().min(1),
              company: z.string().optional(),
              email: z.string().email(),
            }),
          )
          .default([
            { name: "Marcela Cimino", company: "Carpio & Kaddu Group", email: "ciminomarcela@gmail.com" },
            { name: "Vincent Carpio", company: "Carpio & Kaddu Group", email: "carpio@carpiokaddu.com" },
          ]),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);

    // Localiza el trade de antimonio (por referencia o por id).
    let tradeId = data.tradeId ?? null;
    let reference = TRADE_REF;
    if (!tradeId) {
      const { data: t } = await sb
        .from("commodity_trades")
        .select("id, reference")
        .ilike("reference", "SB-ANTIMONIO%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (t) {
        tradeId = (t as { id: string; reference: string }).id;
        reference = (t as { reference: string }).reference ?? reference;
      }
    }

    const results: Array<{ to: string; kind: string; ok: boolean; reason?: string }> = [];

    // 1) Onboarding a proveedor (Ana Rojo) — usa el pipeline existente.
    let onboarding: Awaited<ReturnType<typeof runOnboarding>> | { ok: false; error: string } = {
      ok: false,
      error: "trade not found",
    };
    if (tradeId) {
      onboarding = await runOnboarding(sb, context.userId as string, tradeId);
      results.push({
        to: onboarding.ok ? onboarding.recipient ?? "" : "ana.rojo67@gmail.com",
        kind: "supplier-onboarding",
        ok: onboarding.ok,
        reason: onboarding.ok ? undefined : onboarding.error,
      });
    }

    // 2) Ficha técnica del antimonio a los buyers — con PDF oficial adjunto (signed URL).
    const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
    const { buildAntimonySheetPdf, uploadPdfSigned } = await import(
      "@/lib/documents/officialPdfs.server"
    );
    const operationUrl = tradeId ? publicUrl(`/operacion/${tradeId}`) : undefined;
    for (const buyer of data.buyers) {
      let sheetPdfUrl: string | undefined;
      try {
        const bytes = await buildAntimonySheetPdf({
          reference: `SHEET-${reference}`,
          recipient: { role: "Buyer", name: buyer.name, company: buyer.company, email: buyer.email },
        });
        sheetPdfUrl = await uploadPdfSigned({
          bytes,
          path: `antimony/${tradeId ?? "n-a"}/sheet-${Date.now()}-${buyer.email.replace(/[^a-z0-9]/gi, "_")}.pdf`,
          ttlDays: 60,
        });
      } catch (e) {
        console.error("[antimony] pdf attach failed", e);
      }
      try {
        const res = await sendInternalEmail({
          templateName: "antimony-product-sheet",
          recipientEmail: buyer.email,
          idempotencyKey: `antimony-sheet:${tradeId ?? "n/a"}:${buyer.email}`,
          templateData: {
            recipientName: buyer.name,
            recipientCompany: buyer.company,
            tradeReference: reference,
            senderCompany: "Geocapitals",
            operationUrl,
            sheetPdfUrl,
          },
        });

        results.push({
          to: buyer.email,
          kind: "antimony-product-sheet",
          ok: res.ok,
          reason:
            res.ok && "queued" in res && res.queued
              ? "queued"
              : "reason" in res
                ? res.reason
                : "error" in res
                  ? res.error
                  : undefined,
        });
      } catch (e) {
        results.push({
          to: buyer.email,
          kind: "antimony-product-sheet",
          ok: false,
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (tradeId) {
      try {
        await sb.from("trade_events").insert({
          trade_id: tradeId,
          kind: "antimony_package_dispatched",
          actor_user_id: context.userId,
          detail: JSON.stringify({ results }),
        });
      } catch {
        // no bloquea
      }
    }

    return { tradeId, reference, results };
  });

// Runner del onboarding (Ana Rojo) — replica el flujo de
// sendSupplierOnboarding sin depender del import cruzado, para evitar el
// re-entry por RPC dentro de un mismo handler.
async function runOnboarding(
  sb: SupabaseClient,
  userId: string,
  tradeId: string,
): Promise<
  | {
      ok: true;
      recipient: string;
      ndaSignUrl: string;
      loiSignUrl: string;
      portalUrl: string;
      emailed: boolean;
    }
  | { ok: false; error: string }
> {
  try {
    const { sendSupplierOnboarding } = await import("@/lib/supplierOnboarding.functions");
    // Server fns exponen `.handler(...)` server-side; llamar directo dispararía
    // el pipeline RPC. Usamos un import dinámico y reejecutamos el helper interno
    // vía la propia función pública, que en modo server acepta invocación directa.
    const r = (await (sendSupplierOnboarding as unknown as (i: unknown) => Promise<unknown>)({
      data: { tradeId },
    })) as {
      emailed: boolean;
      recipient: string;
      nda: { signUrl: string };
      loi: { signUrl: string };
      portalUrl: string;
    };
    return {
      ok: true,
      recipient: r.recipient,
      ndaSignUrl: r.nda.signUrl,
      loiSignUrl: r.loi.signUrl,
      portalUrl: r.portalUrl,
      emailed: r.emailed,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
