// sign-envelope: motor de firma digital interna (HMAC-SHA256)
// Acciones:
//  POST { action: "create", project_id, document_type, document_title,
//         document_hash, document_ref_id?, signers: [{ user_id, name, role, email?, order? }] }
//    → crea envelope + filas pending en document_signatures
//  POST { action: "sign", envelope_id, rejection_reason? }
//    → firma como usuario auth actual (HMAC = sha256(secret + envelope.document_hash + signer_user_id + iso_now))
//  POST { action: "reject", envelope_id, rejection_reason }
//    → marca firma como rechazada
//
// Seguridad: requiere JWT válido. El secreto HMAC se deriva del SUPABASE_SERVICE_ROLE_KEY
// concatenado con un sufijo estático (no exporta la clave; solo se usa server-side).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(message: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResp({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return jsonResp({ error: "unauthorized" }, 401);
  const user = userRes.user;

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResp({ error: "invalid_json" }, 400);
  }
  const action = payload.action as string | undefined;

  // Secreto HMAC server-side (no se expone)
  const hmacSecret = `geocapitals-sign-v1::${service.slice(0, 24)}`;

  try {
    if (action === "create") {
      const project_id = payload.project_id as string;
      const document_type = payload.document_type as string;
      const document_title = payload.document_title as string;
      const document_hash = payload.document_hash as string;
      const document_ref_id = (payload.document_ref_id as string | null) ?? null;
      const signers = (payload.signers as Array<{
        user_id: string; name: string; role: string; email?: string; order?: number;
      }>) ?? [];
      if (!project_id || !document_type || !document_title || !document_hash || signers.length === 0) {
        return jsonResp({ error: "missing_fields" }, 400);
      }

      const { data: env, error: envErr } = await admin
        .from("signature_envelopes")
        .insert({
          project_id,
          document_type,
          document_title,
          document_hash,
          document_ref_id,
          required_signers: signers.length,
          completed_signers: 0,
          status: "pending",
          created_by: user.id,
        })
        .select()
        .single();
      if (envErr || !env) return jsonResp({ error: envErr?.message ?? "create_failed" }, 500);

      const sigRows = signers.map((s, i) => ({
        envelope_id: env.id,
        project_id,
        signer_user_id: s.user_id,
        signer_name: s.name,
        signer_email: s.email ?? null,
        signer_role: s.role,
        signing_order: s.order ?? i + 1,
        status: "pending",
      }));
      const { error: sigErr } = await admin.from("document_signatures").insert(sigRows);
      if (sigErr) return jsonResp({ error: sigErr.message }, 500);

      await admin.from("signature_audit_trail").insert({
        envelope_id: env.id,
        project_id,
        action: "created",
        actor_user_id: user.id,
        actor_name: user.email ?? "system",
        payload: { signers: signers.length, document_type, document_hash },
      });
      return jsonResp({ ok: true, envelope: env });
    }

    if (action === "sign") {
      const envelope_id = payload.envelope_id as string;
      if (!envelope_id) return jsonResp({ error: "missing_envelope_id" }, 400);

      const { data: env, error: envErr } = await admin
        .from("signature_envelopes")
        .select("*")
        .eq("id", envelope_id)
        .maybeSingle();
      if (envErr || !env) return jsonResp({ error: "envelope_not_found" }, 404);

      const { data: sigRow, error: sigErr } = await admin
        .from("document_signatures")
        .select("*")
        .eq("envelope_id", envelope_id)
        .eq("signer_user_id", user.id)
        .maybeSingle();
      if (sigErr || !sigRow) return jsonResp({ error: "not_a_signer" }, 403);
      if (sigRow.status === "signed") return jsonResp({ error: "already_signed" }, 409);

      const ts = new Date().toISOString();
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const ua = req.headers.get("user-agent") ?? null;
      const message = `${env.document_hash}|${user.id}|${sigRow.signer_role}|${ts}`;
      const hmac = await hmacSha256Hex(hmacSecret, message);
      const signedDocHash = await sha256Hex(`${env.document_hash}|${hmac}`);

      const { error: upErr } = await admin
        .from("document_signatures")
        .update({
          status: "signed",
          signed_at: ts,
          signature_hmac: hmac,
          signed_document_hash: signedDocHash,
          ip_address: ip,
          user_agent: ua,
        })
        .eq("id", sigRow.id);
      if (upErr) return jsonResp({ error: upErr.message }, 500);

      return jsonResp({ ok: true, hmac, signed_document_hash: signedDocHash, signed_at: ts });
    }

    if (action === "reject") {
      const envelope_id = payload.envelope_id as string;
      const reason = (payload.rejection_reason as string) ?? "Sin razón especificada";
      const { data: sigRow } = await admin
        .from("document_signatures")
        .select("id")
        .eq("envelope_id", envelope_id)
        .eq("signer_user_id", user.id)
        .maybeSingle();
      if (!sigRow) return jsonResp({ error: "not_a_signer" }, 403);
      const { error } = await admin
        .from("document_signatures")
        .update({ status: "rejected", rejection_reason: reason })
        .eq("id", sigRow.id);
      if (error) return jsonResp({ error: error.message }, 500);
      return jsonResp({ ok: true });
    }

    return jsonResp({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[sign-envelope]", e);
    return jsonResp({ error: (e as Error).message }, 500);
  }
});
