// Data room canónico por PROYECTO (tabla `data_rooms` + `data_room_folders` +
// `data_room_files`), expuesto a la UI a través del listing que publica ese
// proyecto.
//
// Antes existían dos data rooms paralelos: `property_data_room_files` (el que
// usaba la UI, vacío) y el modelo normalizado `data_rooms/*` (donde vivían los
// documentos reales). Este módulo deja UN solo data room:
//
//  - un `data_rooms` por proyecto, creado de forma perezosa
//  - carpetas de sistema 00–10 (taxonomía institucional de due diligence)
//  - bucket privado; toda subida/descarga pasa por estas funciones con service
//    role, nunca por policies de storage del cliente
//  - gate por NDA: el archivo confidencial solo se descarga si el solicitante
//    administra el proyecto o tiene NDA y un grant vigente para ese archivo
//  - bitácora: cada intento de descarga queda en `data_room_access_logs`
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { activeRoomGrant, roomFileAllowed, type DataRoomGrant } from "./dataRoomAccess";
import { requireCapitalRole } from "@/lib/access/roleMiddleware";

const BUCKET = "data-room-files";

/** Taxonomía institucional de carpetas (código = categoría en la UI). */
export const DATA_ROOM_FOLDERS = [
  { code: "00", name: "00 - Resumen Ejecutivo" },
  { code: "01", name: "01 - Geología y Recursos" },
  { code: "02", name: "02 - Sondajes y Muestreo" },
  { code: "03", name: "03 - QA/QC" },
  { code: "04", name: "04 - Estimación de Recursos" },
  { code: "05", name: "05 - Estudios Económicos" },
  { code: "06", name: "06 - Catastro y Permisos" },
  { code: "07", name: "07 - HSE y Comunidad" },
  { code: "08", name: "08 - Reportes Técnicos (NI 43-101 / JORC / CH 20235)" },
  { code: "09", name: "09 - Legal y Corporativo" },
  { code: "10", name: "10 - Financieros" },
] as const;

export const DATA_ROOM_CATEGORIES = DATA_ROOM_FOLDERS.map((f) => f.code) as unknown as readonly [
  string,
  ...string[],
];

export const DATA_ROOM_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  DATA_ROOM_FOLDERS.map((f) => [f.code, f.name.replace(/^\d+\s-\s/, "")]),
);

export type DataRoomFileRow = {
  id: string;
  listing_id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  category: string | null;
  requires_nda: boolean;
  /** El titular registró el documento pero aún no cargó el archivo. */
  pending: boolean;
  created_at: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Admin = Awaited<ReturnType<typeof admin>>;

async function ensureBucket(sb: Admin) {
  const { data } = await sb.storage.getBucket(BUCKET);
  if (!data) {
    await sb.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 100 * 1024 * 1024,
    });
  }
}

type RoomContext = {
  roomId: string;
  projectId: string;
  listingId: string;
  ownerUserId: string | null;
  listingTitle: string;
  published: boolean;
};

/** Listing → proyecto → data room canónico (creándolo si no existe). */
async function resolveRoom(sb: Admin, listingId: string, create = true): Promise<RoomContext> {
  const { data: listing, error } = await sb
    .from("property_listings")
    .select("id, title, owner_user_id, project_id, is_published")
    .eq("id", listingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!listing) throw new Error("Listing no encontrado");
  if (!listing.project_id) {
    throw new Error("Este listing aún no está vinculado a un proyecto: no tiene data room.");
  }
  const projectId = listing.project_id as string;

  const { data: existing } = await sb
    .from("data_rooms")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let roomId = existing?.id as string | undefined;
  if (!roomId && !create) throw new Error("El expediente aún no está disponible.");
  if (!roomId) {
    const { data: created, error: cErr } = await sb
      .from("data_rooms")
      .insert({
        project_id: projectId,
        name: `Data room · ${listing.title}`,
        status: "active",
        nda_required: true,
        watermark_enabled: true,
        created_by: listing.owner_user_id as string,
      })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);
    roomId = created.id as string;
  }

  if (create) await ensureFolders(sb, roomId, listing.owner_user_id as string);

  return {
    roomId,
    projectId,
    listingId,
    ownerUserId: (listing.owner_user_id as string | null) ?? null,
    listingTitle: listing.title as string,
    published: listing.is_published === true,
  };
}

async function ensureFolders(sb: Admin, roomId: string, createdBy: string) {
  const { data: rows } = await sb
    .from("data_room_folders")
    .select("id, name")
    .eq("data_room_id", roomId);
  const have = new Set((rows ?? []).map((r) => r.name as string));
  const missing = DATA_ROOM_FOLDERS.filter((f) => !have.has(f.name));
  if (missing.length === 0) return;
  await sb.from("data_room_folders").insert(
    missing.map((f, i) => ({
      data_room_id: roomId,
      name: f.name,
      path: `/${f.name}`,
      display_order: DATA_ROOM_FOLDERS.findIndex((x) => x.code === f.code) + i * 0,
      is_system: true,
      created_by: createdBy,
    })),
  );
}

async function folderMap(sb: Admin, roomId: string) {
  const { data } = await sb.from("data_room_folders").select("id, name").eq("data_room_id", roomId);
  const byId = new Map<string, string>();
  const byCode = new Map<string, string>();
  for (const r of data ?? []) {
    const name = r.name as string;
    const code = name.slice(0, 2);
    byId.set(r.id as string, code);
    if (!byCode.has(code)) byCode.set(code, r.id as string);
  }
  return { byId, byCode };
}

function isProjectPrivileged(role: string | null | undefined) {
  return role === "owner" || role === "admin" || role === "project_manager";
}

async function projectRole(sb: Admin, projectId: string, userId: string) {
  const { data } = await sb
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as string | null) ?? null;
}

async function assertRoomManager(sb: Admin, room: RoomContext, userId: string) {
  if (room.ownerUserId === userId) return;
  const role = await projectRole(sb, room.projectId, userId);
  if (!isProjectPrivileged(role)) throw new Error("No autorizado");
}

async function readRoomAccess(sb: Admin, room: RoomContext, userId: string) {
  const manager =
    room.ownerUserId === userId ||
    isProjectPrivileged(await projectRole(sb, room.projectId, userId));
  if (manager) return { manager: true, ndaSigned: true, grants: [] as DataRoomGrant[] };
  if (!room.published) throw new Error("Este expediente no está publicado.");
  const [inquiry, grants] = await Promise.all([
    sb
      .from("property_deal_inquiries")
      .select("nda_signed_at")
      .eq("listing_id", room.listingId)
      .eq("inquirer_user_id", userId)
      .maybeSingle(),
    sb
      .from("data_room_access_grants")
      .select(
        "id,data_room_id,grantee_user_id,access_level,scope,scope_file_ids,scope_folder_ids,nda_signed_at,revoked_at,expires_at",
      )
      .eq("data_room_id", room.roomId)
      .eq("grantee_user_id", userId),
  ]);
  if (inquiry.error || grants.error)
    throw new Error("No se pudo verificar el permiso del expediente.");
  return {
    manager: false,
    ndaSigned: !!inquiry.data?.nda_signed_at,
    grants: (grants.data ?? []) as DataRoomGrant[],
  };
}

async function logAccess(
  sb: Admin,
  args: {
    roomId: string;
    fileId?: string | null;
    actorUserId: string;
    action: string;
    allowed: boolean;
    reason?: string | null;
  },
) {
  await sb.from("data_room_access_logs").insert({
    data_room_id: args.roomId,
    file_id: args.fileId ?? null,
    actor_user_id: args.actorUserId,
    action: args.action,
    allowed: args.allowed,
    reason: args.reason ?? null,
  });
}

// ── Subida (titular / equipo del proyecto) ───────────────────────────────────

export const requestDataRoomUpload = createServerFn({ method: "POST" })
  .middleware([requireCapitalRole])
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
    const room = await resolveRoom(sb, data.listingId);
    await assertRoomManager(sb, room, context.userId);
    await ensureBucket(sb);

    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${room.roomId}/${crypto.randomUUID()}-${safe}`;
    const { data: signed, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "No se pudo preparar la subida");
    return { path, token: signed.token, bucket: BUCKET };
  });

export const registerDataRoomFile = createServerFn({ method: "POST" })
  .middleware([requireCapitalRole])
  .inputValidator((d) =>
    z
      .object({
        listingId: z.string().uuid(),
        filePath: z.string().min(1).max(500),
        fileName: z.string().min(1).max(300),
        fileSizeBytes: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
        mimeType: z.string().max(120).optional().nullable(),
        category: z.string().max(4).optional().nullable(),
        requiresNda: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const room = await resolveRoom(sb, data.listingId);
    await assertRoomManager(sb, room, context.userId);
    if (!data.filePath.startsWith(`${room.roomId}/`)) throw new Error("Path inválido");

    const { byCode } = await folderMap(sb, room.roomId);
    const folderId = data.category ? (byCode.get(data.category) ?? null) : null;

    const { data: row, error } = await sb
      .from("data_room_files")
      .insert({
        data_room_id: room.roomId,
        folder_id: folderId,
        storage_path: data.filePath,
        file_name: data.fileName,
        size_bytes: data.fileSizeBytes ?? null,
        mime_type: data.mimeType ?? null,
        confidentiality: data.requiresNda ? "confidential" : "public",
        watermark_required: data.requiresNda,
        uploaded_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAccess(sb, {
      roomId: room.roomId,
      fileId: row.id as string,
      actorUserId: context.userId,
      action: "upload",
      allowed: true,
    });
    return { ok: true as const, id: row.id };
  });

export const deleteDataRoomFile = createServerFn({ method: "POST" })
  .middleware([requireCapitalRole])
  .inputValidator((d) =>
    z.object({ listingId: z.string().uuid(), fileId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const room = await resolveRoom(sb, data.listingId);
    await assertRoomManager(sb, room, context.userId);

    const { data: file, error } = await sb
      .from("data_room_files")
      .select("id, data_room_id, storage_path")
      .eq("id", data.fileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!file || file.data_room_id !== room.roomId) throw new Error("Archivo no encontrado");

    const path = file.storage_path as string;
    if (!path.startsWith("pending/")) await sb.storage.from(BUCKET).remove([path]);
    const { error: delErr } = await sb.from("data_room_files").delete().eq("id", data.fileId);
    if (delErr) throw new Error(delErr.message);
    return { ok: true as const };
  });

// ── Listado ──────────────────────────────────────────────────────────────────

export const listDataRoomFiles = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .inputValidator((d) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DataRoomFileRow[]> => {
    const sb = await admin();
    const room = await resolveRoom(sb, data.listingId, false);
    const access = await readRoomAccess(sb, room, context.userId);
    const { byId } = await folderMap(sb, room.roomId);

    const { data: rows, error } = await sb
      .from("data_room_files")
      .select(
        "id, folder_id, file_name, storage_path, size_bytes, mime_type, confidentiality, created_at",
      )
      .eq("data_room_id", room.roomId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const allowed = (rows ?? []).filter(
      (file) =>
        access.manager ||
        roomFileAllowed(file, access.grants, context.userId, room.roomId, access.ndaSigned),
    );
    await logAccess(sb, {
      roomId: room.roomId,
      actorUserId: context.userId,
      action: "view",
      allowed: true,
    });
    return allowed.map((r) => ({
      id: r.id as string,
      listing_id: data.listingId,
      file_name: r.file_name as string,
      file_path: access.manager ? (r.storage_path as string) : "",
      file_size_bytes: r.size_bytes != null ? Number(r.size_bytes) : null,
      mime_type: (r.mime_type as string | null) ?? null,
      category: r.folder_id ? (byId.get(r.folder_id as string) ?? null) : null,
      requires_nda: (r.confidentiality as string) !== "public",
      pending: (r.storage_path as string).startsWith("pending/"),
      created_at: r.created_at as string,
    }));
  });

// ── Inquiries del listing (solo titular) ─────────────────────────────────────

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
  .middleware([requireCapitalRole])
  .inputValidator((d) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ListingInquiryRow[]> => {
    const sb = await admin();
    const { data: listing } = await sb
      .from("property_listings")
      .select("owner_user_id")
      .eq("id", data.listingId)
      .maybeSingle();
    if (!listing || listing.owner_user_id !== context.userId) throw new Error("No autorizado");

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

// ── NDA: firma → etapa del deal → permiso de data room → bitácora ────────────

export const signNdaAndGrantAccess = createServerFn({ method: "POST" })
  .middleware([requireCapitalRole])
  .inputValidator((d) =>
    z
      .object({
        listingId: z.string().uuid(),
        signature: z.string().min(1).max(200),
        message: z.string().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const room = await resolveRoom(sb, data.listingId, false);
    if (!room.published) throw new Error("Esta oportunidad no está publicada.");
    const { data: grantRows, error: grantError } = await sb
      .from("data_room_access_grants")
      .select(
        "id,data_room_id,grantee_user_id,access_level,scope,scope_file_ids,scope_folder_ids,nda_signed_at,revoked_at,expires_at",
      )
      .eq("data_room_id", room.roomId)
      .eq("grantee_user_id", context.userId);
    if (grantError) throw new Error("No se pudo verificar el acceso al expediente.");
    const existingGrants = (grantRows ?? []) as DataRoomGrant[];
    if (
      existingGrants.length &&
      !existingGrants.some((grant) =>
        activeRoomGrant(grant, context.userId, room.roomId, Date.now()),
      )
    ) {
      throw new Error(
        "Tu permiso de acceso fue revocado o venció. Contacta al equipo para solicitar una revisión.",
      );
    }
    const now = new Date().toISOString();

    const { data: inquiry, error } = await sb
      .from("property_deal_inquiries")
      .upsert(
        {
          listing_id: data.listingId,
          inquirer_user_id: context.userId,
          nda_signed_at: now,
          nda_signature: data.signature,
          status: "nda_signed",
          ...(data.message && data.message.trim() ? { message: data.message.trim() } : {}),
        },
        { onConflict: "listing_id,inquirer_user_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Etapa del deal (best-effort: la RPC valida transición y autorización)
    await sb.rpc("deal_advance", {
      p_inquiry_id: inquiry.id,
      p_stage: "nda_firmado",
      p_note: "NDA firmado en la ficha del proyecto",
    });

    // Preserve existing permissions, including revoked and expired records.
    // Signing again must never broaden a file/folder grant or reopen revoked access.
    if (existingGrants.length === 0) {
      const { error: grantError } = await sb.from("data_room_access_grants").insert({
        data_room_id: room.roomId,
        grantee_user_id: context.userId,
        access_level: "view",
        scope: "room",
        nda_signed_at: now,
        granted_by: context.userId,
      });
      if (grantError) throw new Error("No se pudo registrar el acceso al expediente.");
    }

    await logAccess(sb, {
      roomId: room.roomId,
      actorUserId: context.userId,
      action: "nda_signed",
      allowed: true,
    });

    return { ok: true as const, inquiryId: inquiry.id as string };
  });

// ── Descarga con gate NDA + bitácora ─────────────────────────────────────────

export const getDataRoomDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireCapitalRole])
  .inputValidator((d) =>
    z.object({ listingId: z.string().uuid(), fileId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const room = await resolveRoom(sb, data.listingId, false);

    const { data: file, error } = await sb
      .from("data_room_files")
      .select("id, data_room_id, folder_id, storage_path, confidentiality")
      .eq("id", data.fileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!file || file.data_room_id !== room.roomId) throw new Error("Archivo no encontrado");

    const access = await readRoomAccess(sb, room, context.userId);
    if (
      !access.manager &&
      !roomFileAllowed(file, access.grants, context.userId, room.roomId, access.ndaSigned)
    ) {
      await logAccess(sb, {
        roomId: room.roomId,
        fileId: file.id,
        actorUserId: context.userId,
        action: "download",
        allowed: false,
        reason: "NDA o permiso vigente insuficiente",
      });
      throw new Error("Este documento requiere NDA y un permiso de acceso vigente.");
    }

    const path = file.storage_path as string;
    if (path.startsWith("pending/")) {
      throw new Error("El titular aún no ha cargado este documento.");
    }

    const { data: signed, error: signErr } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 10);
    if (signErr || !signed) throw new Error(signErr?.message ?? "No se pudo firmar la descarga");

    await logAccess(sb, {
      roomId: room.roomId,
      fileId: file.id as string,
      actorUserId: context.userId,
      action: "download",
      allowed: true,
    });

    return { url: signed.signedUrl };
  });

// ── Métricas para el titular: quién vio qué ──────────────────────────────────

export type DataRoomActivityRow = {
  file_id: string | null;
  file_name: string;
  downloads: number;
  viewers: number;
  last_at: string;
};

export const getDataRoomActivity = createServerFn({ method: "GET" })
  .middleware([requireCapitalRole])
  .inputValidator((d) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const room = await resolveRoom(sb, data.listingId);
    await assertRoomManager(sb, room, context.userId);

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: logs, error } = await sb
      .from("data_room_access_logs")
      .select("file_id, actor_user_id, action, allowed, created_at")
      .eq("data_room_id", room.roomId)
      .eq("action", "download")
      .eq("allowed", true)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);

    const names = new Map<string, string>();
    {
      const { data: files } = await sb
        .from("data_room_files")
        .select("id, file_name")
        .eq("data_room_id", room.roomId);
      for (const f of files ?? []) names.set(f.id as string, f.file_name as string);
    }

    const agg = new Map<string, { downloads: number; viewers: Set<string>; last: string }>();
    for (const l of logs ?? []) {
      const key = (l.file_id as string | null) ?? "—";
      const cur = agg.get(key) ?? { downloads: 0, viewers: new Set<string>(), last: "" };
      cur.downloads += 1;
      if (l.actor_user_id) cur.viewers.add(l.actor_user_id as string);
      if (!cur.last) cur.last = l.created_at as string;
      agg.set(key, cur);
    }

    const rows: DataRoomActivityRow[] = Array.from(agg.entries())
      .map(([fileId, v]) => ({
        file_id: fileId === "—" ? null : fileId,
        file_name: names.get(fileId) ?? "Documento eliminado",
        downloads: v.downloads,
        viewers: v.viewers.size,
        last_at: v.last,
      }))
      .sort((a, b) => b.downloads - a.downloads);

    const uniqueViewers = new Set(
      (logs ?? []).map((l) => l.actor_user_id as string | null).filter(Boolean) as string[],
    ).size;

    return { rows, totalDownloads: (logs ?? []).length, uniqueViewers };
  });
