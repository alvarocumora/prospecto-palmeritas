// Edge Function: external-sources-health
// Phase D — Probe SERNAGEOMIN v2 (FeatureServer concesion + vertice) and
// legacy MapServer, returning latency + ok flag per endpoint. Used by the
// ops "Estado de fuentes externas" panel and as a heartbeat for monitoring.

import { healthCheck, SNGM_BASE, LAYER_VERTICE } from "../_shared/sernageomin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LEGACY_URL =
  "https://catastro.sernageomin.cl/arcgis/rest/services/Concesiones_Mineras/MapServer?f=json";

async function probe(url: string, timeoutMs = 8000) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return { ok: res.ok, status: res.status, latencyMs: Date.now() - t0 };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const [v2Concesion, v2Vertice, legacy] = await Promise.all([
    healthCheck(),
    probe(
      `${SNGM_BASE}/${LAYER_VERTICE}/query?where=1%3D1&returnCountOnly=true&f=json`,
    ),
    probe(LEGACY_URL),
  ]);

  const sources = [
    {
      id: "sngm_v2_concesion",
      label: "SERNAGEOMIN v2 — Concesiones (ArcGIS Online)",
      kind: "primary",
      ...v2Concesion,
    },
    {
      id: "sngm_v2_vertice",
      label: "SERNAGEOMIN v2 — Vértices/Hitos",
      kind: "primary",
      ...v2Vertice,
    },
    {
      id: "sngm_legacy_mapserver",
      label: "SERNAGEOMIN legacy MapServer (fallback)",
      kind: "fallback",
      ...legacy,
    },
  ];

  const overall = v2Concesion.ok ? "healthy" : legacy.ok ? "degraded" : "down";

  return new Response(
    JSON.stringify({
      checked_at: new Date().toISOString(),
      overall,
      sources,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
