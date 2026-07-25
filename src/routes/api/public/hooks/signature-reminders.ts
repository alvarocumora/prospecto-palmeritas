import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { sendInternalEmail } from "@/lib/email/send-internal.server";
import { publicUrl } from "@/lib/publicUrl";
import { OWN_COMPANY } from "@/lib/documents/company";

// Recordatorios automáticos de firma para operaciones GeoCapitals.
// Cron: recorre firmantes pendientes de sobres vigentes y les reenvía el link
// si no han firmado y ha pasado suficiente tiempo desde el último recordatorio.
//
// Cadencia por sobre (basada en horas restantes hasta expires_at):
//   > 7 días: recordatorio cada 72h
//   48h – 7d: recordatorio cada 24h
//   ≤ 48h:    recordatorio cada 8h (urgencia)
// Máximo 6 recordatorios por firmante para no ser abusivo.

export const Route = createFileRoute("/api/public/hooks/signature-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const url = import.meta.env.VITE_SUPABASE_URL as string;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
        if (!url || !key) {
          return new Response(
            JSON.stringify({ ok: false, error: "missing_env" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        const sb = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const nowIso = new Date().toISOString();

        // 1) Sobres vigentes de operaciones aún pendientes
        const { data: envelopes, error: envErr } = await sb
          .from("signature_envelopes")
          .select(
            "id, operation_id, document_title, expires_at, status, metadata",
          )
          .eq("status", "pending")
          .not("operation_id", "is", null)
          .not("expires_at", "is", null)
          .gt("expires_at", nowIso);
        if (envErr) {
          return new Response(
            JSON.stringify({ ok: false, error: envErr.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        if (!envelopes || envelopes.length === 0) {
          return new Response(
            JSON.stringify({ ok: true, envelopes: 0, sent: 0 }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        const opIds = Array.from(
          new Set(envelopes.map((e) => e.operation_id).filter(Boolean)),
        ) as string[];
        const { data: ops } = await sb
          .from("operations")
          .select("id, code, name, commodity")
          .in("id", opIds);
        const opsById = new Map((ops ?? []).map((o) => [o.id, o]));

        const envIds = envelopes.map((e) => e.id);
        const { data: signers, error: sigErr } = await sb
          .from("document_signatures")
          .select(
            "id, envelope_id, signer_name, signer_email, access_token, status, reminder_count, last_reminder_at, emailed_at",
          )
          .in("envelope_id", envIds)
          .eq("status", "pending")
          .not("signer_email", "is", null)
          .not("access_token", "is", null);
        if (sigErr) {
          return new Response(
            JSON.stringify({ ok: false, error: sigErr.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const envById = new Map(envelopes.map((e) => [e.id, e]));
        const now = Date.now();
        const MAX_REMINDERS = 6;
        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (const s of signers ?? []) {
          const env = envById.get(s.envelope_id);
          if (!env?.expires_at) continue;
          const expiresMs = new Date(env.expires_at).getTime();
          const hoursRemaining = Math.max(
            0,
            Math.round((expiresMs - now) / 3_600_000),
          );
          const cadenceHours =
            hoursRemaining <= 48 ? 8 : hoursRemaining <= 24 * 7 ? 24 : 72;
          const lastAt = s.last_reminder_at ?? s.emailed_at;
          const hoursSinceLast = lastAt
            ? (now - new Date(lastAt).getTime()) / 3_600_000
            : Infinity;
          if ((s.reminder_count ?? 0) >= MAX_REMINDERS) {
            skipped++;
            continue;
          }
          if (hoursSinceLast < cadenceHours) {
            skipped++;
            continue;
          }

          const op = env.operation_id ? opsById.get(env.operation_id) : null;
          const signUrl = publicUrl(
            `/firmar/operacion/${encodeURIComponent(s.access_token!)}`,
          );
          const reminderNumber = (s.reminder_count ?? 0) + 1;
          const expiresAtLabel = new Date(env.expires_at).toLocaleDateString(
            "es-CL",
            { day: "numeric", month: "long", year: "numeric" },
          );

          try {
            const res = await sendInternalEmail({
              templateName: "sign-reminder-signer",
              recipientEmail: s.signer_email!,
              idempotencyKey: `op-sign-reminder:${s.id}:${reminderNumber}`,
              templateData: {
                docTitle: op
                  ? `${env.document_title} — ${op.code} · ${op.name}`
                  : env.document_title,
                reference: op?.code ?? env.document_title,
                senderCompany: OWN_COMPANY.name,
                signerName: s.signer_name,
                expiresAt: expiresAtLabel,
                hoursRemaining,
                reminderNumber,
                signUrl,
              },
            });
            if (res.ok) {
              await sb
                .from("document_signatures")
                .update({
                  reminder_count: reminderNumber,
                  last_reminder_at: new Date().toISOString(),
                })
                .eq("id", s.id);
              if (env.operation_id) {
                await sb.from("operation_access_logs").insert({
                  operation_id: env.operation_id,
                  event: "signature_reminder_sent",
                  metadata: {
                    signer_id: s.id,
                    envelope_id: env.id,
                    reminder_number: reminderNumber,
                    hours_remaining: hoursRemaining,
                  },
                } as never);
              }
              sent++;
            } else {
              failed++;
            }
          } catch (e) {
            failed++;
            console.error("[signature-reminders] failed", s.id, e);
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            envelopes: envelopes.length,
            signers: (signers ?? []).length,
            sent,
            skipped,
            failed,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
