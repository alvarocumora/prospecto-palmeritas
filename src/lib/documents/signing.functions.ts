import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GeneratedDoc } from "@/lib/documents/model";
import { signUrl as buildSignUrl } from "@/lib/publicUrl";
import {
  generateSignToken,
  isSignTokenFormat,
  signTokenPrefix,
  sha256Hex,
  docHash,
  buildSignatureHash,
  canSign,
  type SignRequestStatus,
} from "@/lib/documents/signing";

// Firma electrónica de documentos del editor: el dueño crea la solicitud (el
// token viaja en claro UNA vez) y la contraparte firma desde /firmar/$token
// sin cuenta. El flujo público valida el token por hash con service role.

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const DocSchema = z.object({
  docType: z.string(),
  title: z.string().min(1),
  reference: z.string().min(1),
  date: z.string(),
  blocks: z.array(z.record(z.string(), z.unknown())).min(1).max(100),
});

export type SignableDoc = z.infer<typeof DocSchema>;

// ---------- Dueño: crear solicitud ----------
const CreateInput = z.object({
  templateId: z.string().trim().min(1).max(40),
  doc: DocSchema,
  signerName: z.string().trim().max(120).optional(),
  signerEmail: z.string().trim().email().max(160).optional(),
});

export const createSignRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const token = generateSignToken();
    const generated = data.doc as GeneratedDoc;
    const { data: row, error } = await asSb(context.supabase)
      .from("document_sign_requests")
      .insert({
        created_by: context.userId as string,
        template_id: data.templateId,
        reference: generated.reference,
        title: generated.title,
        doc: generated,
        doc_hash: await docHash(generated),
        signer_name_expected: data.signerName ?? null,
        signer_email: data.signerEmail ?? null,
        token_prefix: signTokenPrefix(token),
        token_hash: await sha256Hex(token),
      })
      .select("id, expires_at")
      .single();
    if (error) throw new Error(error.message);

    // Notificar al firmante con el link (si dejó email). El correo nunca puede
    // romper la creación de la solicitud.
    let emailed = false;
    if (data.signerEmail && row) {
      try {
        const [{ sendInternalEmail }, { OWN_COMPANY }] = await Promise.all([
          import("@/lib/email/send-internal.server"),
          import("@/lib/documents/company"),
        ]);
        const res = await sendInternalEmail({
          templateName: "sign-request-signer",
          recipientEmail: data.signerEmail,
          idempotencyKey: `sign-request:${(row as { id: string }).id}`,
          templateData: {
            docTitle: generated.title,
            reference: generated.reference,
            senderCompany: OWN_COMPANY.name,
            signerName: data.signerName ?? undefined,
            expiresAt: (row as { expires_at: string | null }).expires_at
              ? new Date((row as { expires_at: string }).expires_at).toLocaleDateString("es-CL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : undefined,
            signUrl: `https://geocapitals.com/firmar/${token}`,
          },
        });
        emailed = res.ok && "queued" in res && res.queued === true;
      } catch (e) {
        console.error("[createSignRequest] notify signer failed", e);
      }
    }

    // Única vez que el token viaja en claro.
    return { token, emailed };
  });

// ---------- Dueño: listar / anular ----------
export type SignRequestRow = {
  id: string;
  template_id: string;
  reference: string;
  title: string;
  token_prefix: string;
  status: SignRequestStatus;
  signer_name_expected: string | null;
  signed_by_name: string | null;
  signed_at: string | null;
  expires_at: string;
  created_at: string;
};

export const listMySignRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SignRequestRow[]> => {
    const { data } = await asSb(context.supabase)
      .from("document_sign_requests")
      .select(
        "id, template_id, reference, title, token_prefix, status, signer_name_expected, signed_by_name, signed_at, expires_at, created_at",
      )
      .eq("created_by", context.userId as string)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as SignRequestRow[];
  });

export const voidSignRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await asSb(context.supabase)
      .from("document_sign_requests")
      .update({ status: "void" })
      .eq("id", data.id)
      .eq("created_by", context.userId as string)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Público: ver y firmar por token ----------
export type PublicSignRequest = {
  title: string;
  reference: string;
  doc: GeneratedDoc;
  status: SignRequestStatus;
  signerNameExpected: string | null;
  signedByName: string | null;
  signedAt: string | null;
  signatureHash: string | null;
  docHash: string;
  expiresAt: string;
};

const TokenInput = z.object({ token: z.string().trim().min(10).max(120) });

async function findByToken(sb: SupabaseClient, token: string) {
  if (!isSignTokenFormat(token)) return null;
  const tokenHash = await sha256Hex(token);
  const { data } = await sb
    .from("document_sign_requests")
    .select(
      "id, created_by, title, reference, doc, doc_hash, status, signer_name_expected, signed_by_name, signed_at, signature_hash, expires_at, token_hash",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();
  return data as
    | (Record<string, unknown> & { id: string; token_hash: string; status: SignRequestStatus })
    | null;
}

export const getSignRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenInput.parse(d))
  .handler(async ({ data }): Promise<PublicSignRequest | null> => {
    const sb = serviceClient();
    if (!sb) return null;
    const row = await findByToken(sb, data.token);
    if (!row) return null;
    return {
      title: String(row.title),
      reference: String(row.reference),
      doc: row.doc as GeneratedDoc,
      status: row.status,
      signerNameExpected: (row.signer_name_expected ?? null) as string | null,
      signedByName: (row.signed_by_name ?? null) as string | null,
      signedAt: (row.signed_at ?? null) as string | null,
      signatureHash: (row.signature_hash ?? null) as string | null,
      docHash: String(row.doc_hash),
      expiresAt: String(row.expires_at),
    };
  });

const SignInput = z.object({
  token: z.string().trim().min(10).max(120),
  signerName: z.string().trim().min(3).max(120),
  accepted: z.literal(true),
});

export const submitSignature = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SignInput.parse(d))
  .handler(async ({ data }) => {
    const sb = serviceClient();
    if (!sb) throw new Error("Servicio no disponible.");
    const row = await findByToken(sb, data.token);
    if (!row) throw new Error("Link de firma inválido.");

    const check = canSign(row.status, String(row.expires_at), new Date());
    if (!check.ok) throw new Error(check.error);

    const signedAtIso = new Date().toISOString();
    const signatureHash = await buildSignatureHash({
      docHash: String(row.doc_hash),
      signerName: data.signerName,
      signedAtIso,
      tokenHash: row.token_hash,
    });

    // Condición status=pending en el UPDATE para evitar doble firma en carrera.
    const { data: updated, error } = await sb
      .from("document_sign_requests")
      .update({
        status: "signed",
        signed_by_name: data.signerName,
        signed_at: signedAtIso,
        signature_hash: signatureHash,
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("El documento ya fue firmado o anulado.");

    // Avisar al dueño de la solicitud que su documento fue firmado.
    try {
      const { data: prof } = await sb
        .from("profiles")
        .select("email")
        .eq("user_id", String(row.created_by))
        .maybeSingle();
      if (prof?.email) {
        const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
        await sendInternalEmail({
          templateName: "sign-completed-owner",
          recipientEmail: prof.email,
          idempotencyKey: `sign-completed:${row.id}`,
          templateData: {
            docTitle: String(row.title),
            reference: String(row.reference),
            signedByName: data.signerName,
            signedAt: new Date(signedAtIso).toLocaleString("es-CL", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        });
      }
    } catch (e) {
      console.error("[submitSignature] notify owner failed", e);
    }

    return { signedAt: signedAtIso, signatureHash };
  });
