// Supabase Edge Function: sync-sernageomin
// Syncs project mining_concessions against the SERNAGEOMIN ArcGIS service,
// records snapshots in concession_history, and updates concession fields when
// authoritative data has changed.
//
// Body: { projectId: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ARCGIS_BASE =
  "https://catastro.sernageomin.cl/arcgis/rest/services/Concesiones_Mineras/Concesiones_Mineras/MapServer";
// 0 explotación, 1 exploración
const LAYERS = [0, 1];

type Concession = {
  id: string;
  code: string;
  name: string;
  holder: string | null;
  area_ha: number | null;
  expires_at: string | null;
  status: string;
};

async function queryArcgis(code: string): Promise<Record<string, unknown> | null> {
  for (const layer of LAYERS) {
    const params = new URLSearchParams({
      where: `CODIGO = '${code.replace(/'/g, "''")}' OR ROL = '${code.replace(/'/g, "''")}'`,
      outFields: "*",
      outSR: "4326",
      f: "json",
      resultRecordCount: "1",
    });
    try {
      const res = await fetch(`${ARCGIS_BASE}/${layer}/query?${params.toString()}`);
      if (!res.ok) continue;
      const json = await res.json();
      const f = json?.features?.[0];
      if (f?.attributes) return f.attributes as Record<string, unknown>;
    } catch {
      // continue
    }
  }
  return null;
}

function diffFields(
  before: Concession,
  attrs: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const newHolder = (attrs.TITULAR ?? attrs.NOMBRE_TIT ?? null) as string | null;
  const newArea = (attrs.AREA_HA ?? attrs.HECTAREAS ?? null) as number | null;
  const newStatus = (attrs.VIGENCIA ?? attrs.ESTADO ?? null) as string | null;

  if (newHolder && newHolder !== before.holder) {
    diff.holder = { from: before.holder, to: newHolder };
  }
  if (newArea && Number(newArea) !== Number(before.area_ha)) {
    diff.area_ha = { from: before.area_ha, to: newArea };
  }
  if (newStatus && newStatus.toLowerCase() !== (before.status ?? "").toLowerCase()) {
    diff.status = { from: before.status, to: newStatus };
  }
  return diff;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { projectId } = (await req.json()) as { projectId: string };
    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rows, error } = await supabase
      .from("mining_concessions")
      .select("id, code, name, holder, area_ha, expires_at, status")
      .eq("project_id", projectId);

    if (error) throw error;
    const concessions = (rows ?? []) as Concession[];

    let checked = 0;
    let changed = 0;

    for (const c of concessions) {
      checked++;
      const attrs = await queryArcgis(c.code);
      if (!attrs) continue;

      const diff = diffFields(c, attrs);
      const hasDiff = Object.keys(diff).length > 0;

      await supabase.from("concession_history").insert({
        concession_id: c.id,
        project_id: projectId,
        snapshot: attrs,
        diff: hasDiff ? diff : null,
        source: "sernageomin",
      });

      if (hasDiff) {
        changed++;
        const update: Record<string, unknown> = {};
        if ("holder" in diff) update.holder = diff.holder.to;
        if ("area_ha" in diff) update.area_ha = diff.area_ha.to;
        await supabase.from("mining_concessions").update(update).eq("id", c.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, checked, changed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
