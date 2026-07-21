import * as React from "react";
import { render as renderAsync } from "@react-email/components";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TEMPLATES, type TemplateEntry } from "@/lib/email-templates/registry";

const SITE_NAME = "Geocapitals";
const SENDER_DOMAIN = "notify.geocapitals.com";
const FROM_DOMAIN = "notify.geocapitals.com";

function getAdmin(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !key) throw new Error("Missing Supabase server env vars");
  return createClient(url, key);
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function ensureUnsubscribeToken(admin: SupabaseClient, email: string): Promise<string> {
  const { data: existing } = await admin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", email)
    .maybeSingle();
  if (existing?.token && !existing.used_at) return existing.token;
  const token = generateToken();
  await admin.from("email_unsubscribe_tokens").upsert({ email, token }, { onConflict: "email" });
  const { data: stored } = await admin
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", email)
    .maybeSingle();
  return stored?.token ?? token;
}

interface SendArgs {
  templateName: string;
  recipientEmail: string;
  templateData?: Record<string, unknown>;
  idempotencyKey?: string;
}

/**
 * Server-only helper to enqueue a transactional email using service role.
 * Use from cron routes, server functions, or trusted server-side callers.
 * Skips already-sent (idempotencyKey) and suppressed addresses.
 */
export async function sendInternalEmail(
  args: SendArgs,
): Promise<
  | { ok: true; messageId: string; queued: true }
  | { ok: true; queued: false; reason: string }
  | { ok: false; error: string }
> {
  const { templateName, recipientEmail } = args;
  const templateData = args.templateData ?? {};
  const idempotencyKey = args.idempotencyKey ?? `${templateName}:${recipientEmail}`;
  const email = recipientEmail.trim().toLowerCase();
  const template: TemplateEntry | undefined = TEMPLATES[templateName];
  if (!template) return { ok: false, error: `Template '${templateName}' not registered` };

  const admin = getAdmin();

  // Idempotency: skip if already logged for this key
  const { data: prior } = await admin
    .from("email_send_log")
    .select("id, status")
    .contains("metadata", { idempotency_key: idempotencyKey })
    .in("status", ["pending", "sent"])
    .limit(1);
  if (prior && prior.length > 0) {
    return { ok: true, queued: false, reason: "duplicate" };
  }

  // Suppression check
  const { data: suppressed } = await admin
    .from("suppressed_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  if (suppressed) return { ok: true, queued: false, reason: "suppressed" };

  const unsubscribeToken = await ensureUnsubscribeToken(admin, email);

  const messageId = crypto.randomUUID();
  const trackingPixelUrl = `https://geocapitals.com/api/public/email/pixel/${messageId}.gif`;

  const mergedData = { ...templateData, trackingPixelUrl, messageId };
  const element = React.createElement(template.component, mergedData as never);
  const html = await renderAsync(element);
  const text = await renderAsync(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(mergedData) : template.subject;

  await admin.from("email_send_log").insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: email,
    status: "pending",
    metadata: { idempotency_key: idempotencyKey, source: "internal" },
  });

  const { error } = await admin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: email,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });

  if (error) {
    await admin.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: email,
      status: "failed",
      error_message: `enqueue: ${error.message}`,
    });
    return { ok: false, error: error.message };
  }

  return { ok: true, messageId, queued: true };
}
