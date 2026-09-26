import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicUrl } from "@/lib/publicUrl";

// Despacho ejecutivo del trade de Cobre (Electrolytic Copper Cathode Grade A).
// Genera el PDF oficial "Purchase Terms" firmado por Geocapitals, lo sube a
// storage con URL firmada y lo adjunta al correo enviado a cada destinatario.
// Devuelve un reporte por destinatario. No lanza si un envío individual falla.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export const dispatchCopperPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tradeId: z.string().uuid().optional(),
        recipients: z
          .array(
            z.object({
              name: z.string().min(1),
              company: z.string().optional(),
              email: z.string().email(),
              role: z.enum(["buyer", "seller"]).default("buyer"),
            }),
          )
          .min(1)
          .optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);

    // Localiza el trade de cobre (por id o por referencia CU-CATHODE-*).
    let tradeId = data.tradeId ?? null;
    let reference = "CU-CATHODE";
    let counterpartyEmail: string | null = null;
    let counterpartyName: string | null = null;
    let counterpartyCompany: string | null = null;

    if (!tradeId) {
      const { data: t } = await sb
        .from("commodity_trades")
        .select("id, reference, counterparty_email, counterparty_name, counterparty_company")
        .ilike("reference", "CU-CATHODE%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (t) {
        const row = t as {
          id: string;
          reference: string;
          counterparty_email: string | null;
          counterparty_name: string | null;
          counterparty_company: string | null;
        };
        tradeId = row.id;
        reference = row.reference ?? reference;
        counterpartyEmail = row.counterparty_email;
        counterpartyName = row.counterparty_name;
        counterpartyCompany = row.counterparty_company;
      }
    } else {
      const { data: t } = await sb
        .from("commodity_trades")
        .select("reference, counterparty_email, counterparty_name, counterparty_company")
        .eq("id", tradeId)
        .maybeSingle();
      if (t) {
        const row = t as {
          reference: string;
          counterparty_email: string | null;
          counterparty_name: string | null;
          counterparty_company: string | null;
        };
        reference = row.reference ?? reference;
        counterpartyEmail = row.counterparty_email;
        counterpartyName = row.counterparty_name;
        counterpartyCompany = row.counterparty_company;
      }
    }

    // Si no hay recipients explícitos, usa la contraparte del trade.
    const recipients =
      data.recipients ??
      (counterpartyEmail
        ? [
            {
              name: counterpartyName ?? "Contraparte",
              company: counterpartyCompany ?? undefined,
              email: counterpartyEmail,
              role: "buyer" as const,
            },
          ]
        : []);

    if (recipients.length === 0) {
      return {
        tradeId,
        reference,
        results: [] as Array<{ to: string; kind: string; ok: boolean; reason?: string }>,
        error: "Sin destinatarios: agrega contraparte al trade o pásala en recipients.",
      };
    }

    const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
    const { buildCopperSheetPdf, uploadPdfSigned } =
      await import("@/lib/documents/officialPdfs.server");
    const operationUrl = tradeId ? publicUrl(`/operacion/${tradeId}`) : undefined;
    const results: Array<{ to: string; kind: string; ok: boolean; reason?: string }> = [];

    for (const r of recipients) {
      let sheetPdfUrl: string | undefined;
      try {
        const bytes = await buildCopperSheetPdf({
          reference: `SHEET-${reference}`,
          recipient: { role: r.role, name: r.name, company: r.company, email: r.email },
        });
        sheetPdfUrl = await uploadPdfSigned({
          bytes,
          path: `copper/${tradeId ?? "n-a"}/sheet-${Date.now()}-${r.email.replace(/[^a-z0-9]/gi, "_")}.pdf`,
          ttlDays: 60,
        });
      } catch (e) {
        console.error("[copper] pdf attach failed", e);
      }

      try {
        const res = await sendInternalEmail({
          templateName: "copper-product-sheet",
          recipientEmail: r.email,
          idempotencyKey: `copper-sheet:${tradeId ?? "n/a"}:${r.email}`,
          templateData: {
            recipientName: r.name,
            recipientCompany: r.company,
            tradeReference: reference,
            senderCompany: "Geocapitals",
            operationUrl,
            sheetPdfUrl,
          },
        });
        results.push({
          to: r.email,
          kind: "copper-product-sheet",
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
          to: r.email,
          kind: "copper-product-sheet",
          ok: false,
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (tradeId) {
      try {
        await sb.from("trade_events").insert({
          trade_id: tradeId,
          kind: "copper_package_dispatched",
          actor_user_id: context.userId,
          detail: JSON.stringify({ results }),
        });
      } catch {
        // no bloquea
      }
    }

    return { tradeId, reference, results };
  });
