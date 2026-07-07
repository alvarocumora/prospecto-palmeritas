import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  scoreLotVerification,
  classifyLegalStatus,
  type VerificationSignals,
  type LegalBreakdown,
  type LotVerificationResult,
} from "@/lib/lotVerification";

// Agente Know-Your-Mine: cruza un lote de commodity contra la columna
// catastral-legal (proyecto → concesiones → SERNAGEOMIN / remates / boletín) y
// devuelve un score de confianza con evidencia. La verificación es pública
// (datos catastrales son públicos y el lote está publicado), sin auth.

export type LotVerification = LotVerificationResult & {
  lotId: string;
  checkedAt: string;
  concessionCodes: string[];
  /** Dictamen narrativo generado por IA (opcional; null si no hay gateway). */
  dictamen: string | null;
};

const input = z.object({ lotId: z.string().uuid() });

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** ¿El nombre del vendedor (org) se parece al titular de alguna concesión? */
function matchTitular(
  orgName: string | null,
  holders: Array<string | null>,
): VerificationSignals["titularMatch"] {
  const o = norm(orgName);
  if (!o || o.length < 4) return "unknown";
  const names = holders.map(norm).filter(Boolean);
  if (names.length === 0) return "unknown";
  const hit = names.some((h) => h.includes(o) || o.includes(h));
  return hit ? "match" : "mismatch";
}

async function aiDictamen(
  result: LotVerificationResult,
  concessionCount: number,
): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      signal: AbortSignal.timeout(9000),
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Eres analista de due diligence minero. En 2-3 frases en español, resume el nivel de confianza del lote para un comprador y la acción más importante a tomar. Usa SOLO los factores entregados; no inventes datos ni cifras.",
          },
          {
            role: "user",
            content: JSON.stringify({
              score: result.score,
              nivel: result.levelLabel,
              concesiones: concessionCount,
              factores: result.factors.map((f) => ({ f: f.label, e: f.status, d: f.detail })),
            }),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

export const verifyCommodityLot = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<LotVerification | null> => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    // Cliente sin tipar: patent_remates es nueva (no está en types.ts).
    const sb = createClient(url, key, { auth: { persistSession: false } });

    const { data: lot } = await sb
      .from("commodity_lots")
      .select(
        "id, project_id, organization_id, assay_report_url, deleterious_json, certifications_json, origin_geojson",
      )
      .eq("id", data.lotId)
      .maybeSingle();
    if (!lot) return null;

    // Concesiones del proyecto vinculado.
    let concessions: Array<{
      code: string | null;
      holder: string | null;
      rut_holder: string | null;
      status: string | null;
    }> = [];
    if (lot.project_id) {
      const { data: rows } = await sb
        .from("mining_concessions")
        .select("code, holder, rut_holder, status")
        .eq("project_id", lot.project_id);
      concessions = rows ?? [];
    }
    const codes = concessions.map((c) => c.code).filter((c): c is string => !!c);

    // Legal aggregation desde el status local sincronizado.
    const legal: LegalBreakdown = { constituidas: 0, enTramite: 0, eliminadas: 0, unknown: 0 };
    for (const c of concessions) legal[classifyLegalStatus(c.status)] += 1;

    // Cruces autoritativos: nómina de remates y boletín (por código).
    let remateCount = 0;
    let bulletinCount = 0;
    if (codes.length) {
      const { data: remates } = await sb
        .from("patent_remates")
        .select("concession_code")
        .in("concession_code", codes);
      remateCount = new Set((remates ?? []).map((r) => r.concession_code)).size;

      const { data: bulletins } = await sb
        .from("mining_bulletins")
        .select("concession_code, publication_type")
        .in("concession_code", codes)
        .in("publication_type", ["caducidad", "remate", "eliminacion"]);
      bulletinCount = new Set((bulletins ?? []).map((b) => b.concession_code)).size;
    }

    // Identidad del vendedor (nombre de la organización) para el match de titular.
    let orgName: string | null = null;
    if (lot.organization_id) {
      const { data: org } = await sb
        .from("organizations")
        .select("name")
        .eq("id", lot.organization_id)
        .maybeSingle();
      orgName = org?.name ?? null;
    }

    const deleterious = lot.deleterious_json;
    const deleteriousDeclared =
      (Array.isArray(deleterious) && deleterious.length > 0) ||
      (!!deleterious && typeof deleterious === "object" && Object.keys(deleterious).length > 0);
    const certs = lot.certifications_json;

    const signals: VerificationSignals = {
      hasProject: !!lot.project_id,
      concessionCount: concessions.length,
      titularMatch: matchTitular(
        orgName,
        concessions.flatMap((c) => [c.holder, c.rut_holder]),
      ),
      legal,
      remateCount,
      bulletinCount,
      hasAssayReport: !!lot.assay_report_url,
      certificationCount: Array.isArray(certs) ? certs.length : 0,
      deleteriousDeclared,
      originGeoreferenced: !!lot.origin_geojson,
    };

    const result = scoreLotVerification(signals);
    const dictamen = await aiDictamen(result, concessions.length);

    return {
      ...result,
      lotId: data.lotId,
      checkedAt: new Date().toISOString(),
      concessionCodes: codes,
      dictamen,
    };
  });
