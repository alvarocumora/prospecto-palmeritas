// Expediente documental de la operación (KYC, prueba de fondos, poderes…).
// Checklist por parte (comprador / vendedor) con archivo, estado de revisión y
// nota del equipo GeoCapitals. Los archivos viven en un bucket privado y solo
// se entregan mediante URL firmada de corta duración.

import { createServerFn } from "@tanstack/react-start";
import { type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;
const BUCKET = "operation-docs";

export const KYC_CHECKLIST: Record<"buyer" | "seller", Array<{ key: string; label: string }>> = {
  buyer: [
    { key: "corporate_certificate", label: "Certificado de constitución / vigencia" },
    { key: "tax_id", label: "Identificación tributaria (RUT / TIN / VAT)" },
    { key: "ubo_declaration", label: "Declaración de beneficiario final (UBO)" },
    { key: "director_id", label: "Cédula o pasaporte del representante legal" },
    { key: "power_of_attorney", label: "Poder de representación" },
    { key: "proof_of_funds", label: "Prueba de fondos (POF / RWA)" },
    { key: "bank_reference", label: "Carta o referencia bancaria" },
    { key: "aml_declaration", label: "Declaración AML / origen de fondos" },
    { key: "icpo_signed", label: "ICPO firmada" },
    { key: "ncnda_signed", label: "NCNDA firmada" },
  ],
  seller: [
    { key: "corporate_certificate", label: "Certificado de constitución / vigencia" },
    { key: "tax_id", label: "Identificación tributaria (RUT / TIN)" },
    { key: "mining_title", label: "Título minero o contrato de suministro" },
    { key: "export_permit", label: "Permiso de exportación / SERNAGEOMIN" },
    { key: "assay_certificate", label: "Certificado de ensayo (assay)" },
    { key: "proof_of_product", label: "Prueba de producto (POP)" },
    { key: "fco_signed", label: "FCO firmada" },
    { key: "imfpa_signed", label: "IMFPA firmado" },
  ],
};

export type KycRow = {
  id: string;
  party: string;
  doc_key: string;
  label: string | null;
  file_name: string | null;
  review_status: string;
  review_note: string | null;
  expires_at: string | null;
  uploaded_at: string | null;
  reviewed_at: string | null;
  updated_at: string;
};

async function assertTradeAccess(sb: SupabaseClient, tradeId: string) {
  const { data, error } = await sb
    .from("commodity_trades")
    .select("id")
    .eq("id", tradeId)
    .maybeSingle();
  if (error || !data) throw new Error("Operación no encontrada o sin acceso.");
}

export const listTradeKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tradeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<KycRow[]> => {
    const sb = asSb(context.supabase);
    const { data: rows, error } = await sb
      .from("trade_kyc_documents")
      .select(
        "id, party, doc_key, label, file_name, review_status, review_note, expires_at, uploaded_at, reviewed_at, updated_at",
      )
      .eq("trade_id", data.tradeId)
      .order("party", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as KycRow[];
  });

const uploadInput = (d: unknown) =>
  z
    .object({
      tradeId: z.string().uuid(),
      party: z.enum(["buyer", "seller"]),
      docKey: z.string().trim().min(2).max(60),
      label: z.string().trim().max(160).optional(),
      fileName: z.string().trim().min(1).max(200),
      contentType: z.string().trim().max(120).default("application/octet-stream"),
      /** Contenido del archivo en base64 (máx. ~8 MB). */
      base64: z.string().min(8).max(11_000_000),
    })
    .parse(d);

export const uploadTradeKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(uploadInput)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sb = asSb(context.supabase);
    await assertTradeAccess(sb, data.tradeId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const safeName = data.fileName.replace(/[^\w.\-]+/g, "_").slice(-120);
    const path = `${data.tradeId}/kyc/${data.party}/${data.docKey}-${Date.now()}-${safeName}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bin, { contentType: data.contentType, upsert: true });
    if (upErr) throw new Error(upErr.message);

    const { error } = await supabaseAdmin.from("trade_kyc_documents").upsert(
      {
        trade_id: data.tradeId,
        party: data.party,
        doc_key: data.docKey,
        label: data.label ?? null,
        file_url: path,
        file_name: data.fileName,
        review_status: "in_review",
        uploaded_by: context.userId as string,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: "trade_id,party,doc_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviewTradeKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reviewStatus: z.enum(["pending", "in_review", "approved", "observed"]),
        note: z.string().trim().max(600).optional(),
        expiresAt: z.string().trim().max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sb = asSb(context.supabase);
    const { error } = await sb
      .from("trade_kyc_documents")
      .update({
        review_status: data.reviewStatus,
        review_note: data.note ?? null,
        expires_at: data.expiresAt || null,
        reviewed_by: context.userId as string,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** URL firmada (5 min) para descargar un documento del expediente. */
export const getTradeKycFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ url: string | null }> => {
    const sb = asSb(context.supabase);
    const { data: row, error } = await sb
      .from("trade_kyc_documents")
      .select("file_url")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) return { url: null };
    const path = (row as { file_url: string | null }).file_url;
    if (!path) return { url: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 300);
    return { url: signed?.signedUrl ?? null };
  });
