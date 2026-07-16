// Data room por listing: subida (dueño), listado y descarga con gating NDA.
//
// Diseño de acceso: el bucket es privado y NO tiene policies de storage para
// clientes — todo pasa por server functions con service role:
//  - subida: el dueño pide una signed upload URL y sube directo a storage
//  - descarga: signed URL de 10 min emitida solo si el solicitante es el
//    dueño, el archivo no requiere NDA, o el solicitante firmó el NDA del
//    listing (property_deal_inquiries.nda_signed_at)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "data-room-files";

export const DATA_ROOM_CATEGORIES = [
  "ni43101",
  "geologia",
  "legal",
  "financiero",
  "otros",
] as const;

export const DATA_ROOM_CATEGORY_LABELS: Record<string, string> = {
  ni43101: "NI 43-101 / Técnico",
  geologia: "Geología / Sondajes",
  legal: "Legal / Concesiones",
  financiero: "Financiero",
  otros: "Otros",
};

export type DataRoomFileRow = {
  id: string;
  listing_id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  category: string | null;
  requires_nda: boolean;
  created_at: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** El bucket se crea perezosamente: no requiere migración previa. */
async function ensureBucket(sb: Awaited<ReturnType<typeof admin>>) {
  const { data } = await sb.storage.getBucket(BUCKET);
  if (!data) {
    await sb.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 100 * 1024 * 1024, // 100 MB por archivo
    });
  }
}

async function assertListingOwner(
  sb: Awaited<ReturnType<typeof admin>>,
  listingId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await sb
    .from("property_listings")
    .select("owner_user_id")
    .eq("id", listingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.owner_user_id !== userId) throw new Error("No autorizado");
}

// ── Subida (solo dueño) ───────────────────────────────────────────────────────

export const requestDataRoomUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        listingId: z.string().uuid(),
        fileName: z.string().min(1).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();
    await assertListingOwner(sb, data.listingId, context.userId);
    await ensureBucket(sb);

    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${data.listingId}/${crypto.randomUUID()}-${safe}`;
    const { data: signed, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "No se pudo preparar la subida");
    return { path, token: signed.token, bucket: BUCKET };
  });

export const registerDataRoomFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        listingId: z.string().uuid(),
        filePath: z.string().min(1).max(500),
        fileName: z.string().min(1).max(300),
        fileSizeBytes: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
        mimeType: z.string().max(120).optional().nullable(),
        category: z.enum(DATA_ROOM_CATEGORIES).optional().nullable(),
        requiresNda: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();
    await assertListingOwner(sb, data.listingId, context.userId);
    // El path debe pertenecer al listing (evita registrar archivos ajenos)
    if (!data.filePath.startsWith(`${data.listingId}/`)) throw new Error("Path inválido");

    const { data: row, error } = await sb
      .from("property_data_room_files")
      .insert({
        listing_id: data.listingId,
        file_path: data.filePath,
        file_name: data.fileName,
        file_size_bytes: data.fileSizeBytes ?? null,
        mime_type: data.mimeType ?? null,
        category: data.category ?? null,
        requires_nda: data.requiresNda,
        uploaded_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: row.id };
  });

export const deleteDataRoomFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ fileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: file, error } = await sb
      .from("property_data_room_files")
      .select("id, listing_id, file_path")
      .eq("id", data.fileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!file) throw new Error("Archivo no encontrado");
    await assertListingOwner(sb, file.listing_id, context.userId);

    await sb.storage.from(BUCKET).remove([file.file_path]);
    const { error: delErr } = await sb
      .from("property_data_room_files")
      .delete()
      .eq("id", data.fileId);
    if (delErr) throw new Error(delErr.message);
    return { ok: true as const };
  });

// ── Listado (dueño ve todo; otros ven metadata para saber qué hay) ───────────

export const listDataRoomFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context: _context }) => {
    const sb = await admin();
    const { data: rows, error } = await sb
      .from("property_data_room_files")
      .select(
        "id, listing_id, file_name, file_path, file_size_bytes, mime_type, category, requires_nda, created_at",
      )
      .eq("listing_id", data.listingId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as DataRoomFileRow[];
  });

// ── Inquiries del listing (solo dueño) ────────────────────────────────────────

export type ListingInquiryRow = {
  id: string;
  listing_id: string;
  inquirer_user_id: string;
  inquirer_email: string | null;
  inquirer_name: string | null;
  status: string;
  message: string | null;
  nda_signed_at: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  created_at: string;
  updated_at: string;
};

export const listInquiriesForOwner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ListingInquiryRow[]> => {
    const sb = await admin();
    await assertListingOwner(sb, data.listingId, context.userId);
    const { data: rows, error } = await sb
      .from("property_deal_inquiries")
      .select(
        "id, listing_id, inquirer_user_id, status, message, nda_signed_at, closed_at, closed_reason, created_at, updated_at",
      )
      .eq("listing_id", data.listingId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [];
    const ids = Array.from(new Set(rows.map((r) => r.inquirer_user_id)));
    const { data: profiles } = await sb
      .from("profiles")
      .select("user_id, email, display_name")
      .in("user_id", ids);
    const byId = new Map(
      (profiles ?? []).map((p) => [
        p.user_id as string,
        { email: p.email as string | null, name: p.display_name as string | null },
      ]),
    );
    return rows.map((r) => ({
      ...r,
      inquirer_email: byId.get(r.inquirer_user_id)?.email ?? null,
      inquirer_name: byId.get(r.inquirer_user_id)?.name ?? null,
    })) as ListingInquiryRow[];
  });

// ── Descarga con gating NDA ───────────────────────────────────────────────────

export const getDataRoomDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ fileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: file, error } = await sb
      .from("property_data_room_files")
      .select("id, listing_id, file_path, requires_nda")
      .eq("id", data.fileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!file) throw new Error("Archivo no encontrado");

    // ¿Dueño del listing?
    const { data: listing } = await sb
      .from("property_listings")
      .select("owner_user_id")
      .eq("id", file.listing_id)
      .maybeSingle();
    const isOwner = listing?.owner_user_id === context.userId;

    if (!isOwner && file.requires_nda) {
      // ¿NDA firmado por este usuario para este listing?
      const { data: inquiry } = await sb
        .from("property_deal_inquiries")
        .select("nda_signed_at")
        .eq("listing_id", file.listing_id)
        .eq("inquirer_user_id", context.userId)
        .maybeSingle();
      if (!inquiry?.nda_signed_at) {
        throw new Error("Este archivo requiere firmar el NDA del listing.");
      }
    }

    const { data: signed, error: signErr } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(file.file_path, 60 * 10);
    if (signErr || !signed) throw new Error(signErr?.message ?? "No se pudo firmar la descarga");
    return { url: signed.signedUrl };
  });
