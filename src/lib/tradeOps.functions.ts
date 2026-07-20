// Panel espejo de contraparte (War Room público por token).
// El dueño autenticado del trade emite un link único para su contraparte
// (comprador o vendedor externo). El link permite ver estado, documentos,
// timeline y subir archivos sin cuenta. Solo se persiste el hash del token.

import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex } from "@/lib/documents/signing";
import { tokenPrefix } from "@/lib/sourcing";
import { publicUrl } from "@/lib/publicUrl";

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export const OPERACION_TOKEN_PREFIX = "gcops_";

function newOpsToken(): string {
  const arr = new Uint8Array(32);
  globalThis.crypto.getRandomValues(arr);
  const hex = Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${OPERACION_TOKEN_PREFIX}${hex}`;
}

function isOpsTokenFormat(t: string): boolean {
  return new RegExp(`^${OPERACION_TOKEN_PREFIX}[0-9a-f]{64}$`).test(t);
}

export const operacionUrl = (token: string) => publicUrl(`/operacion/${token}`);

function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---------- Autenticado: generar / regenerar link de contraparte ----------
export const ensureCounterpartyLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tradeId: z.string().uuid(),
        party: z.enum(["buyer", "seller"]),
        email: z.string().trim().email().max(160).optional(),
        rotate: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ url: string; prefix: string }> => {
    const sb = asSb(context.supabase);
    const hashCol = data.party === "buyer" ? "counterparty_buyer_token_hash" : "counterparty_seller_token_hash";
    const prefCol = data.party === "buyer" ? "counterparty_buyer_token_prefix" : "counterparty_seller_token_prefix";
    const emailCol = data.party === "buyer" ? "counterparty_buyer_email" : "counterparty_seller_email";

    const { data: existing } = await sb
      .from("commodity_trades")
      .select(`id, ${hashCol}, ${prefCol}`)
      .eq("id", data.tradeId)
      .maybeSingle();
    if (!existing) throw new Error("Trade no encontrado o sin acceso.");
    const row = existing as Record<string, string | null>;

    const shouldRotate = data.rotate || !row[hashCol];
    let token: string | null = null;
    let prefix: string;

    if (shouldRotate) {
      token = newOpsToken();
      prefix = tokenPrefix(token);
      const upd: Record<string, string | null> = {
        [hashCol]: await sha256Hex(token),
        [prefCol]: prefix,
      };
      if (data.email) upd[emailCol] = data.email;
      const { error } = await sb.from("commodity_trades").update(upd).eq("id", data.tradeId);
      if (error) throw new Error(error.message);
    } else {
      prefix = row[prefCol] ?? "";
      if (data.email) {
        await sb.from("commodity_trades").update({ [emailCol]: data.email }).eq("id", data.tradeId);
      }
    }

    // Evento de auditoría (best-effort).
    try {
      await sb.from("trade_events").insert({
        trade_id: data.tradeId,
        actor_user_id: context.userId,
        kind: shouldRotate ? "counterparty_link_issued" : "counterparty_link_shared",
        detail: `Link de panel espejo (${data.party}) ${shouldRotate ? "emitido" : "reutilizado"}${data.email ? ` · ${data.email}` : ""}`,
      });
    } catch {
      /* noop */
    }

    // Al rotar retornamos URL con token; si no rotó, retornamos solo el prefix
    // (el token completo ya no existe en claro).
    return {
      url: token ? operacionUrl(token) : "",
      prefix,
    };
  });

// ---------- Público: contraparte accede al War Room con su token ----------
export type OperacionPayload = {
  role: "buyer" | "seller";
  tradeId: string;
  trade: {
    reference: string | null;
    commodity: string | null;
    quantity_t: number | null;
    incoterm: string | null;
    unit_price_usd: number | null;
    total_value_usd: number | null;
    stage: string;
    status: string;
    created_at: string;
  };
  counterparty: { name: string | null; company: string | null };
  events: Array<{ kind: string; detail: string | null; created_at: string }>;
  shipments: Array<{
    reference: string | null;
    vessel_name: string | null;
    port_loading: string | null;
    port_discharge: string | null;
    eta: string | null;
    status: string;
  }>;
  docsCount: number;
  documents: Array<{
    doc_type: string;
    status: string;
    file_name: string | null;
    reference: string | null;
    updated_at: string;
  }>;
};

export const getOperacionByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(120) }).parse(d))
  .handler(async ({ data }): Promise<OperacionPayload | null> => {
    if (!isOpsTokenFormat(data.token)) return null;
    const sb = serviceClient();
    if (!sb) return null;

    const hash = await sha256Hex(data.token);
    const { data: byBuyer } = await sb
      .from("commodity_trades")
      .select(
        "id, reference, commodity, quantity_t, incoterm, unit_price_usd, total_value_usd, stage, status, created_at, counterparty_name, counterparty_company",
      )
      .eq("counterparty_buyer_token_hash", hash)
      .maybeSingle();
    let role: "buyer" | "seller" | null = byBuyer ? "buyer" : null;
    let trade = byBuyer as Record<string, unknown> | null;
    if (!trade) {
      const { data: bySeller } = await sb
        .from("commodity_trades")
        .select(
          "id, reference, commodity, quantity_t, incoterm, unit_price_usd, total_value_usd, stage, status, created_at, counterparty_name, counterparty_company",
        )
        .eq("counterparty_seller_token_hash", hash)
        .maybeSingle();
      trade = bySeller as Record<string, unknown> | null;
      role = bySeller ? "seller" : null;
    }
    if (!trade || !role) return null;
    const tradeId = trade.id as string;

    const [events, shipments, docsCountQ, docsList] = await Promise.all([
      sb
        .from("trade_events")
        .select("kind, detail, created_at")
        .eq("trade_id", tradeId)
        .order("created_at", { ascending: true })
        .limit(200),
      sb
        .from("trade_shipments")
        .select("reference, vessel_name, port_loading, port_discharge, eta, status")
        .eq("trade_id", tradeId)
        .order("created_at", { ascending: false }),
      sb.from("trade_documents").select("id", { count: "exact", head: true }).eq("trade_id", tradeId),
      sb
        .from("trade_documents")
        .select("doc_type, status, file_url, reference, updated_at")
        .eq("trade_id", tradeId)
        .order("updated_at", { ascending: false }),
    ]);

    const documents = ((docsList.data ?? []) as Array<{
      doc_type: string;
      status: string;
      file_url: string | null;
      reference: string | null;
      updated_at: string;
    }>).map((d) => ({
      doc_type: d.doc_type,
      status: d.status,
      reference: d.reference,
      updated_at: d.updated_at,
      // Solo exponemos el nombre de archivo, no la ruta interna del bucket.
      file_name: d.file_url ? d.file_url.split("/").pop() ?? null : null,
    }));

    return {
      role,
      tradeId,
      trade: {
        reference: (trade.reference as string) ?? null,
        commodity: (trade.commodity as string) ?? null,
        quantity_t: (trade.quantity_t as number) ?? null,
        incoterm: (trade.incoterm as string) ?? null,
        unit_price_usd: (trade.unit_price_usd as number) ?? null,
        total_value_usd: (trade.total_value_usd as number) ?? null,
        stage: String(trade.stage ?? ""),
        status: String(trade.status ?? ""),
        created_at: String(trade.created_at ?? ""),
      },
      counterparty: {
        name: (trade.counterparty_name as string) ?? null,
        company: (trade.counterparty_company as string) ?? null,
      },
      events: (events.data ?? []) as OperacionPayload["events"],
      shipments: (shipments.data ?? []) as OperacionPayload["shipments"],
      docsCount: docsCountQ.count ?? 0,
      documents,
    };
  });

// ---------- Público: subida de documentos por la contraparte (sin cuenta) ----

const TRADE_BUCKET_PUB = "trade-docs";

async function resolveTradeByToken(
  token: string,
): Promise<{
  tradeId: string;
  role: "buyer" | "seller";
  ownerId: string;
  sb: SupabaseClient;
} | null> {
  if (!isOpsTokenFormat(token)) return null;
  const sb = serviceClient();
  if (!sb) return null;
  const hash = await sha256Hex(token);
  const { data: b } = await sb
    .from("commodity_trades")
    .select("id, created_by")
    .eq("counterparty_buyer_token_hash", hash)
    .maybeSingle();
  if (b) {
    const r = b as { id: string; created_by: string };
    return { tradeId: r.id, role: "buyer", ownerId: r.created_by, sb };
  }
  const { data: s } = await sb
    .from("commodity_trades")
    .select("id, created_by")
    .eq("counterparty_seller_token_hash", hash)
    .maybeSingle();
  if (s) {
    const r = s as { id: string; created_by: string };
    return { tradeId: r.id, role: "seller", ownerId: r.created_by, sb };
  }
  return null;
}


/** Prepara URL firmada para que la contraparte externa suba un archivo al bucket
 *  privado `trade-docs` sin necesitar cuenta. */
export const requestOperacionUpload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(10).max(120),
        fileName: z.string().min(1).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ctx = await resolveTradeByToken(data.token);
    if (!ctx) throw new Error("Enlace no válido.");
    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${ctx.tradeId}/counterparty/${crypto.randomUUID()}-${safe}`;
    const { data: signed, error } = await ctx.sb.storage
      .from(TRADE_BUCKET_PUB)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "No se pudo preparar la subida.");
    return { path, token: signed.token, bucket: TRADE_BUCKET_PUB };
  });

/** Registra en `trade_documents` el archivo que la contraparte externa acaba
 *  de subir, marcando el documento como `uploaded` y añadiendo un evento al
 *  timeline atribuido a "contraparte". */
export const attachOperacionDoc = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(10).max(120),
        docType: z.string().trim().min(1).max(60),
        filePath: z.string().min(1).max(500),
        reference: z.string().trim().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ctx = await resolveTradeByToken(data.token);
    if (!ctx) throw new Error("Enlace no válido.");
    // Debe apuntar al bucket del propio trade.
    if (!data.filePath.startsWith(`${ctx.tradeId}/`)) {
      throw new Error("Ruta inválida.");
    }
    const { data: existing } = await ctx.sb
      .from("trade_documents")
      .select("id")
      .eq("trade_id", ctx.tradeId)
      .eq("doc_type", data.docType)
      .maybeSingle();
    if (existing) {
      const { error } = await ctx.sb
        .from("trade_documents")
        .update({
          file_url: data.filePath,
          reference: data.reference ?? null,
          status: "uploaded",
        })
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await ctx.sb.from("trade_documents").insert({
        trade_id: ctx.tradeId,
        doc_type: data.docType,
        status: "uploaded",
        file_url: data.filePath,
        reference: data.reference ?? null,
      });
      if (error) throw new Error(error.message);
    }
    try {
      await ctx.sb.from("trade_events").insert({
        trade_id: ctx.tradeId,
        actor_user_id: null,
        kind: "doc_uploaded_by_counterparty",
        detail: `Contraparte (${ctx.role}) cargó documento`,
        doc_type: data.docType,
      });
    } catch {
      /* auxiliary */
    }
    return { ok: true };
  });

