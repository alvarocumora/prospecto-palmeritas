import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Operation Documents — subida, revisión, congelamiento y descarga firmada.
// Segregación por rol (buyer_shared / seller_shared / internal / all_parties)
// y bucket privado `operation-docs`. Portales externos pasan por `token`.
// ---------------------------------------------------------------------------

const BUCKET = "operation-docs";
const MAX_BYTES = 15 * 1024 * 1024; // 15MB

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Role = "buyer" | "seller" | "geocapitals";
type Visibility = "internal" | "buyer_shared" | "seller_shared" | "all_parties";

async function validatePortalToken(token: string, role: "buyer" | "seller") {
  const sb = await admin();
  const { data } = await sb
    .from("operation_invitations")
    .select("id, operation_id, participant_type, status, expires_at, revoked_at, invited_email, invited_name")
    .eq("secure_token", token)
    .maybeSingle();
  if (!data) throw new Error("Enlace inválido");
  if (data.participant_type !== role) throw new Error("Enlace no corresponde a este portal");
  if (data.revoked_at || data.status === "revoked") throw new Error("El enlace fue revocado");
  if (new Date(data.expires_at) < new Date()) throw new Error("El enlace ha expirado");
  return data as { id: string; operation_id: string; invited_email: string; invited_name: string | null };
}

function sanitizeFilename(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

const uploadSchema = z.object({
  operation_id: z.string().uuid().optional(),
  token: z.string().min(10).optional(),
  role: z.enum(["buyer", "seller", "geocapitals"]),
  kind: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  visibility: z.enum(["internal", "buyer_shared", "seller_shared", "all_parties"]).optional(),
  filename: z.string().min(1),
  content_type: z.string().min(1),
  content_base64: z.string().min(4),
});

async function computeSha256(bytes: Uint8Array): Promise<string> {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const buf = await crypto.subtle.digest("SHA-256", ab);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Sube un documento a la operación. Portal externo → token; staff/participante → auth. */
export const uploadOperationDocument = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => uploadSchema.parse(raw))
  .handler(async ({ data }) => {
    const sb = await admin();

    let operationId = data.operation_id;
    let uploaderId: string | null = null;
    let uploaderRole: Role = data.role;

    if (data.token) {
      if (data.role === "geocapitals") throw new Error("Rol no válido para portal externo");
      const inv = await validatePortalToken(data.token, data.role);
      operationId = inv.operation_id;
      // Portal público — sin user necesariamente
      const { requireSupabaseAuthDirect } = await import("./portal.helpers.server");
      try {
        const auth = await requireSupabaseAuthDirect();
        uploaderId = auth.userId;
      } catch {
        uploaderId = null;
      }
    } else {
      const { requireSupabaseAuthDirect } = await import("./portal.helpers.server");
      const auth = await requireSupabaseAuthDirect();
      uploaderId = auth.userId;
    }

    if (!operationId) throw new Error("Operación no especificada");

    // Decodifica base64
    const b64 = data.content_base64.replace(/^data:[^;]+;base64,/, "");
    const bin = atob(b64);
    if (bin.length > MAX_BYTES) throw new Error(`Archivo excede ${MAX_BYTES / 1024 / 1024}MB`);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const sha256 = await computeSha256(bytes);
    const safeName = sanitizeFilename(data.filename);
    const path = `${operationId}/${uploaderRole}/${Date.now()}_${safeName}`;

    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, {
      contentType: data.content_type,
      upsert: false,
    });
    if (upErr) throw new Error(`No se pudo subir: ${upErr.message}`);

    // Visibility siempre está segregada por rol del uploader:
    // - buyer/seller (portal externo) → solo su carpeta compartida con Geocapitals,
    //   no pueden elegir "internal" ni la carpeta del rol contrario.
    // - geocapitals (staff) → puede definir cualquier visibilidad.
    let visibility: Visibility;
    if (uploaderRole === "buyer") visibility = "buyer_shared";
    else if (uploaderRole === "seller") visibility = "seller_shared";
    else visibility = data.visibility ?? "all_parties";


    const { data: doc, error: docErr } = await sb
      .from("operation_documents")
      .insert({
        operation_id: operationId,
        kind: data.kind,
        title: data.title,
        description: data.description ?? null,
        storage_bucket: BUCKET,
        storage_path: path,
        file_size: bytes.length,
        content_type: data.content_type,
        sha256,
        version: 1,
        visibility,
        uploaded_by_role: uploaderRole,
        uploaded_by: uploaderId,
        review_status: "pending",
      })
      .select()
      .single();
    if (docErr) throw docErr;

    await sb.from("operation_access_logs").insert({
      operation_id: operationId,
      actor_user_id: uploaderId,
      actor_role: uploaderRole,
      action: "document_uploaded",
      metadata: { document_id: doc.id, kind: data.kind, sha256 } as never,
    });

    return { ok: true, id: doc.id, sha256 };
  });

/** Devuelve URL firmada temporal de descarga (60s). Portal usa token. */
export const getOperationDocumentUrl = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        document_id: z.string().uuid(),
        token: z.string().min(10).optional(),
        role: z.enum(["buyer", "seller"]).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: doc } = await sb
      .from("operation_documents")
      .select("id, operation_id, storage_path, storage_bucket, visibility")
      .eq("id", data.document_id)
      .maybeSingle();
    if (!doc || !doc.storage_path) throw new Error("Documento no disponible");

    if (data.token) {
      if (!data.role) throw new Error("Rol requerido");
      const inv = await validatePortalToken(data.token, data.role);
      if (inv.operation_id !== doc.operation_id) throw new Error("No autorizado");
      const allowed =
        data.role === "buyer"
          ? ["buyer_shared", "all_parties"]
          : ["seller_shared", "all_parties"];
      if (!allowed.includes(doc.visibility as string)) throw new Error("Documento no visible");
    } else {
      const { requireSupabaseAuthDirect } = await import("./portal.helpers.server");
      await requireSupabaseAuthDirect();
    }

    const { data: signed, error } = await sb.storage
      .from(doc.storage_bucket)
      .createSignedUrl(doc.storage_path, 60);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

/** Marca revisión (approved / rejected / needs_revision) — sólo staff. */
export const reviewOperationDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        document_id: z.string().uuid(),
        review_status: z.enum(["approved", "rejected", "needs_revision"]),
        review_notes: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();
    // Solo staff Geocapitals puede revisar documentos.
    const { data: isStaff } = await sb.rpc("is_gc_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("Solo staff Geocapitals puede revisar documentos");
    const { data: doc, error } = await sb
      .from("operation_documents")
      .update({
        review_status: data.review_status,
        review_notes: data.review_notes ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.document_id)
      .select("operation_id")
      .single();
    if (error) throw error;

    await sb.from("operation_access_logs").insert({
      operation_id: doc.operation_id,
      actor_user_id: context.userId,
      actor_role: "geocapitals",
      action: `document_${data.review_status}`,
      metadata: { document_id: data.document_id } as never,
    });
    return { ok: true };
  });

/** Congela documento para firma / evidencia contractual. */
export const freezeOperationDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ document_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: doc, error } = await sb
      .from("operation_documents")
      .update({ is_frozen: true, frozen_at: new Date().toISOString() })
      .eq("id", data.document_id)
      .select("operation_id, sha256")
      .single();
    if (error) throw error;
    await sb.from("operation_access_logs").insert({
      operation_id: doc.operation_id,
      actor_user_id: context.userId,
      actor_role: "geocapitals",
      action: "document_frozen",
      metadata: { document_id: data.document_id, sha256: doc.sha256 } as never,
    });
    return { ok: true };
  });
