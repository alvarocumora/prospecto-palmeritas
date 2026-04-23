// Edge Function: sync-catastro
// Syncs all mining_concessions for a project against SERNAGEOMIN ArcGIS.
// Records snapshots in concession_history with diff. Trigger
// trg_concession_history_alert auto-creates concession_alerts when a real
// diff is recorded.
//
// Body: { projectId: string }
// Auth: requires Authorization Bearer (user JWT) — runs with service role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ARCGIS_BASE =
  "https://catastro.sernageomin.cl/arcgis/rest/services/Concesiones_Mineras/Concesiones_Mineras/MapServer";
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
    let missing = 0;
    let alertsCreated = 0;

    for (const c of concessions) {
      checked++;
      const attrs = await queryArcgis(c.code);
      if (!attrs) {
        missing++;
        // Concession disappeared from official source — mark and alert
        if (c.status !== "vencida") {
          await supabase
            .from("mining_concessions")
            .update({ status: "vencida", last_synced_at: new Date().toISOString() })
            .eq("id", c.id);
          await supabase.from("concession_alerts").insert({
            project_id: projectId,
            concession_id: c.id,
            alert_type: "concession_missing",
            severity: "critical",
            title: `Concesión ${c.code} ya no figura en SERNAGEOMIN`,
            message: "La concesión desapareció del catastro oficial. Verificar estado.",
          });
          alertsCreated++;
        }
        continue;
      }

      const diff = diffFields(c, attrs);
      const hasDiff = Object.keys(diff).length > 0;

      // Always record snapshot; trigger creates alert when diff is non-null.
      await supabase.from("concession_history").insert({
        concession_id: c.id,
        project_id: projectId,
        snapshot: attrs,
        diff: hasDiff ? diff : null,
        source: "sernageomin",
      });

      if (hasDiff) {
        changed++;
        const update: Record<string, unknown> = {
          last_synced_at: new Date().toISOString(),
        };
        if ("holder" in diff) update.holder = diff.holder.to;
        if ("area_ha" in diff) update.area_ha = diff.area_ha.to;
        await supabase.from("mining_concessions").update(update).eq("id", c.id);
      } else {
        await supabase
          .from("mining_concessions")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", c.id);
      }
    }

    // Expiry alerts: <90 days and no recent expiry alert
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const c of concessions) {
      if (!c.expires_at) continue;
      const days = (new Date(c.expires_at).getTime() - now) / (24 * 60 * 60 * 1000);
      if (days > 90 || days < 0) continue;
      const { data: existing } = await supabase
        .from("concession_alerts")
        .select("id")
        .eq("concession_id", c.id)
        .eq("alert_type", "expiring_soon")
        .gte("created_at", new Date(now - ninetyDaysMs).toISOString())
        .limit(1);
      if (existing && existing.length > 0) continue;
      await supabase.from("concession_alerts").insert({
        project_id: projectId,
        concession_id: c.id,
        alert_type: "expiring_soon",
        severity: days < 30 ? "critical" : "warning",
        title: `Concesión ${c.code} vence en ${Math.round(days)} días`,
        message: `Vencimiento programado: ${c.expires_at}`,
      });
      alertsCreated++;
    }

    return new Response(
      JSON.stringify({ ok: true, checked, changed, missing, alertsCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
