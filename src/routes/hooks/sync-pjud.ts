/**
 * Hook route: sync-pjud
 *
 * Scrapes Chilean Judiciary (PJUD) public listings for mining-related cases
 * via Firecrawl, inserts new cases into mining_court_cases, and creates
 * court_case_alerts when a case defendant matches a tracked holder
 * (bulletin_watch_holders) for any project.
 *
 * Triggered by:
 *   - Daily cron job (pg_cron) at 07:00 UTC
 *   - Manual button from the Boletín / Catastro dashboard
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

// PJUD search results page for mining cases (materia=Minería). The exact URL
// changes occasionally; Firecrawl's JSON extraction tolerates layout drift.
const PJUD_SEARCH_URL = "https://oficinajudicialvirtual.pjud.cl/indexN.php#buscador";

type ScrapedCase = {
  case_number: string | null;
  court: string | null;
  jurisdiction: string | null;
  matter: string | null;
  plaintiff: string | null;
  defendant: string | null;
  defendant_rut: string | null;
  comuna: string | null;
  region: string | null;
  filed_at: string | null; // YYYY-MM-DD
  last_movement_at: string | null;
  status: string | null;
  source_url: string | null;
};

async function firecrawlExtract(url: string, prompt: string, schema: object) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: [{ type: "json", prompt, schema }],
      onlyMainContent: true,
      waitFor: 2000,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firecrawl scrape failed [${res.status}]: ${text}`);
  }
  const json = (await res.json()) as { data?: { json?: unknown } };
  return json.data?.json;
}

function hashCase(c: ScrapedCase): string {
  const key = [
    c.case_number ?? "",
    c.court ?? "",
    c.defendant_rut ?? c.defendant ?? "",
    c.filed_at ?? "",
  ].join("|");
  return crypto.createHash("sha256").update(key).digest("hex");
}

function normalizeRut(r: string | null | undefined): string | null {
  if (!r) return null;
  return r.replace(/\./g, "").trim().toLowerCase();
}

export const Route = createFileRoute("/hooks/sync-pjud")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.replace("Bearer ", "")?.trim();
        if (!token) {
          return new Response(JSON.stringify({ error: "Missing auth" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!SUPABASE_URL || !SERVICE_KEY) {
          return new Response(JSON.stringify({ error: "server_misconfigured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
        if (userErr || !userData?.user) {
          return new Response(JSON.stringify({ error: "invalid_token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { data: isAdmin, error: roleErr } = await adminClient.rpc("is_super_admin", {
          _user_id: userData.user.id,
        });
        if (roleErr || !isAdmin) {
          return new Response(JSON.stringify({ error: "forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const schema = {
            type: "object",
            properties: {
              cases: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    case_number: {
                      type: "string",
                      description: "Rol o número de causa (ej: C-1234-2025)",
                    },
                    court: { type: "string" },
                    jurisdiction: {
                      type: "string",
                      description: "Civil, ambiental, etc.",
                    },
                    matter: {
                      type: "string",
                      description: "Materia (ej: oposición a mensura, sumario sanitario minero)",
                    },
                    plaintiff: { type: "string" },
                    defendant: { type: "string" },
                    defendant_rut: {
                      type: "string",
                      description: "RUT chileno 12345678-9",
                    },
                    comuna: { type: "string" },
                    region: { type: "string" },
                    filed_at: {
                      type: "string",
                      description: "Fecha ingreso YYYY-MM-DD",
                    },
                    last_movement_at: {
                      type: "string",
                      description: "Última actuación YYYY-MM-DD",
                    },
                    status: { type: "string" },
                    source_url: { type: "string" },
                  },
                },
              },
            },
          };

          const extractPrompt = `Extrae todas las causas judiciales relacionadas con minería visibles en esta página del Poder Judicial de Chile (PJUD): oposiciones a mensura, sumarios sanitarios mineros, recursos ambientales mineros, juicios de servidumbre minera. Para cada causa incluye: número de rol, tribunal, jurisdicción, materia, demandante, demandado completo, RUT del demandado, comuna, región, fecha de ingreso (YYYY-MM-DD), último movimiento, estado, y URL de la causa si aparece.`;

          const extracted = await firecrawlExtract(PJUD_SEARCH_URL, extractPrompt, schema);

          const cases = (extracted as { cases?: ScrapedCase[] })?.cases ?? [];

          let inserted = 0;
          let skipped = 0;
          const newCaseIds: string[] = [];

          for (const c of cases) {
            const normalized: ScrapedCase = {
              case_number: c.case_number ?? null,
              court: c.court ?? null,
              jurisdiction: c.jurisdiction ?? null,
              matter: c.matter ?? null,
              plaintiff: c.plaintiff ?? null,
              defendant: c.defendant ?? null,
              defendant_rut: c.defendant_rut ?? null,
              comuna: c.comuna ?? null,
              region: c.region ?? null,
              filed_at: c.filed_at ?? null,
              last_movement_at: c.last_movement_at ?? null,
              status: c.status ?? null,
              source_url: c.source_url ?? PJUD_SEARCH_URL,
            };
            const content_hash = hashCase(normalized);

            const { data: ins, error } = await adminClient
              .from("mining_court_cases")
              .insert({
                source: "pjud",
                ...normalized,
                raw_payload: c as unknown as Record<string, unknown>,
                content_hash,
              })
              .select("id")
              .single();

            if (error) {
              if (error.code === "23505") {
                skipped++;
                continue;
              }
              console.error("Insert court case error", error);
              continue;
            }
            if (ins) {
              inserted++;
              newCaseIds.push(ins.id);
            }
          }

          // Match against watched holders → create alerts
          let alertsCreated = 0;
          if (newCaseIds.length > 0) {
            const { data: newCases } = await adminClient
              .from("mining_court_cases")
              .select("id, defendant, defendant_rut")
              .in("id", newCaseIds);

            const { data: watchHolders } = await adminClient
              .from("bulletin_watch_holders")
              .select("project_id, holder_rut, holder_name");

            for (const cs of newCases ?? []) {
              for (const w of watchHolders ?? []) {
                let matchType: string | null = null;
                let detail = "";
                const defRut = normalizeRut(cs.defendant_rut);
                const watchRut = normalizeRut(w.holder_rut);
                if (defRut && watchRut && defRut === watchRut) {
                  matchType = "defendant_rut";
                  detail = `RUT ${cs.defendant_rut}`;
                } else if (
                  w.holder_name &&
                  cs.defendant &&
                  cs.defendant.toLowerCase().includes(w.holder_name.toLowerCase())
                ) {
                  matchType = "defendant_name";
                  detail = cs.defendant;
                }
                if (matchType) {
                  const { error: aErr } = await adminClient.from("court_case_alerts").insert({
                    project_id: w.project_id,
                    case_id: cs.id,
                    match_type: matchType,
                    match_detail: detail,
                  });
                  if (!aErr) alertsCreated++;
                }
              }
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              scraped: cases.length,
              inserted,
              skipped,
              alertsCreated,
              timestamp: new Date().toISOString(),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("sync-pjud error:", message);
          return new Response(JSON.stringify({ success: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
