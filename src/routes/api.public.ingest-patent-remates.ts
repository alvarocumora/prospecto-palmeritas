import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseRemateRows, type RemateRow } from "@/lib/patentRemates";
import { verifyCronSecret } from "@/lib/server/ingest";

// Ingesta de la nómina anual de remates por patente minera impaga.
//
// La TGR/SERNAGEOMIN no exponen un API JSON de morosidad; el dato autoritativo
// es la nómina anual del proceso de amparo (Excel/PDF, enviada a tribunales
// antes del 1° de julio). El operador convierte la planilla a filas y hace:
//
//   POST /api/public/ingest-patent-remates
//   headers: { x-cron-secret: <CRON_SECRET> }
//   body: { "year": 2026, "source_url": "https://...", "rows": [ {...}, ... ] }
//
// La ruta normaliza las filas (parseRemateRows), hace upsert en patent_remates
// (dedupe por content_hash) y, para las concesiones cuyos titulares están
// vigilados (bulletin_watch_holders), emite un boletín "remate" + alerta,
// reutilizando el pipeline de alertas del Boletín.

const MAX_ROWS = 50_000;
const CHUNK = 500;

function normName(s: string | null): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function rutBody(s: string | null): string {
  const d = (s ?? "").replace(/[.\-\s]/g, "").replace(/[kK]$/, "");
  return d.length >= 8 ? d.slice(0, -1) : d;
}

export const Route = createFileRoute("/api/public/ingest-patent-remates")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request, process.env.CRON_SECRET)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) return new Response("server_misconfigured", { status: 500 });
        const sb = createClient(url, key, { auth: { persistSession: false } });

        let body: { year?: unknown; source_url?: unknown; source?: unknown; rows?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }
        const year = Number(body.year);
        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
          return Response.json({ ok: false, error: "invalid_year" }, { status: 400 });
        }
        if (!Array.isArray(body.rows)) {
          return Response.json({ ok: false, error: "rows_must_be_array" }, { status: 400 });
        }
        if (body.rows.length > MAX_ROWS) {
          return Response.json({ ok: false, error: "too_many_rows" }, { status: 413 });
        }

        const runStart = new Date().toISOString();
        let inserted = 0;
        let alertsCreated = 0;

        try {
          const parsed = parseRemateRows(body.rows as Array<Record<string, unknown>>, {
            year,
            source: typeof body.source === "string" ? body.source : undefined,
            sourceUrl: typeof body.source_url === "string" ? body.source_url : null,
          });

          // Dedupe global por content_hash contra lo ya ingerido.
          const hashes = parsed.map((r) => r.content_hash);
          const existing = new Set<string>();
          for (let i = 0; i < hashes.length; i += CHUNK) {
            const { data } = await sb
              .from("patent_remates")
              .select("content_hash")
              .in("content_hash", hashes.slice(i, i + CHUNK));
            for (const e of data ?? []) existing.add(e.content_hash as string);
          }
          const fresh = parsed.filter((r) => !existing.has(r.content_hash));

          // Insert en lotes.
          for (let i = 0; i < fresh.length; i += CHUNK) {
            const batch = fresh.slice(i, i + CHUNK).map((r) => ({ ...r, ingested_at: runStart }));
            const { error, count } = await sb
              .from("patent_remates")
              .insert(batch, { count: "exact" });
            if (!error) inserted += count ?? batch.length;
          }

          // Alertas para titulares vigilados: reusa el pipeline del Boletín.
          alertsCreated = await emitRemateAlerts(sb, fresh, runStart);

          await sb.from("bulletin_sync_runs").insert({
            source: "tgr-remates",
            started_at: runStart,
            finished_at: new Date().toISOString(),
            status: "ok",
            scraped_count: parsed.length,
            inserted_count: inserted,
            alerts_created: alertsCreated,
          });

          return Response.json({
            ok: true,
            year,
            received: body.rows.length,
            parsed: parsed.length,
            inserted,
            alertsCreated,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "error";
          await sb
            .from("bulletin_sync_runs")
            .insert({
              source: "tgr-remates",
              started_at: runStart,
              finished_at: new Date().toISOString(),
              status: "error",
              error_message: msg,
              scraped_count: 0,
              inserted_count: inserted,
              alerts_created: alertsCreated,
            })
            .then(() => {});
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});

/**
 * Por cada remate cuyo titular esté vigilado en bulletin_watch_holders, inserta
 * un boletín "remate" (idempotente por content_hash) y una alerta para el
 * proyecto. Devuelve el número de alertas creadas.
 */
async function emitRemateAlerts(
  sb: SupabaseClient,
  remates: RemateRow[],
  runStart: string,
): Promise<number> {
  if (!remates.length) return 0;

  const { data: watches } = await sb
    .from("bulletin_watch_holders")
    .select("project_id, holder_name, holder_rut");
  if (!watches?.length) return 0;

  // Índices de vigilancia por nombre normalizado y por cuerpo de RUT.
  const byName = new Map<string, string[]>();
  const byRut = new Map<string, string[]>();
  const add = (m: Map<string, string[]>, k: string, pid: string) => {
    const arr = m.get(k);
    if (arr) arr.push(pid);
    else m.set(k, [pid]);
  };
  for (const w of watches) {
    const pid = w.project_id as string;
    const n = normName(w.holder_name as string | null);
    if (n) add(byName, n, pid);
    const rb = rutBody(w.holder_rut as string | null);
    if (rb) add(byRut, rb, pid);
  }

  let alerts = 0;
  for (const r of remates) {
    const n = normName(r.holder_name);
    const rb = rutBody(r.holder_rut);
    const projectIds = new Set<string>([...(byName.get(n) ?? []), ...(byRut.get(rb) ?? [])]);
    if (!projectIds.size) continue;

    // Boletín "remate" idempotente por content_hash.
    const bHash = `remate-${r.content_hash}`;
    let bulletinId: string | null = null;
    const { data: prior } = await sb
      .from("mining_bulletins")
      .select("id")
      .eq("content_hash", bHash)
      .maybeSingle();
    if (prior) {
      bulletinId = prior.id as string;
    } else {
      const { data: ins } = await sb
        .from("mining_bulletins")
        .insert({
          source: r.source,
          publication_type: "remate",
          holder_name: r.holder_name,
          holder_rut: r.holder_rut,
          concession_name: r.concession_name,
          concession_code: r.concession_code,
          region: r.region,
          comuna: r.comuna,
          source_url: r.source_url,
          content_hash: bHash,
          raw_payload: { ...r.raw_payload, year: r.year, amount_clp: r.amount_clp },
          scraped_at: runStart,
        })
        .select("id")
        .single();
      bulletinId = ins?.id as string | null;
    }
    if (!bulletinId) continue;

    for (const projectId of projectIds) {
      const { data: priorAlert } = await sb
        .from("bulletin_alerts")
        .select("id")
        .eq("bulletin_id", bulletinId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (priorAlert) continue;
      const { error } = await sb.from("bulletin_alerts").insert({
        bulletin_id: bulletinId,
        project_id: projectId,
        match_type: "remate",
        match_detail: `Remate ${r.year} · ${r.concession_name ?? r.concession_code} (${r.holder_name ?? r.holder_rut})`,
      });
      if (!error) alerts++;
    }
  }
  return alerts;
}
