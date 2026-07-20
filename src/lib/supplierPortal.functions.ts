// Portal de proveedores: documentos KYC (constitución, RUT, certificados,
// referencias). Se guardan en el bucket privado `supplier-kyc` bajo
// `<userId>/...` y su metadata queda en `data_room_files` con un folder
// reservado por usuario (folder_key = `kyc:<userId>`) para reusar RLS y UI.
// Alternativamente listamos directo desde storage cuando la tabla no aplica.

import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUPPLIER_KYC_BUCKET = "supplier-kyc";

function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function ensureBucket(sb: SupabaseClient) {
  const { data } = await sb.storage.getBucket(SUPPLIER_KYC_BUCKET);
  if (!data) {
    await sb.storage.createBucket(SUPPLIER_KYC_BUCKET, {
      public: false,
      fileSizeLimit: 25 * 1024 * 1024, // 25 MB
    });
  }
}

const RequestUploadInput = z.object({
  fileName: z.string().trim().min(1).max(200),
});

/** Devuelve URL firmada para que el proveedor suba su documento KYC. */
export const requestKycUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RequestUploadInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = serviceClient();
    if (!sb) throw new Error("Servicio no disponible.");
    await ensureBucket(sb);

    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
    const stamp = Date.now();
    const path = `${context.userId}/${stamp}_${safe}`;
    const { data: signed, error } = await sb.storage
      .from(SUPPLIER_KYC_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "No se pudo firmar la subida.");
    return { bucket: SUPPLIER_KYC_BUCKET, path, token: signed.token };
  });

export type KycDoc = {
  name: string;
  path: string;
  size: number | null;
  uploadedAt: string;
  signedUrl: string | null;
};

export const listMyKycDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KycDoc[]> => {
    const sb = serviceClient();
    if (!sb) return [];
    await ensureBucket(sb);
    const { data, error } = await sb.storage
      .from(SUPPLIER_KYC_BUCKET)
      .list(context.userId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error || !data) return [];
    const docs: KycDoc[] = [];
    for (const f of data) {
      if (!f.name) continue;
      const path = `${context.userId}/${f.name}`;
      const { data: url } = await sb.storage
        .from(SUPPLIER_KYC_BUCKET)
        .createSignedUrl(path, 60 * 60);
      docs.push({
        name: f.name.replace(/^\d+_/, ""),
        path,
        size: (f.metadata as { size?: number } | null)?.size ?? null,
        uploadedAt: f.created_at ?? new Date().toISOString(),
        signedUrl: url?.signedUrl ?? null,
      });
    }
    return docs;
  });

const DeleteInput = z.object({ path: z.string().trim().min(1).max(400) });

export const deleteMyKycDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeleteInput.parse(d))
  .handler(async ({ data, context }) => {
    // Sólo puede borrar sus propios documentos: el path debe empezar por su userId.
    if (!data.path.startsWith(`${context.userId}/`)) {
      throw new Error("No autorizado.");
    }
    const sb = serviceClient();
    if (!sb) throw new Error("Servicio no disponible.");
    const { error } = await sb.storage.from(SUPPLIER_KYC_BUCKET).remove([data.path]);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
