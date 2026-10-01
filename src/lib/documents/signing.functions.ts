import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAnyModuleRole } from "@/lib/access/roleMiddleware";
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
import { DOC_BY_KEY } from "@/lib/tradeDocuments";

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
  /** Trade al que pertenece el documento: al firmarse queda en su trazabilidad. */
  tradeId: z.string().uuid().optional(),
});

export const createSignRequest = createServerFn({ method: "POST" })
  .middleware([requireAnyModuleRole])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const token = generateSignToken();
    const generated = data.doc as GeneratedDoc;
    const baseRow = {
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
    };
    const sb0 = asSb(context.supabase);
    const insertRow = (
      data.tradeId ? { ...baseRow, trade_id: data.tradeId } : baseRow
    ) as typeof baseRow;
    let ins = await sb0
      .from("document_sign_requests")
      .insert(insertRow)
      .select("id, expires_at")
      .single();
    // Fallback pre-migración: si trade_id aún no existe como columna, se crea
    // la solicitud sin vínculo (el flujo de firma no puede quedar bloqueado).
    if (ins.error && data.tradeId && /trade_id|schema cache|column/i.test(ins.error.message)) {
      ins = await sb0
        .from("document_sign_requests")
        .insert(baseRow)
        .select("id, expires_at")
        .single();
    }
    const { data: row, error } = ins;
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
            signUrl: buildSignUrl(token),
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
  /** Trade vinculado (trazabilidad de la firma). */
  trade_id: string | null;
  trade_reference: string | null;
};

export const listMySignRequests = createServerFn({ method: "GET" })
  .middleware([requireAnyModuleRole])
  .handler(async ({ context }): Promise<SignRequestRow[]> => {
    const sb = asSb(context.supabase);
    // select * tolera pre-migración de trade_id sin romper el listado.
    const { data } = await sb
      .from("document_sign_requests")
      .select("*")
      .eq("created_by", context.userId as string)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const tradeIds = Array.from(
      new Set(rows.map((r) => r.trade_id).filter((v): v is string => typeof v === "string")),
    );
    const refs = new Map<string, string | null>();
    if (tradeIds.length > 0) {
      const { data: trades } = await sb
        .from("commodity_trades")
        .select("id, reference")
        .in("id", tradeIds);
      for (const t of (trades ?? []) as Array<{ id: string; reference: string | null }>) {
        refs.set(t.id, t.reference);
      }
    }
    return rows.map((r) => ({
      id: String(r.id),
      template_id: String(r.template_id),
      reference: String(r.reference),
      title: String(r.title),
      token_prefix: String(r.token_prefix),
      status: r.status as SignRequestStatus,
      signer_name_expected: (r.signer_name_expected ?? null) as string | null,
      signed_by_name: (r.signed_by_name ?? null) as string | null,
      signed_at: (r.signed_at ?? null) as string | null,
      expires_at: String(r.expires_at),
      created_at: String(r.created_at),
      trade_id: (r.trade_id ?? null) as string | null,
      trade_reference: r.trade_id ? (refs.get(String(r.trade_id)) ?? null) : null,
    }));
  });

export const voidSignRequest = createServerFn({ method: "POST" })
  .middleware([requireAnyModuleRole])
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
export type FlowSignatureStamp = {
  order: number;
  role: string | null;
  signerNameExpected: string | null;
  signedByName: string;
  signedAt: string;
  signatureHash: string;
};

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
  /** Índice de la parte que corresponde a ESTE firmante (0-based). Coincide
   *  con la posición del slot en el bloque `signature` del documento. */
  signOrder: number;
  /** Todas las firmas ya completadas del mismo flujo (multi-parte). Se usa
   *  al renderizar el PDF final para estampar cada firma en su slot. */
  flowSignatures: FlowSignatureStamp[];
};

const TokenInput = z.object({ token: z.string().trim().min(10).max(120) });

async function findByToken(sb: SupabaseClient, token: string) {
  if (!isSignTokenFormat(token)) return null;
  const tokenHash = await sha256Hex(token);
  // select * para tolerar columnas nuevas aún no migradas (ej. trade_id):
  // el flujo público de firma jamás puede romperse por un select explícito.
  const { data } = await sb
    .from("document_sign_requests")
    .select("*")
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

    const signOrder = Number(row.sign_order ?? 0);

    // Cuando el documento tiene múltiples firmantes (flow_id), recuperamos
    // TODAS las firmas ya completadas para poder estamparlas en el PDF final
    // en su slot correspondiente (cada firmante en su propia parte).
    let flowSignatures: FlowSignatureStamp[] = [];
    if (row.flow_id) {
      const { data: siblings } = await sb
        .from("document_sign_requests")
        .select(
          "sign_order, signer_role, signer_name_expected, signed_by_name, signed_at, signature_hash, status",
        )
        .eq("flow_id", String(row.flow_id))
        .eq("status", "signed");
      flowSignatures = ((siblings ?? []) as Array<Record<string, unknown>>)
        .filter((r) => r.signed_by_name && r.signed_at && r.signature_hash)
        .map((r) => ({
          order: Number(r.sign_order ?? 0),
          role: (r.signer_role ?? null) as string | null,
          signerNameExpected: (r.signer_name_expected ?? null) as string | null,
          signedByName: String(r.signed_by_name),
          signedAt: String(r.signed_at),
          signatureHash: String(r.signature_hash),
        }))
        .sort((a, b) => a.order - b.order);
    } else if (row.status === "signed" && row.signed_by_name && row.signed_at) {
      flowSignatures = [
        {
          order: signOrder,
          role: (row.signer_role ?? null) as string | null,
          signerNameExpected: (row.signer_name_expected ?? null) as string | null,
          signedByName: String(row.signed_by_name),
          signedAt: String(row.signed_at),
          signatureHash: String(row.signature_hash ?? row.doc_hash ?? ""),
        },
      ];
    }

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
      signOrder,
      flowSignatures,
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

    // Trazabilidad: si el documento pertenece a un trade, el evento de firma
    // entra a trade_events y aparece en el timeline unificado de la operación.
    if (row.trade_id) {
      const tradeId = String(row.trade_id);
      try {
        await sb.from("trade_events").insert({
          trade_id: tradeId,
          actor_user_id: String(row.created_by),
          kind: "doc_signed",
          doc_type: String(row.template_id ?? "doc"),
          detail: `${String(row.title)} firmado por ${data.signerName}`,
        });
      } catch (e) {
        console.error("[submitSignature] trade event failed", e);
      }

      // Si la plantilla corresponde a un documento del catálogo del trade
      // (icpo, fco, loi, spa…), reflejar la firma en el checklist documental:
      // el avance del deal se actualiza sin recarga manual.
      const docType = String(row.template_id ?? "");
      const cat = DOC_BY_KEY[docType];
      if (cat) {
        try {
          const { data: existing } = await sb
            .from("trade_documents")
            .select("id")
            .eq("trade_id", tradeId)
            .eq("doc_type", docType)
            .limit(1)
            .maybeSingle();
          if (existing) {
            await sb
              .from("trade_documents")
              .update({ status: "signed", signed_at: signedAtIso })
              .eq("id", (existing as { id: string }).id);
          } else {
            await sb.from("trade_documents").insert({
              trade_id: tradeId,
              created_by: String(row.created_by),
              doc_type: docType,
              phase: cat.phase,
              status: "signed",
              reference: String(row.reference ?? ""),
              signed_at: signedAtIso,
            });
          }
        } catch (e) {
          console.error("[submitSignature] trade_documents sync failed", e);
        }
      }
    }

    // Avisar al dueño de la solicitud y a la bandeja de operaciones de
    // Geocapitals que el documento fue firmado. Geocapitals opera cada deal, así
    // que recibe copia de toda firma para mantener trazabilidad del trade.
    try {
      const { data: prof } = await sb
        .from("profiles")
        .select("email")
        .eq("user_id", String(row.created_by))
        .maybeSingle();

      const signedAtLabel = new Date(signedAtIso).toLocaleString("es-CL", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const dealReference = (row.trade_reference as string | null) ?? undefined;

      const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
      const { GEOCAPITALS_NOTIFY_EMAIL } = await import("@/lib/documents/company");

      if (prof?.email) {
        await sendInternalEmail({
          templateName: "sign-completed-owner",
          recipientEmail: prof.email,
          idempotencyKey: `sign-completed:${row.id}`,
          templateData: {
            docTitle: String(row.title),
            reference: String(row.reference),
            signedByName: data.signerName,
            signedAt: signedAtLabel,
          },
        });
      }

      // Copia interna a Geocapitals (el template fija `to`; recipientEmail es
      // sólo fallback). Idempotencia propia para no chocar con el aviso al dueño.
      await sendInternalEmail({
        templateName: "sign-completed-internal",
        recipientEmail: GEOCAPITALS_NOTIFY_EMAIL,
        idempotencyKey: `sign-completed-internal:${row.id}`,
        templateData: {
          docTitle: String(row.title),
          reference: String(row.reference),
          dealReference,
          signedByName: data.signerName,
          signedAt: signedAtLabel,
          ownerEmail: prof?.email ?? undefined,
        },
      });
    } catch (e) {
      console.error("[submitSignature] notify owner/geocapitals failed", e);
    }

    return { signedAt: signedAtIso, signatureHash };
  });

// ---------- Público: verificación de integridad por firmante ----------
// Recomputa el signature_hash esperado para cada firma completada del mismo
// flujo (o de la solicitud individual) a partir de los campos almacenados
// (doc_hash, signer_name, signed_at, token_hash) y lo compara contra el hash
// persistido. Permite a la contraparte comprobar por sí misma que ninguna
// firma fue alterada después de emitida, y que cada firma coincide con su
// signOrder (parte) declarada en el documento.
export type SignatureVerification = {
  order: number;
  role: string | null;
  signerNameExpected: string | null;
  signedByName: string;
  signedAt: string;
  storedHash: string;
  expectedHash: string;
  hashMatch: boolean;
  orderMatch: boolean; // el signOrder cae dentro del rango de partes del documento
};

export const verifyFlowSignatures = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenInput.parse(d))
  .handler(async ({ data }): Promise<SignatureVerification[]> => {
    const sb = serviceClient();
    if (!sb) return [];
    const row = await findByToken(sb, data.token);
    if (!row) return [];

    // Partes declaradas en el documento (bloque signature): usadas para
    // validar que cada signOrder cae dentro del rango de partes esperadas.
    const doc = row.doc as GeneratedDoc;
    const sigBlock = doc?.blocks?.find((b) => (b as { kind?: string }).kind === "signature") as
      { kind: "signature"; parties: string[] } | undefined;
    const partiesCount = sigBlock?.parties?.length ?? 0;

    // Todas las filas del flujo (o la única fila si no hay flow_id) que ya
    // hayan sido firmadas: se recomputa el hash de cada una con sus propios
    // token_hash + doc_hash, sin depender de datos del cliente.
    const query = sb
      .from("document_sign_requests")
      .select(
        "sign_order, signer_role, signer_name_expected, signed_by_name, signed_at, signature_hash, doc_hash, token_hash, status",
      )
      .eq("status", "signed");
    const { data: siblings } = row.flow_id
      ? await query.eq("flow_id", String(row.flow_id))
      : await query.eq("id", String(row.id));

    const out: SignatureVerification[] = [];
    for (const r of (siblings ?? []) as Array<Record<string, unknown>>) {
      if (!r.signed_by_name || !r.signed_at || !r.signature_hash) continue;
      const order = Number(r.sign_order ?? 0);
      const expected = await buildSignatureHash({
        docHash: String(r.doc_hash),
        signerName: String(r.signed_by_name),
        signedAtIso: String(r.signed_at),
        tokenHash: String(r.token_hash),
      });
      out.push({
        order,
        role: (r.signer_role ?? null) as string | null,
        signerNameExpected: (r.signer_name_expected ?? null) as string | null,
        signedByName: String(r.signed_by_name),
        signedAt: String(r.signed_at),
        storedHash: String(r.signature_hash),
        expectedHash: expected,
        hashMatch: String(r.signature_hash) === expected,
        orderMatch: partiesCount === 0 ? true : order >= 0 && order < partiesCount,
      });
    }
    return out.sort((a, b) => a.order - b.order);
  });

// ═════════════════════════════════════════════════════════════════════════
// FLUJO ORDENADO (multi-firmante): agrupa N solicitudes bajo un mismo
// flow_id con sign_order estricto. Cada firmante tiene su propio token, y
// se puede REINTENTAR/actualizar la información de un firmante pendiente
// (nombre/email + nuevo token) sin afectar a los ya firmados.
// ═════════════════════════════════════════════════════════════════════════

const FlowInput = z.object({
  templateId: z.string().trim().min(1).max(40),
  doc: DocSchema,
  tradeId: z.string().uuid().optional(),
  signers: z
    .array(
      z.object({
        role: z.string().trim().max(80).optional(),
        name: z.string().trim().max(120).optional(),
        email: z.string().trim().email().max(160).optional(),
      }),
    )
    .min(1)
    .max(6),
});

export const createSignFlow = createServerFn({ method: "POST" })
  .middleware([requireAnyModuleRole])
  .inputValidator((d: unknown) => FlowInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const generated = data.doc as GeneratedDoc;
    const flowId = globalThis.crypto.randomUUID();
    const hash = await docHash(generated);

    const rows: Array<Record<string, unknown>> = [];
    const tokens: Array<{ order: number; role: string | null; token: string }> = [];

    for (let i = 0; i < data.signers.length; i++) {
      const s = data.signers[i];
      const token = generateSignToken();
      tokens.push({ order: i, role: s.role ?? null, token });
      rows.push({
        created_by: context.userId as string,
        template_id: data.templateId,
        reference: generated.reference,
        title: generated.title,
        doc: generated,
        doc_hash: hash,
        signer_name_expected: s.name ?? null,
        signer_email: s.email ?? null,
        token_prefix: signTokenPrefix(token),
        token_hash: await sha256Hex(token),
        flow_id: flowId,
        sign_order: i,
        signer_role: s.role ?? null,
        ...(data.tradeId ? { trade_id: data.tradeId } : {}),
      });
    }

    const { data: inserted, error } = await sb
      .from("document_sign_requests")
      .insert(rows)
      .select("id, sign_order");
    if (error) throw new Error(error.message);

    // Notificar sólo al primer firmante (los siguientes se avisan al firmar el anterior).
    const first = data.signers[0];
    if (first?.email) {
      try {
        const [{ sendInternalEmail }, { OWN_COMPANY }] = await Promise.all([
          import("@/lib/email/send-internal.server"),
          import("@/lib/documents/company"),
        ]);
        await sendInternalEmail({
          templateName: "sign-request-signer",
          recipientEmail: first.email,
          idempotencyKey: `sign-flow:${flowId}:0`,
          templateData: {
            docTitle: generated.title,
            reference: generated.reference,
            senderCompany: OWN_COMPANY.name,
            signerName: first.name ?? undefined,
            signUrl: buildSignUrl(tokens[0].token),
          },
        });
      } catch (e) {
        console.error("[createSignFlow] notify first signer failed", e);
      }
    }

    return {
      flowId,
      tokens, // única vez que viajan en claro
      requestIds: (inserted ?? []) as Array<{ id: string; sign_order: number }>,
    };
  });

export type SignFlowSignerRow = {
  id: string;
  order: number;
  role: string | null;
  status: SignRequestStatus;
  signerNameExpected: string | null;
  signerEmail: string | null;
  tokenPrefix: string;
  signedByName: string | null;
  signedAt: string | null;
  expiresAt: string;
  hasContactInfo: boolean;
};

export type SignFlowSummary = {
  flowId: string;
  templateId: string;
  reference: string;
  title: string;
  tradeId: string | null;
  signers: SignFlowSignerRow[];
  currentOrder: number | null; // siguiente pendiente
  completed: boolean;
};

function summarize(rows: Array<Record<string, unknown>>): SignFlowSummary | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => Number(a.sign_order ?? 0) - Number(b.sign_order ?? 0));
  const signers: SignFlowSignerRow[] = sorted.map((r) => ({
    id: String(r.id),
    order: Number(r.sign_order ?? 0),
    role: (r.signer_role ?? null) as string | null,
    status: r.status as SignRequestStatus,
    signerNameExpected: (r.signer_name_expected ?? null) as string | null,
    signerEmail: (r.signer_email ?? null) as string | null,
    tokenPrefix: String(r.token_prefix),
    signedByName: (r.signed_by_name ?? null) as string | null,
    signedAt: (r.signed_at ?? null) as string | null,
    expiresAt: String(r.expires_at),
    hasContactInfo: Boolean(r.signer_name_expected || r.signer_email),
  }));
  const next = signers.find((s) => s.status === "pending");
  return {
    flowId: String(sorted[0].flow_id),
    templateId: String(sorted[0].template_id),
    reference: String(sorted[0].reference),
    title: String(sorted[0].title),
    tradeId: (sorted[0].trade_id ?? null) as string | null,
    signers,
    currentOrder: next ? next.order : null,
    completed: signers.every((s) => s.status === "signed"),
  };
}

export const getMySignFlow = createServerFn({ method: "POST" })
  .middleware([requireAnyModuleRole])
  .inputValidator((d: unknown) => z.object({ flowId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SignFlowSummary | null> => {
    const { data: rows } = await asSb(context.supabase)
      .from("document_sign_requests")
      .select("*")
      .eq("flow_id", data.flowId)
      .eq("created_by", context.userId as string);
    return summarize((rows ?? []) as Array<Record<string, unknown>>);
  });

// Reintento: actualiza nombre/email de un firmante pendiente y regenera el
// token (invalidando el anterior). El token nuevo se retorna una única vez.
const RetryInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(160).optional(),
  regenerateToken: z.boolean().default(true),
});

export const retrySigner = createServerFn({ method: "POST" })
  .middleware([requireAnyModuleRole])
  .inputValidator((d: unknown) => RetryInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    // Verifica que sea del owner y esté pendiente.
    const { data: row, error: readErr } = await sb
      .from("document_sign_requests")
      .select("id, status, flow_id, sign_order")
      .eq("id", data.id)
      .eq("created_by", context.userId as string)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!row) throw new Error("Solicitud no encontrada.");
    if (row.status !== "pending")
      throw new Error("Sólo se puede reintentar un firmante pendiente.");

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.signer_name_expected = data.name || null;
    if (data.email !== undefined) patch.signer_email = data.email || null;

    let newToken: string | null = null;
    if (data.regenerateToken) {
      newToken = generateSignToken();
      patch.token_prefix = signTokenPrefix(newToken);
      patch.token_hash = await sha256Hex(newToken);
      // Extiende 30 días al regenerar.
      patch.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { error } = await sb
      .from("document_sign_requests")
      .update(patch)
      .eq("id", data.id)
      .eq("created_by", context.userId as string)
      .eq("status", "pending");
    if (error) throw new Error(error.message);

    // Reenviar email si hay dirección y token nuevo.
    if (newToken && data.email) {
      try {
        const [{ sendInternalEmail }, { OWN_COMPANY }] = await Promise.all([
          import("@/lib/email/send-internal.server"),
          import("@/lib/documents/company"),
        ]);
        await sendInternalEmail({
          templateName: "sign-request-signer",
          recipientEmail: data.email,
          idempotencyKey: `sign-retry:${data.id}:${Date.now()}`,
          templateData: {
            docTitle: "Documento pendiente de firma",
            reference: String(row.id).slice(0, 8),
            senderCompany: OWN_COMPANY.name,
            signerName: data.name ?? undefined,
            signUrl: buildSignUrl(newToken),
          },
        });
      } catch (e) {
        console.error("[retrySigner] email failed", e);
      }
    }

    return { ok: true, token: newToken };
  });

// Anula todas las solicitudes pendientes de un flow (owner). Útil para
// re-sincronizar orden/firmantes cuando el flujo se envió con orden incorrecto
// y hay que emitir uno nuevo alineado a las partes del contrato. Las filas ya
// firmadas se conservan como evidencia auditable.
export const voidSignFlow = createServerFn({ method: "POST" })
  .middleware([requireAnyModuleRole])
  .inputValidator((d: unknown) => z.object({ flowId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const { data: rows, error } = await sb
      .from("document_sign_requests")
      .update({ status: "void" })
      .eq("flow_id", data.flowId)
      .eq("created_by", context.userId as string)
      .eq("status", "pending")
      .select("id");
    if (error) throw new Error(error.message);
    return { voided: rows?.length ?? 0 };
  });
