import { createServerFn } from "@tanstack/react-start";
import { requireCatastroRole } from "@/lib/access/roleMiddleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sngmQueryGeoJSON, SNGM_CONCESIONES_URL } from "@/lib/sngm";

// G4 · Motor de vigilancia. Para las concesiones en la watchlist del usuario,
// compara el estado EN VIVO (SERNAGEOMIN / Marcelo_Layer) contra el baseline
// cacheado (public_concessions_cache) y genera alertas (catastro_alerts) por
// cambio de titular / superficie / situación, vencimiento próximo o desaparición.
// Las alertas se insertan con supabaseAdmin (la tabla no tiene política INSERT:
// son generadas por el sistema, no por el usuario). Idempotente: no duplica una
// alerta del mismo tipo que siga sin leer.

type AlertType = "holder_change" | "area_change" | "status_change" | "expiring" | "missing";
type Sev = "info" | "warning" | "critical";

const DAY = 86400000;

function liveByCode(fc: GeoJSON.FeatureCollection | null): Map<string, Record<string, unknown>> {
  const m = new Map<string, Record<string, unknown>>();
  for (const f of fc?.features ?? []) {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const code = `${p.NUMERO_ROL}-${p.DV_ROL}`;
    m.set(code, p);
  }
  return m;
}

export const checkMyWatchlist = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .handler(async ({ context }): Promise<{ checked: number; newAlerts: number }> => {
    const { supabase, userId } = context;
    const { data: watches } = await supabase.from("catastro_watchlist").select("concession_code");
    const codes = [...new Set((watches ?? []).map((w) => w.concession_code as string))];
    if (codes.length === 0) return { checked: 0, newAlerts: 0 };

    // baseline cacheado
    const { data: cacheRows } = await supabaseAdmin
      .from("public_concessions_cache")
      .select("code, holder, area_ha, status, expires_at, name")
      .in("code", codes);
    const cache = new Map((cacheRows ?? []).map((r) => [r.code as string, r]));

    // estado en vivo: query por NUMERO_ROL
    const numeros = [...new Set(codes.map((c) => c.split("-")[0].replace(/'/g, "")))];
    const inList = numeros.map((n) => `'${n}'`).join(",");
    const live = liveByCode(
      await sngmQueryGeoJSON(SNGM_CONCESIONES_URL, {
        where: `NUMERO_ROL IN (${inList})`,
        outFields:
          "NUMERO_ROL,DV_ROL,TITULAR_NOMBRE,HECTAREAS,SITUACION_CONCESION,FECHA_VENCIMIENTO,NOMBRE",
        returnGeometry: false,
        limit: 2000,
      }),
    );

    // alertas ya existentes sin leer (para no duplicar)
    const { data: openAlerts } = await supabaseAdmin
      .from("catastro_alerts")
      .select("concession_code, alert_type")
      .eq("user_id", userId)
      .is("read_at", null)
      .in("concession_code", codes);
    const open = new Set((openAlerts ?? []).map((a) => `${a.concession_code}|${a.alert_type}`));

    const now = Date.now();
    const toInsert: Array<{
      user_id: string;
      concession_code: string;
      alert_type: AlertType;
      severity: Sev;
      title: string;
      message: string;
      payload: Record<string, unknown>;
    }> = [];
    const push = (
      code: string,
      type: AlertType,
      sev: Sev,
      title: string,
      message: string,
      payload: Record<string, unknown>,
    ) => {
      if (open.has(`${code}|${type}`)) return;
      toInsert.push({
        user_id: userId,
        concession_code: code,
        alert_type: type,
        severity: sev,
        title,
        message,
        payload,
      });
    };

    for (const code of codes) {
      const l = live.get(code);
      const base = cache.get(code);
      const label = (base?.name as string) || (l?.NOMBRE as string) || code;
      if (!l || l.SITUACION_CONCESION === "ELIMINADA") {
        push(
          code,
          "missing",
          "critical",
          `${label}: sin registro vigente`,
          "La concesión ya no aparece vigente en el catastro (¿eliminada o extinguida? — terreno posiblemente liberado).",
          { code },
        );
        continue;
      }
      if (base) {
        const holder = (l.TITULAR_NOMBRE as string) ?? null;
        if (holder && base.holder && holder !== base.holder)
          push(
            code,
            "holder_change",
            "warning",
            `${label}: cambio de titular`,
            `Titular: "${base.holder}" → "${holder}".`,
            { code, from: base.holder, to: holder },
          );
        const areaL = Number(l.HECTAREAS);
        if (
          base.area_ha != null &&
          Number.isFinite(areaL) &&
          Math.abs(areaL - Number(base.area_ha)) > 0.5
        )
          push(
            code,
            "area_change",
            "warning",
            `${label}: cambio de superficie`,
            `Superficie: ${base.area_ha} → ${areaL} ha.`,
            { code, from: base.area_ha, to: areaL },
          );
        const status = (l.SITUACION_CONCESION as string) ?? null;
        if (status && base.status && status !== base.status)
          push(
            code,
            "status_change",
            "warning",
            `${label}: cambio de situación`,
            `Situación: "${base.status}" → "${status}".`,
            { code, from: base.status, to: status },
          );
      }
      const venc = Number(l.FECHA_VENCIMIENTO);
      if (Number.isFinite(venc)) {
        const days = Math.round((venc - now) / DAY);
        if (days >= 0 && days <= 90)
          push(
            code,
            "expiring",
            days <= 30 ? "critical" : "info",
            `${label}: vence en ${days} días`,
            `Fecha de vencimiento: ${new Date(venc).toISOString().slice(0, 10)}.`,
            { code, days },
          );
      }
    }

    if (toInsert.length > 0) await supabaseAdmin.from("catastro_alerts").insert(toInsert as never);
    return { checked: codes.length, newAlerts: toInsert.length };
  });
