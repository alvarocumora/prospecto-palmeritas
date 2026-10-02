// Programa con colateral: captura pública de solicitudes, gestión por el equipo
// y sala de documentos legales de los valles (solo equipo + inversionistas calificados).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "data-room";
const PROJECTS = ["hualane", "valle-escondido"] as const;
export const LEAD_STATUSES = ["new", "contacted", "qualified", "discarded"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isStaff(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_geocapitals_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertStaff(supabase: any, userId: string) {
  if (!(await isStaff(supabase, userId))) throw new Error("No autorizado");
}

// ── Captura pública ─────────────────────────────────────────────────────────

const LeadSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional().nullable(),
  amountClp: z.number().int().min(25_000_000).max(5_000_000_000),
  months: z.number().int().min(1).max(120),
  projectPref: z
    .enum([...PROJECTS, "indiferente"])
    .optional()
    .nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
});

export const submitCollateralLead = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LeadSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: row, error } = await sb
      .from("collateral_leads")
      .insert({
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        amount_clp: data.amountClp,
        months: data.months,
        project_pref: data.projectPref || null,
        message: data.message || null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[collateral] insert failed", error);
      throw new Error("No pudimos registrar tu solicitud. Intenta nuevamente.");
    }
    try {
      const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
      await sendInternalEmail({
        templateName: "contact-message-internal",
        recipientEmail: "team@geocapitals.com",
        idempotencyKey: `collateral-lead:${row.id}`,
        templateData: {
          name: data.name,
          email: data.email.toLowerCase(),
          organization: data.phone || undefined,
          role: "investor",
          source: "inversion-colateral",
          message: `Monto: $${data.amountClp.toLocaleString("es-CL")} · Plazo: ${data.months} meses · Valle: ${data.projectPref ?? "indiferente"}\n\n${data.message ?? ""}`,
        },
      });
    } catch (e) {
      console.error("[collateral] notify failed", e);
    }
    return { ok: true as const };
  });

// ── Gestión del equipo ──────────────────────────────────────────────────────

export type CollateralLeadRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  amount_clp: number;
  months: number;
  project_pref: string | null;
  message: string | null;
  status: LeadStatus;
};

export const listCollateralLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("collateral_leads")
      .select(
        "id, created_at, name, email, phone, amount_clp, months, project_pref, message, status",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as CollateralLeadRow[];
  });

export const setCollateralLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(LEAD_STATUSES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("collateral_leads")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ── Sala de documentos legales ──────────────────────────────────────────────

export type CollateralDocRow = {
  id: string;
  project_key: (typeof PROJECTS)[number];
  doc_type: string;
  title: string;
  created_at: string;
  url: string | null;
};

export const getCollateralDataRoom = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const staff = await isStaff(context.supabase, context.userId);
    const sb = await admin();
    if (!staff) {
      const email = String((context.claims as { email?: string })?.email ?? "").toLowerCase();
      if (!email) return { access: false as const, staff: false, docs: [] as CollateralDocRow[] };
      const { data: lead } = await sb
        .from("collateral_leads")
        .select("id")
        .eq("email", email)
        .eq("status", "qualified")
        .limit(1)
        .maybeSingle();
      if (!lead) return { access: false as const, staff: false, docs: [] as CollateralDocRow[] };
    }
    const { data, error } = await sb
      .from("collateral_documents")
      .select("id, project_key, doc_type, title, created_at, storage_path")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const docs: CollateralDocRow[] = await Promise.all(
      (data ?? []).map(async (d) => {
        const { data: s } = await sb.storage.from(BUCKET).createSignedUrl(d.storage_path, 600);
        return {
          id: d.id,
          project_key: d.project_key as CollateralDocRow["project_key"],
          doc_type: d.doc_type,
          title: d.title,
          created_at: d.created_at,
          url: s?.signedUrl ?? null,
        };
      }),
    );
    return { access: true as const, staff, docs };
  });

export const createCollateralUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectKey: z.enum(PROJECTS),
        fileName: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `colateral/${data.projectKey}/${Date.now()}-${safe}`;
    const sb = await admin();
    const { data: up, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: up.token };
  });

export const registerCollateralDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectKey: z.enum(PROJECTS),
        docType: z.string().min(1).max(80),
        title: z.string().trim().min(1).max(200),
        path: z.string().startsWith("colateral/").max(400),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb.from("collateral_documents").insert({
      project_key: data.projectKey,
      doc_type: data.docType,
      title: data.title,
      storage_path: data.path,
      uploaded_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteCollateralDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = await admin();
    const { data: doc } = await sb
      .from("collateral_documents")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (doc) await sb.storage.from(BUCKET).remove([doc.storage_path]);
    const { error } = await sb.from("collateral_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
