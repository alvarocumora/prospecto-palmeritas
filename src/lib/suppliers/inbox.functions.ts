// Bandeja interna (staff) + extracción IA de certificados de análisis.
// Todo restringido a super_admin vía is_super_admin(). Ofertas/documentos/notas
// se leen con supabaseAdmin porque staff no siempre tiene RLS por proyecto;
// se valida el rol antes de cualquier lectura.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminRole } from "@/lib/access/roleMiddleware";
import { createLovableAiGatewayProvider, getLovableApiKeyOrThrow } from "@/lib/ai-gateway.server";
import { generateText, Output, NoObjectGeneratedError } from "ai";

async function assertStaff(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Forbidden: staff only");
}

export type InboxSupplier = {
  id: string;
  folio: string;
  legal_name: string;
  country: string;
  status: string;
  supplier_role: string;
  contact_name: string;
  email: string;
  phone_e164: string;
  created_at: string;
  offers_count: number;
  docs_count: number;
  primary_product: string | null;
};

export const listInboxSuppliers = createServerFn({ method: "GET" })
  .middleware([requireAdminRole])
  .inputValidator((raw: unknown) =>
    z
      .object({
        status: z.string().optional(),
        search: z.string().optional(),
        country: z.string().optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<InboxSupplier[]> => {
    await assertStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("suppliers")
      .select(
        "id, folio, legal_name, country, status, supplier_role, contact_name, email, phone_e164, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status)
      q = q.eq(
        "status",
        data.status as
          "nuevo" | "en_revision" | "verificado" | "descartado" | "documentos_incompletos",
      );
    if (data.country) q = q.eq("country", data.country as "CL" | "PE" | "AR" | "BO" | "OTRO");
    if (data.search && data.search.length > 1) {
      const s = data.search.trim();
      q = q.or(
        `legal_name.ilike.%${s}%,folio.ilike.%${s}%,email.ilike.%${s}%,contact_name.ilike.%${s}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    if (!rows || rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const [{ data: offers }, { data: docs }] = await Promise.all([
      supabaseAdmin.from("supplier_offers").select("supplier_id, product").in("supplier_id", ids),
      supabaseAdmin.from("supplier_documents").select("supplier_id").in("supplier_id", ids),
    ]);

    const offersBy = new Map<string, { count: number; product: string | null }>();
    for (const o of offers ?? []) {
      const cur = offersBy.get(o.supplier_id) ?? { count: 0, product: null };
      offersBy.set(o.supplier_id, {
        count: cur.count + 1,
        product: cur.product ?? (o.product as string),
      });
    }
    const docsBy = new Map<string, number>();
    for (const d of docs ?? []) docsBy.set(d.supplier_id, (docsBy.get(d.supplier_id) ?? 0) + 1);

    return rows.map((r) => ({
      ...(r as Omit<InboxSupplier, "offers_count" | "docs_count" | "primary_product">),
      offers_count: offersBy.get(r.id)?.count ?? 0,
      docs_count: docsBy.get(r.id) ?? 0,
      primary_product: offersBy.get(r.id)?.product ?? null,
    }));
  });

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
export type InboxDetail = {
  supplier: Record<string, Json>;
  offers: Array<Record<string, Json>>;
  documents: Array<Record<string, Json>>;
  notes: Array<Record<string, Json>>;
  extractions: Array<Record<string, Json>>;
};

export const getInboxDetail = createServerFn({ method: "GET" })
  .middleware([requireAdminRole])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<InboxDetail> => {
    await assertStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      { data: supplier },
      { data: offers },
      { data: documents },
      { data: notes },
      { data: extractions },
    ] = await Promise.all([
      supabaseAdmin.from("suppliers").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin
        .from("supplier_offers")
        .select("*")
        .eq("supplier_id", data.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("supplier_documents")
        .select("*")
        .eq("supplier_id", data.id)
        .order("uploaded_at", { ascending: false }),
      supabaseAdmin
        .from("supplier_notes")
        .select("*")
        .eq("supplier_id", data.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("supplier_doc_extractions")
        .select("*, supplier_documents!inner(supplier_id)")
        .eq("supplier_documents.supplier_id", data.id)
        .order("created_at", { ascending: false }),
    ]);

    if (!supplier) throw new Error("Supplier not found");

    // Firma URLs privados por 15 min
    const docsWithUrl = await Promise.all(
      (documents ?? []).map(async (d) => {
        const path = (d as { storage_path: string }).storage_path;
        if (!path) return { ...(d as object), signed_url: null };
        const { data: signed } = await supabaseAdmin.storage
          .from("supplier-docs")
          .createSignedUrl(path, 60 * 15);
        return { ...(d as object), signed_url: signed?.signedUrl ?? null };
      }),
    );

    return {
      supplier: supplier as unknown as Record<string, Json>,
      offers: (offers ?? []) as unknown as Array<Record<string, Json>>,
      documents: docsWithUrl as unknown as InboxDetail["documents"],
      notes: (notes ?? []) as unknown as Array<Record<string, Json>>,
      extractions: (extractions ?? []) as unknown as Array<Record<string, Json>>,
    };
  });

export const updateSupplierStatus = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum([
          "nuevo",
          "en_revision",
          "verificado",
          "descartado",
          "documentos_incompletos",
        ]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("suppliers")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw error;
    await supabaseAdmin.from("supplier_events").insert({
      supplier_id: data.id,
      event_type: "supplier.status_changed",
      payload: { to: data.status, by: context.userId },
    });
    return { ok: true };
  });

export const updateDocReview = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        review_status: z.enum(["pendiente", "valido", "rechazado", "ilegible"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("supplier_documents")
      .update({ review_status: data.review_status })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const addSupplierNote = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((raw: unknown) =>
    z
      .object({
        supplier_id: z.string().uuid(),
        offer_id: z.string().uuid().nullable().optional(),
        visibility: z.enum(["internal", "supplier"]).default("internal"),
        body: z.string().min(1).max(4000),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("supplier_notes").insert({
      supplier_id: data.supplier_id,
      offer_id: data.offer_id ?? null,
      visibility: data.visibility,
      body: data.body,
      author_user_id: context.userId,
    });
    if (error) throw error;
    return { ok: true };
  });

// -------- Extracción IA de certificado de análisis --------

const CertSchema = z.object({
  laboratory: z.string().nullable(),
  sample_id: z.string().nullable(),
  sample_date: z.string().nullable(),
  method: z.string().nullable(),
  elements: z.array(
    z.object({
      element: z.string(),
      value: z.number().nullable(),
      unit: z.string().nullable(),
    }),
  ),
  notes: z.string().nullable(),
});

export type ExtractionResult = z.infer<typeof CertSchema>;

export const extractCertificate = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((raw: unknown) => z.object({ document_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: doc, error: docErr } = await supabaseAdmin
      .from("supplier_documents")
      .select("id, storage_path, doc_type, mime_type")
      .eq("id", data.document_id)
      .maybeSingle();
    if (docErr || !doc) throw new Error(docErr?.message ?? "document not found");

    // Descarga el archivo desde el bucket privado.
    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("supplier-docs")
      .download((doc as { storage_path: string }).storage_path);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "download failed");

    const buf = new Uint8Array(await file.arrayBuffer());
    // Base64 seguro para binarios grandes.
    let bin = "";
    for (let i = 0; i < buf.length; i += 32768) {
      bin += String.fromCharCode(...buf.subarray(i, i + 32768));
    }
    const base64 = btoa(bin);
    const mime =
      (doc as { mime_type: string | null }).mime_type ?? (file.type || "application/octet-stream");
    const isPdf = mime.includes("pdf");
    const isImg = mime.startsWith("image/");
    if (!isPdf && !isImg) {
      throw new Error(`Formato no soportado para extracción: ${mime}`);
    }

    const gateway = createLovableAiGatewayProvider(getLovableApiKeyOrThrow());
    const model = gateway("google/gemini-3.6-flash");

    const systemPrompt =
      "Eres un asistente que extrae datos de certificados de análisis mineros (assay reports). Devuelve JSON estricto. Si un dato no aparece, usa null. Elementos comunes: Cu, Au, Ag, Fe, As, S, Zn, Pb, Sb, Mo, humedad.";

    const content = isPdf
      ? [
          { type: "text" as const, text: "Extrae el certificado adjunto." },
          {
            type: "file" as const,
            data: base64,
            mediaType: mime,
            filename: "certificado.pdf",
          },
        ]
      : [
          { type: "text" as const, text: "Extrae el certificado de la imagen adjunta." },
          {
            type: "image" as const,
            image: `data:${mime};base64,${base64}`,
          },
        ];

    let fields: ExtractionResult;
    let rawText = "";
    try {
      const { output, text } = await generateText({
        model,
        system: systemPrompt,
        messages: [{ role: "user", content }],
        output: Output.object({ schema: CertSchema }),
      });
      fields = output;
      rawText = text ?? "";
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        rawText = err.text ?? "";
        fields = {
          laboratory: null,
          sample_id: null,
          sample_date: null,
          method: null,
          elements: [],
          notes: "El modelo no devolvió un JSON válido. Ver texto original.",
        };
      } else {
        throw err;
      }
    }

    const { data: saved, error: insErr } = await supabaseAdmin
      .from("supplier_doc_extractions")
      .insert({
        document_id: data.document_id,
        model: "google/gemini-3.6-flash",
        fields: fields as unknown as Json,
        raw_text: rawText.slice(0, 8000),
        confidence: null,
      })
      .select("id, fields, created_at")
      .single();
    if (insErr) throw insErr;

    return { ok: true, extraction: saved };
  });
