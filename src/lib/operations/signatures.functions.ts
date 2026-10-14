import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAnyModuleRole } from "@/lib/access/roleMiddleware";
import { publicUrl } from "@/lib/publicUrl";
import { requireOperationManager } from "./access.server";

// ---------------------------------------------------------------------------
// Firma electrónica sobre operaciones — versiones inmutables.
//
// Modelo:
//  · Se firma un `operation_documents` que está `is_frozen=true` (versión N).
//  · `signature_envelopes` guarda operation_id + operation_document_id + hash.
//  · Cada firmante tiene una fila en `document_signatures` con `access_token`
//    (link tokenizado /firmar/operacion/$token).
//  · Al firmar el último, el envelope pasa a `completed` y se apunta la
//    versión firmada (opcional: subida como hijo `is_frozen=true`).
// ---------------------------------------------------------------------------

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const TEMPLATES = ["NDA", "NCNDA", "LOI", "SPA", "MOU", "OTRO"] as const;

const signerSchema = z.object({
  role: z.enum(["buyer", "seller", "geocapitals", "advisor", "witness"]),
  name: z.string().min(2).max(160),
  email: z.string().email().max(160).optional(),
  order: z.number().int().min(1).max(10),
});

const createSchema = z.object({
  operation_id: z.string().uuid(),
  document_id: z.string().uuid(),
  template: z.enum(TEMPLATES),
  title: z.string().min(2).max(200).optional(),
  expires_in_days: z.number().int().min(1).max(60).default(14),
  signers: z.array(signerSchema).min(1).max(8),
});

/**
 * Crea el flujo de firma sobre un `operation_documents`.
 * Si el documento no está frozen, lo congela en la misma transacción lógica.
 * Emite email individual con link /firmar/operacion/$token por firmante.
 */
export const createOperationSignatureFlow = createServerFn({ method: "POST" })
  .middleware([requireAnyModuleRole])
  .inputValidator((raw: unknown) => createSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const sb = await admin();

    // 1) Verificar permiso de gestión antes de congelar documentos o crear sobres.
    await requireOperationManager(sb, data.operation_id, context.userId);
    const { data: op } = await sb
      .from("operations")
      .select("id, code, name, commodity")
      .eq("id", data.operation_id)
      .maybeSingle();
    if (!op) throw new Error("Operación no encontrada");

    // 2) Documento operacional → obligatorio y congelable
    const { data: doc } = await sb
      .from("operation_documents")
      .select("id, operation_id, title, sha256, storage_path, is_frozen, version, kind")
      .eq("id", data.document_id)
      .maybeSingle();
    if (!doc) throw new Error("Documento no encontrado");
    if (doc.operation_id !== data.operation_id)
      throw new Error("Documento no pertenece a la operación");
    if (!doc.sha256 || !doc.storage_path) throw new Error("Documento sin archivo o hash");

    if (!doc.is_frozen) {
      const { error: fErr } = await sb
        .from("operation_documents")
        .update({ is_frozen: true, frozen_at: new Date().toISOString() })
        .eq("id", doc.id);
      if (fErr) throw new Error(`No se pudo congelar el documento: ${fErr.message}`);
    }

    // 3) Idempotencia: evitar 2 envelopes activos sobre la misma versión + plantilla
    const { data: existing } = await sb
      .from("signature_envelopes")
      .select("id, status")
      .eq("operation_document_id", doc.id)
      .eq("document_type", `operation_${data.template.toLowerCase()}`)
      .in("status", ["pending", "in_progress"])
      .maybeSingle();
    if (existing)
      throw new Error("Ya existe un flujo de firma activo para este documento y plantilla");

    // 4) Crear envelope
    const expiresAt = new Date(Date.now() + data.expires_in_days * 86_400_000).toISOString();
    const { data: env, error: envErr } = await sb
      .from("signature_envelopes")
      .insert({
        operation_id: op.id,
        operation_document_id: doc.id,
        document_type: `operation_${data.template.toLowerCase()}`,
        document_ref_id: doc.id,
        document_title: data.title ?? `${data.template} — ${op.code} · ${op.name}`,
        document_hash: doc.sha256,
        document_storage_path: doc.storage_path,
        status: "pending",
        required_signers: data.signers.length,
        completed_signers: 0,
        expires_at: expiresAt,
        created_by: context.userId as string,
        project_id: null,
        metadata: {
          template: data.template,
          operation_code: op.code,
          document_version: doc.version,
          document_kind: doc.kind,
        } as never,
      })
      .select("id")
      .single();
    if (envErr) throw new Error(envErr.message);

    // 5) Insertar firmantes con access_token (trigger DB genera token)
    const sortedSigners = [...data.signers].sort((a, b) => a.order - b.order);
    const rows = sortedSigners.map((s, i) => ({
      envelope_id: env.id,
      project_id: null as unknown as string,
      signer_user_id: null,
      signer_name: s.name,
      signer_email: s.email ?? null,
      signer_role: s.role,
      signing_order: s.order ?? i + 1,
      status: "pending",
    }));
    const { data: sigRows, error: sigErr } = await sb
      .from("document_signatures")
      .insert(rows as never)
      .select("id, access_token, signer_email, signer_name, signing_order");
    if (sigErr) {
      // rollback envelope si fallan las firmas
      await sb.from("signature_envelopes").delete().eq("id", env.id);
      throw new Error(`No se pudieron crear firmantes: ${sigErr.message}`);
    }

    // 6) Enviar email de invitación a cada firmante (best-effort)
    try {
      const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
      const { OWN_COMPANY } = await import("@/lib/documents/company");
      for (const r of sigRows as Array<{
        id: string;
        access_token: string;
        signer_email: string | null;
        signer_name: string;
      }>) {
        if (!r.signer_email) continue;
        const signUrl = publicUrl(`/firmar/operacion/${encodeURIComponent(r.access_token)}`);
        try {
          const res = await sendInternalEmail({
            templateName: "sign-request-signer",
            recipientEmail: r.signer_email,
            idempotencyKey: `op-sign:${env.id}:${r.id}`,
            templateData: {
              docTitle: `${data.template} — ${op.code} · ${op.name}`,
              reference: op.code,
              senderCompany: OWN_COMPANY.name,
              signerName: r.signer_name,
              expiresAt: new Date(expiresAt).toLocaleDateString("es-CL", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
              signUrl,
            },
          });
          if (res.ok) {
            await sb
              .from("document_signatures")
              .update({ emailed_at: new Date().toISOString() })
              .eq("id", r.id);
          }
        } catch (e) {
          console.error("[createOperationSignatureFlow] signer email failed", r.id, e);
        }
      }
    } catch (e) {
      console.error("[createOperationSignatureFlow] email module load failed", e);
    }

    // 7) Log en la operación
    await sb.from("operation_access_logs").insert({
      operation_id: op.id,
      actor_user_id: context.userId,
      actor_role: "geocapitals",
      action: "signature_flow_created",
      metadata: {
        envelope_id: env.id,
        document_id: doc.id,
        template: data.template,
        signers: sortedSigners.length,
      } as never,
    });

    return { ok: true, envelope_id: env.id };
  });

/** Lista los flujos de firma de una operación. */
export const listOperationSignatureFlows = createServerFn({ method: "POST" })
  .middleware([requireAnyModuleRole])
  .inputValidator((raw: unknown) => z.object({ operation_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    // La respuesta incluye tokens de firma: lectura de participante no basta.
    await requireOperationManager(sb, data.operation_id, context.userId);

    const { data: envelopes } = await sb
      .from("signature_envelopes")
      .select(
        "id, document_type, document_title, document_hash, status, required_signers, completed_signers, expires_at, created_at, completed_at, operation_document_id, signed_document_id, metadata",
      )
      .eq("operation_id", data.operation_id)
      .order("created_at", { ascending: false });

    const envIds = (envelopes ?? []).map((e) => e.id);
    const { data: signatures } = envIds.length
      ? await sb
          .from("document_signatures")
          .select(
            "id, envelope_id, signer_name, signer_email, signer_role, signing_order, status, signed_at, access_token, emailed_at",
          )
          .in("envelope_id", envIds)
          .order("signing_order", { ascending: true })
      : { data: [] as Array<Record<string, unknown>> };

    const byEnv = new Map<string, Array<Record<string, unknown>>>();
    for (const s of signatures ?? []) {
      const list = byEnv.get(String(s.envelope_id)) ?? [];
      list.push(s);
      byEnv.set(String(s.envelope_id), list);
    }
    return (envelopes ?? []).map((e) => ({
      ...e,
      signers: (byEnv.get(e.id) ?? []).map((s) => ({
        id: String(s.id),
        signer_name: String(s.signer_name ?? ""),
        signer_email: (s.signer_email ?? null) as string | null,
        signer_role: String(s.signer_role ?? ""),
        signing_order: Number(s.signing_order ?? 1),
        status: String(s.status ?? "pending"),
        signed_at: (s.signed_at ?? null) as string | null,
        sign_url: publicUrl(
          `/firmar/operacion/${encodeURIComponent(String(s.access_token ?? ""))}`,
        ),
        emailed_at: (s.emailed_at ?? null) as string | null,
      })),
    }));
  });

/** Página pública: obtiene contexto de firma por access_token. */
export const getOperationSignatureRequest = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ token: z.string().min(10) }).parse(raw))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: sig } = await sb
      .from("document_signatures")
      .select(
        "id, envelope_id, signer_name, signer_email, signer_role, signing_order, status, signed_at",
      )
      .eq("access_token", data.token)
      .maybeSingle();
    if (!sig) throw new Error("Enlace inválido o revocado");

    const { data: env } = await sb
      .from("signature_envelopes")
      .select(
        "id, operation_id, operation_document_id, signed_document_id, document_title, document_hash, status, required_signers, completed_signers, expires_at, metadata",
      )
      .eq("id", sig.envelope_id)
      .maybeSingle();
    if (!env) throw new Error("Sobre no encontrado");

    const { data: op } = await sb
      .from("operations")
      .select("code, name, commodity, incoterm")
      .eq("id", env.operation_id!)
      .maybeSingle();

    const signUrl = async (id: string | null | undefined) => {
      if (!id) return null;
      const { data: doc } = await sb
        .from("operation_documents")
        .select("storage_bucket, storage_path")
        .eq("id", id)
        .maybeSingle();
      if (!doc?.storage_path) return null;
      const { data: signed } = await sb.storage
        .from(doc.storage_bucket)
        .createSignedUrl(doc.storage_path, 300);
      return signed?.signedUrl ?? null;
    };

    const pdfUrl = await signUrl(env.operation_document_id);
    const signedPdfUrl = await signUrl(
      (env as { signed_document_id?: string | null }).signed_document_id,
    );

    // Estado agregado de otros firmantes (para mostrar en UI)
    const { data: others } = await sb
      .from("document_signatures")
      .select("signer_name, signer_role, signing_order, status, signed_at")
      .eq("envelope_id", env.id)
      .order("signing_order", { ascending: true });

    return {
      signer: {
        id: sig.id,
        name: sig.signer_name,
        role: sig.signer_role,
        order: sig.signing_order,
        status: sig.status,
        signed_at: sig.signed_at,
      },
      envelope: {
        id: env.id,
        title: env.document_title,
        hash: env.document_hash,
        status: env.status,
        required: env.required_signers,
        completed: env.completed_signers,
        expires_at: env.expires_at,
        metadata: (env.metadata ?? {}) as Record<string, string | number | boolean | null>,
      },
      operation: op ?? null,
      pdf_url: pdfUrl,
      signed_pdf_url: signedPdfUrl,
      signers: others ?? [],
    };
  });

/** Página pública: registra firma electrónica del participante. */
export const submitOperationSignature = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        token: z.string().min(10),
        signer_name: z.string().min(3).max(160),
        accepted: z.literal(true),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const sb = await admin();

    const { data: sig } = await sb
      .from("document_signatures")
      .select("id, envelope_id, status, signing_order, signer_name")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!sig) throw new Error("Enlace inválido");
    if (sig.status === "signed") throw new Error("Ya firmaste este documento");

    const { data: env } = await sb
      .from("signature_envelopes")
      .select(
        "id, document_hash, required_signers, completed_signers, status, expires_at, operation_id, operation_document_id",
      )
      .eq("id", sig.envelope_id)
      .maybeSingle();
    if (!env) throw new Error("Sobre no encontrado");
    if (env.status === "completed" || env.status === "void") {
      throw new Error("Este flujo de firma ya no acepta firmas");
    }
    if (new Date(env.expires_at ?? Date.now()) < new Date()) {
      throw new Error("El enlace de firma ha expirado");
    }

    const signedAt = new Date().toISOString();
    // HMAC minimalista: sha256(envelope_hash | signer_id | signer_name | signedAt)
    const enc = new TextEncoder();
    const payload = enc.encode(`${env.document_hash}|${sig.id}|${data.signer_name}|${signedAt}`);
    const hashBuf = await crypto.subtle.digest("SHA-256", payload);
    const signatureHmac = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { error: upErr } = await sb
      .from("document_signatures")
      .update({
        status: "signed",
        signed_at: signedAt,
        signer_name: data.signer_name,
        signature_hmac: signatureHmac,
        signed_document_hash: env.document_hash,
      })
      .eq("id", sig.id);
    if (upErr) throw new Error(upErr.message);

    // Actualiza el contador del envelope
    const newCompleted = (env.completed_signers ?? 0) + 1;
    const isDone = newCompleted >= (env.required_signers ?? 1);
    await sb
      .from("signature_envelopes")
      .update({
        completed_signers: newCompleted,
        status: isDone ? "completed" : "in_progress",
        completed_at: isDone ? signedAt : null,
      })
      .eq("id", env.id);

    // Log en la operación
    if (env.operation_id) {
      await sb.from("operation_access_logs").insert({
        operation_id: env.operation_id,
        actor_user_id: null,
        actor_role: sig.signer_name && sig.signing_order === 1 ? "buyer" : "seller",
        action: isDone ? "signature_flow_completed" : "signature_submitted",
        metadata: {
          envelope_id: env.id,
          signature_id: sig.id,
          signer_name: data.signer_name,
          signing_order: sig.signing_order,
          hmac: signatureHmac,
        } as never,
      });
    }

    return { ok: true, completed: isDone, signature_hmac: signatureHmac };
  });

/** Revoca un envelope (staff). Todas las firmas pendientes quedan invalidadas. */
export const voidOperationSignatureFlow = createServerFn({ method: "POST" })
  .middleware([requireAnyModuleRole])
  .inputValidator((raw: unknown) =>
    z.object({ envelope_id: z.string().uuid(), reason: z.string().max(400).optional() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: env } = await sb
      .from("signature_envelopes")
      .select("id, operation_id, status")
      .eq("id", data.envelope_id)
      .maybeSingle();
    if (!env) throw new Error("Sobre no encontrado");
    await requireOperationManager(sb, env.operation_id, context.userId);
    if (env.status === "completed") throw new Error("El flujo ya está completado");

    await sb.from("signature_envelopes").update({ status: "void" }).eq("id", data.envelope_id);
    await sb
      .from("document_signatures")
      .update({ status: "rejected", rejection_reason: data.reason ?? "envelope anulado" })
      .eq("envelope_id", data.envelope_id)
      .eq("status", "pending");

    if (env.operation_id) {
      await sb.from("operation_access_logs").insert({
        operation_id: env.operation_id,
        actor_user_id: context.userId,
        actor_role: "geocapitals",
        action: "signature_flow_voided",
        metadata: { envelope_id: env.id, reason: data.reason ?? null } as never,
      });
    }

    return { ok: true };
  });
