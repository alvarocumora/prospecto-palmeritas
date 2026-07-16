import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getCadastreConnector, listCadastreCountries } from "@/lib/cadastre/registry";
import { hashApiKey, isApiKeyFormat, checkQuota, monthKey } from "@/lib/apiKeys";

// API pública v1 del catastro unificado (data-as-a-product).
//
//   GET /api/v1/cadastre/search?country=CL&q=termino&limit=25
//   headers: { x-api-key: gc_live_… }
//
// Devuelve concesiones en el esquema canónico (canonical-concession/v1) desde
// la fuente oficial del país, en vivo. Autenticación por API key (hash en BD),
// cuota mensual por plan y contadores de uso por llave.

const MAX_LIMIT = 50;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/v1/cadastre/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // --- Autenticación por API key ---
        const provided = request.headers.get("x-api-key") ?? "";
        if (!provided || !isApiKeyFormat(provided)) {
          return json(401, { error: "invalid_api_key", hint: "Header x-api-key requerido." });
        }
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) return json(500, { error: "server_misconfigured" });
        const sb = createClient(url, key, { auth: { persistSession: false } });

        const keyHash = await hashApiKey(provided);
        const { data: apiKey } = await sb
          .from("api_keys")
          .select("id, plan, is_active, monthly_count, month_key, requests_total")
          .eq("key_hash", keyHash)
          .maybeSingle();
        if (!apiKey) return json(401, { error: "invalid_api_key" });
        if (!apiKey.is_active) return json(403, { error: "api_key_revoked" });

        // --- Cuota mensual por plan ---
        const now = new Date();
        const quota = checkQuota(
          String(apiKey.plan),
          (apiKey.month_key as string | null) ?? null,
          Number(apiKey.monthly_count ?? 0),
          now,
        );
        if (!quota.allowed) {
          return json(429, {
            error: "quota_exceeded",
            limit: quota.limit,
            plan: apiKey.plan,
            hint: "La cuota se reinicia al inicio de cada mes (UTC).",
          });
        }

        // --- Parámetros ---
        const params = new URL(request.url).searchParams;
        const country = (params.get("country") ?? "").trim().toUpperCase();
        const q = (params.get("q") ?? "").trim();
        const limit = Math.min(
          Math.max(parseInt(params.get("limit") ?? "25", 10) || 25, 1),
          MAX_LIMIT,
        );
        const connector = getCadastreConnector(country);
        if (!connector) {
          return json(400, {
            error: "unsupported_country",
            supported: listCadastreCountries().map((c) => c.country),
          });
        }
        if (q.length < 2 || q.length > 80) {
          return json(400, {
            error: "invalid_query",
            hint: "q debe tener entre 2 y 80 caracteres.",
          });
        }

        // --- Consulta a la fuente oficial ---
        const results = await connector.search(q, limit);

        // --- Registrar uso (best-effort) ---
        await sb
          .from("api_keys")
          .update({
            monthly_count: quota.effectiveCount + 1,
            month_key: monthKey(now),
            requests_total: Number(apiKey.requests_total ?? 0) + 1,
            last_used_at: now.toISOString(),
          })
          .eq("id", apiKey.id);

        return json(200, {
          data: results,
          meta: {
            schema: "canonical-concession/v1",
            country: connector.country,
            institution: connector.institution,
            count: results.length,
            live: true,
            attribution:
              "Datos públicos oficiales consultados en vivo, normalizados por Geocapitals.",
            quota: { plan: apiKey.plan, used: quota.effectiveCount + 1, limit: quota.limit },
          },
        });
      },
    },
  },
});
