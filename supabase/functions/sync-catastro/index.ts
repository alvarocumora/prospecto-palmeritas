// Edge Function: sync-catastro (v2 — SERNAGEOMIN ArcGIS Online)
// Sincroniza todas las mining_concessions de un proyecto contra el nuevo
// FeatureServer (services1.arcgis.com/.../Marcelo_Layer/FeatureServer/2).
//
// Body: { projectId: string }
// Auth: requires Authorization Bearer (user JWT) — runs with service role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  findConcessionByCode,
  type CanonicalConcession,
} from "../_shared/sernageomin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Concession = {
  id: string;
  code: string;
  name: string;
  holder: string | null;
  area_ha: number | null;
  expires_at: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
};

function diffFields(
  before: Concession,
  c: CanonicalConcession,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  if (c.holder_name && c.holder_name !== before.holder) {
    diff.holder = { from: before.holder, to: c.holder_name };
  }
  if (c.hectareas != null && Number(c.hectareas) !== Number(before.area_ha)) {
    diff.area_ha = { from: before.area_ha, to: c.hectareas };
  }
  if (c.status && c.status !== (before.status ?? "").toLowerCase()) {
    diff.status = { from: before.status, to: c.status };
  }
  if (c.fecha_vencimiento && c.fecha_vencimiento !== before.expires_at) {
    diff.expires_at = { from: before.expires_at, to: c.fecha_vencimiento };
  }
  const prevRut = (before.metadata as { holder_rut?: string } | null)?.holder_rut;
  if (c.holder_rut && prevRut && c.holder_rut !== prevRut) {
    diff.holder_rut = { from: prevRut, to: c.holder_rut };
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
      .select("id, code, name, holder, area_ha, expires_at, status, metadata")
      .eq("project_id", projectId);

    if (error) throw error;
    const concessions = (rows ?? []) as Concession[];

    let checked = 0;
    let changed = 0;
    let missing = 0;
    let alertsCreated = 0;

    for (const c of concessions) {
      checked++;
      const remote = await findConcessionByCode(c.code).catch(() => null);
      if (!remote) {
        missing++;
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

      const diff = diffFields(c, remote);
      const hasDiff = Object.keys(diff).length > 0;

      const snapshot = {
        client_version: "v2-online",
        id_concesion: remote.id_concesion,
        rol: remote.rol,
        name: remote.name,
        hectareas: remote.hectareas,
        status: remote.status,
        status_raw: remote.status_raw,
        tipo: remote.tipo,
        comuna: remote.comuna,
        holder_name: remote.holder_name,
        holder_rut: remote.holder_rut,
        holder_division: remote.holder_division,
        nro_inscripcion: remote.nro_inscripcion,
        fojas: remote.fojas,
        ano_inscripcion: remote.ano_inscripcion,
        fecha_vencimiento: remote.fecha_vencimiento,
        fecha_actualizacion: remote.fecha_actualizacion,
      };

      await supabase.from("concession_history").insert({
        concession_id: c.id,
        project_id: projectId,
        snapshot,
        diff: hasDiff ? diff : null,
        source: "sernageomin",
      });

      const prevMeta = (c.metadata ?? {}) as Record<string, unknown>;
      const update: Record<string, unknown> = {
        last_synced_at: new Date().toISOString(),
        source: "sernageomin",
        metadata: {
          ...prevMeta,
          sngm_v2: {
            id_concesion: remote.id_concesion,
            tipo: remote.tipo,
            comuna: remote.comuna,
            holder_rut: remote.holder_rut,
            holder_division: remote.holder_division,
            nro_inscripcion: remote.nro_inscripcion,
            fojas: remote.fojas,
            ano_inscripcion: remote.ano_inscripcion,
            fecha_actualizacion: remote.fecha_actualizacion,
          },
        },
      };
      if (hasDiff) {
        changed++;
        if ("holder" in diff) update.holder = diff.holder.to;
        if ("area_ha" in diff) update.area_ha = diff.area_ha.to;
        if ("status" in diff) update.status = diff.status.to;
        if ("expires_at" in diff) update.expires_at = diff.expires_at.to;
      }
      if (remote.holder_rut) update.rut_holder = remote.holder_rut;
      if (remote.comuna) update.commune = remote.comuna;
      if (remote.geometry) update.geometry_geojson = remote.geometry;

      await supabase.from("mining_concessions").update(update).eq("id", c.id);
    }

    // Expiry alerts: <90 days
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
      JSON.stringify({
        ok: true,
        client_version: "v2-online",
        checked,
        changed,
        missing,
        alertsCreated,
      }),
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
