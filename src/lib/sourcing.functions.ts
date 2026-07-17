import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  generateSubmitToken,
  generateShareToken,
  tokenPrefix,
  isSubmitTokenFormat,
  isShareTokenFormat,
  summarizeSubmissions,
  SUBMISSION_STATUSES,
  REQUEST_STATUSES,
  type SubmissionsSummary,
} from "@/lib/sourcing";
import { sha256Hex } from "@/lib/documents/signing";

// Requerimientos de commodities + propuestas de proveedores. El dueño usa el
// cliente RLS; los flujos públicos (proveedor sube, comprador ve ficha) usan
// service role y validan el token por hash.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;
const isMissingTable = (msg: string) => /does not exist|relation|schema cache/i.test(msg);

function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const DocRefSchema = z.object({
  label: z.string().trim().min(1).max(120),
  url: z.string().trim().url().max(500),
});

// ---------- Dueño: crear requerimiento ----------
const CreateRequestInput = z.object({
  reference: z.string().trim().min(1).max(60),
  commodity: z.string().trim().min(1).max(60),
  form: z.string().trim().max(60).optional(),
  quantityT: z.number().min(0).max(1e12).optional(),
  incoterm: z.string().trim().max(20).optional(),
  destination: z.string().trim().max(120).optional(),
  targetPriceUsdT: z.number().min(0).max(1e9).optional(),
  specs: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const createSourcingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateRequestInput.parse(d))
  .handler(async ({ data, context }) => {
    const token = generateSubmitToken();
    const { data: row, error } = await asSb(context.supabase)
      .from("sourcing_requests")
      .insert({
        owner_user_id: context.userId as string,
        reference: data.reference,
        commodity: data.commodity,
        form: data.form ?? null,
        quantity_t: data.quantityT ?? null,
        incoterm: data.incoterm ?? null,
        destination: data.destination ?? null,
        target_price_usd_t: data.targetPriceUsdT ?? null,
        specs: data.specs ?? null,
        notes: data.notes ?? null,
        submit_token_prefix: tokenPrefix(token),
        submit_token_hash: await sha256Hex(token),
      })
      .select("id")
      .single();
    if (error) {
      if (isMissingTable(error.message))
        throw new Error(
          "El módulo de sourcing estará disponible tras aplicar la última migración.",
        );
      throw new Error(error.message);
    }
    // El submit token viaja en claro solo aquí.
    return { id: (row as { id: string }).id, submitToken: token };
  });

// ---------- Dueño: listar ----------
export type SourcingRequestRow = {
  id: string;
  reference: string;
  commodity: string;
  form: string | null;
  quantity_t: number | null;
  incoterm: string | null;
  destination: string | null;
  target_price_usd_t: number | null;
  status: string;
  submit_token_prefix: string;
  created_at: string;
  summary: SubmissionsSummary;
};

export const listSourcingRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ pending: boolean; requests: SourcingRequestRow[] }> => {
    const sb = asSb(context.supabase);
    const { data, error } = await sb
      .from("sourcing_requests")
      .select(
        "id, reference, commodity, form, quantity_t, incoterm, destination, target_price_usd_t, status, submit_token_prefix, created_at, submissions:sourcing_submissions(status, offer_price_usd_t)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      if (isMissingTable(error.message)) return { pending: true, requests: [] };
      throw new Error(error.message);
    }
    const requests: SourcingRequestRow[] = (
      (data ?? []) as Array<
        Record<string, unknown> & {
          submissions?: Array<{ status: string; offer_price_usd_t: number | null }> | null;
        }
      >
    ).map((r) => ({
      id: String(r.id),
      reference: String(r.reference),
      commodity: String(r.commodity),
      form: (r.form ?? null) as string | null,
      quantity_t: (r.quantity_t ?? null) as number | null,
      incoterm: (r.incoterm ?? null) as string | null,
      destination: (r.destination ?? null) as string | null,
      target_price_usd_t: (r.target_price_usd_t ?? null) as number | null,
      status: String(r.status),
      submit_token_prefix: String(r.submit_token_prefix),
      created_at: String(r.created_at),
      summary: summarizeSubmissions(r.submissions ?? []),
    }));
    return { pending: false, requests };
  });

// ---------- Dueño: detalle + propuestas ----------
export type SubmissionRow = {
  id: string;
  supplier_name: string;
  supplier_company: string | null;
  supplier_country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  offer_price_usd_t: number | null;
  offer_quantity_t: number | null;
  incoterm: string | null;
  lead_time: string | null;
  specs: string | null;
  notes: string | null;
  documents: Array<{ label: string; url: string }>;
  status: string;
  share_token_prefix: string | null;
  created_at: string;
};

export const getSourcingRequestDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ request: SourcingRequestRow | null; submissions: SubmissionRow[] }> => {
      const sb = asSb(context.supabase);
      const { data: r } = await sb
        .from("sourcing_requests")
        .select(
          "id, reference, commodity, form, quantity_t, incoterm, destination, target_price_usd_t, status, submit_token_prefix, created_at",
        )
        .eq("id", data.id)
        .maybeSingle();
      if (!r) return { request: null, submissions: [] };

      const { data: subs } = await sb
        .from("sourcing_submissions")
        .select(
          "id, supplier_name, supplier_company, supplier_country, contact_email, contact_phone, offer_price_usd_t, offer_quantity_t, incoterm, lead_time, specs, notes, documents, status, share_token_prefix, created_at",
        )
        .eq("request_id", data.id)
        .order("created_at", { ascending: false });

      const submissions = ((subs ?? []) as SubmissionRow[]).map((s) => ({
        ...s,
        documents: Array.isArray(s.documents) ? s.documents : [],
      }));
      return {
        request: {
          ...(r as Omit<SourcingRequestRow, "summary">),
          summary: summarizeSubmissions(
            submissions.map((s) => ({ status: s.status, offer_price_usd_t: s.offer_price_usd_t })),
          ),
        },
        submissions,
      };
    },
  );

export const setSubmissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(SUBMISSION_STATUSES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await asSb(context.supabase)
      .from("sourcing_submissions")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(REQUEST_STATUSES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await asSb(context.supabase)
      .from("sourcing_requests")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("owner_user_id", context.userId as string);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Dueño: generar ficha compartible con el comprador ----------
export const generateSubmissionShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ submissionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const token = generateShareToken();
    const { data: updated, error } = await sb
      .from("sourcing_submissions")
      .update({ share_token_prefix: tokenPrefix(token), share_token_hash: await sha256Hex(token) })
      .eq("id", data.submissionId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("No se pudo generar el link (¿es tu propuesta?).");
    // El share token viaja en claro solo aquí.
    return { shareToken: token };
  });

// ---------- Público: proveedor ve el requerimiento y sube propuesta ----------
export type PublicSourcingRequest = {
  reference: string;
  commodity: string;
  form: string | null;
  quantityT: number | null;
  incoterm: string | null;
  destination: string | null;
  specs: string | null;
  status: string;
  expired: boolean;
};

export const getSourcingRequestByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().trim().min(10).max(120) }).parse(d))
  .handler(async ({ data }): Promise<PublicSourcingRequest | null> => {
    if (!isSubmitTokenFormat(data.token)) return null;
    const sb = serviceClient();
    if (!sb) return null;
    const { data: r } = await sb
      .from("sourcing_requests")
      .select(
        "reference, commodity, form, quantity_t, incoterm, destination, specs, status, expires_at",
      )
      .eq("submit_token_hash", await sha256Hex(data.token))
      .maybeSingle();
    if (!r) return null;
    const row = r as Record<string, unknown>;
    return {
      reference: String(row.reference),
      commodity: String(row.commodity),
      form: (row.form ?? null) as string | null,
      quantityT: (row.quantity_t ?? null) as number | null,
      incoterm: (row.incoterm ?? null) as string | null,
      destination: (row.destination ?? null) as string | null,
      specs: (row.specs ?? null) as string | null,
      status: String(row.status),
      expired: row.expires_at ? new Date(String(row.expires_at)) < new Date() : false,
    };
  });

const SubmitInput = z.object({
  token: z.string().trim().min(10).max(120),
  supplierName: z.string().trim().min(2).max(120),
  supplierCompany: z.string().trim().max(160).optional(),
  supplierCountry: z.string().trim().max(60).optional(),
  contactEmail: z.string().trim().email().max(160).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  offerPriceUsdT: z.number().min(0).max(1e9).optional(),
  offerQuantityT: z.number().min(0).max(1e12).optional(),
  incoterm: z.string().trim().max(20).optional(),
  leadTime: z.string().trim().max(80).optional(),
  specs: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
  documents: z.array(DocRefSchema).max(20).optional(),
});

export const submitSourcingProposal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SubmitInput.parse(d))
  .handler(async ({ data }) => {
    if (!isSubmitTokenFormat(data.token)) throw new Error("Link inválido.");
    const sb = serviceClient();
    if (!sb) throw new Error("Servicio no disponible.");
    const { data: req } = await sb
      .from("sourcing_requests")
      .select("id, status, expires_at")
      .eq("submit_token_hash", await sha256Hex(data.token))
      .maybeSingle();
    if (!req) throw new Error("Requerimiento no encontrado.");
    const r = req as { id: string; status: string; expires_at: string | null };
    if (r.status !== "abierto") throw new Error("Este requerimiento ya no recibe propuestas.");
    if (r.expires_at && new Date(r.expires_at) < new Date())
      throw new Error("El link expiró. Solicita uno nuevo al comprador.");

    const { error } = await sb.from("sourcing_submissions").insert({
      request_id: r.id,
      supplier_name: data.supplierName,
      supplier_company: data.supplierCompany ?? null,
      supplier_country: data.supplierCountry ?? null,
      contact_email: data.contactEmail ?? null,
      contact_phone: data.contactPhone ?? null,
      offer_price_usd_t: data.offerPriceUsdT ?? null,
      offer_quantity_t: data.offerQuantityT ?? null,
      incoterm: data.incoterm ?? null,
      lead_time: data.leadTime ?? null,
      specs: data.specs ?? null,
      notes: data.notes ?? null,
      documents: data.documents ?? [],
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------- Público: comprador ve la ficha de proveedor (solo lectura) ----------
export type SupplierSheet = {
  request: {
    reference: string;
    commodity: string;
    form: string | null;
    quantityT: number | null;
    incoterm: string | null;
    destination: string | null;
  };
  supplier: SubmissionRow;
};

export const getSupplierSheetByShareToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().trim().min(10).max(120) }).parse(d))
  .handler(async ({ data }): Promise<SupplierSheet | null> => {
    if (!isShareTokenFormat(data.token)) return null;
    const sb = serviceClient();
    if (!sb) return null;
    const { data: sub } = await sb
      .from("sourcing_submissions")
      .select(
        "id, request_id, supplier_name, supplier_company, supplier_country, contact_email, contact_phone, offer_price_usd_t, offer_quantity_t, incoterm, lead_time, specs, notes, documents, status, share_token_prefix, created_at",
      )
      .eq("share_token_hash", await sha256Hex(data.token))
      .maybeSingle();
    if (!sub) return null;
    const s = sub as SubmissionRow & { request_id: string };
    const { data: req } = await sb
      .from("sourcing_requests")
      .select("reference, commodity, form, quantity_t, incoterm, destination")
      .eq("id", s.request_id)
      .maybeSingle();
    if (!req) return null;
    const r = req as Record<string, unknown>;
    return {
      request: {
        reference: String(r.reference),
        commodity: String(r.commodity),
        form: (r.form ?? null) as string | null,
        quantityT: (r.quantity_t ?? null) as number | null,
        incoterm: (r.incoterm ?? null) as string | null,
        destination: (r.destination ?? null) as string | null,
      },
      supplier: { ...s, documents: Array.isArray(s.documents) ? s.documents : [] },
    };
  });
