import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fetchHolderBulletins, fetchNationalTramitePage, NATIONAL_PAGE_SIZE } from "@/lib/bulletinSync";

// Sync del Boletín Oficial de Minería (watch-driven).
// Cron-triggered (HMAC x-cron-secret). Por cada titular vigilado consulta su
// actividad en SERNAGEOMIN v2 (en trámite / eliminada), inserta las novedades
// en mining_bulletins y genera bulletin_alerts para el proyecto que vigila.
//
// Bounded: cap de titulares por corrida para no exceder el tiempo de la Edge.

const MAX_HOLDERS_PER_RUN = 40;
const MAX_PER_HOLDER = 50;

export const Route = createFileRoute("/api/public/sync-bulletins")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        const provided = request.headers.get("x-cron-secret");
        if (!cronSecret || !provided || provided !== cronSecret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) return new Response("server_misconfigured", { status: 500 });
        const sb = createClient(url, key, { auth: { persistSession: false } });

        const runStart = new Date().toISOString();

        // Modo nacional: ?mode=national&offset=0&pages=3 → upsert de todas las
        // concesiones EN TRÁMITE del país. Devuelve nextOffset para continuar.
        const qs = new URL(request.url).searchParams;
        if (qs.get("mode") === "national") {
          let offset = Math.max(0, Number(qs.get("offset") ?? 0) || 0);
          const pages = Math.min(5, Math.max(1, Number(qs.get("pages") ?? 3) || 3));
          let upserted = 0;
          let more = true;
          try {
            for (let i = 0; i < pages && more; i++) {
              const page = await fetchNationalTramitePage(offset);
              more = page.more;
              offset += NATIONAL_PAGE_SIZE;
              for (let k = 0; k < page.rows.length; k += 500) {
                const chunk = page.rows
                  .slice(k, k + 500)
                  .map((r) => ({ ...r, scraped_at: runStart }));
                const { error } = await sb
                  .from("mining_bulletins")
                  .upsert(chunk, { onConflict: "content_hash" });
                if (error) throw new Error(error.message);
                upserted += chunk.length;
              }
            }
            await sb.from("bulletin_sync_runs").insert({
              source: "sernageomin-v2-national",
              started_at: runStart,
              finished_at: new Date().toISOString(),
              status: "ok",
              scraped_count: upserted,
              inserted_count: upserted,
              alerts_created: 0,
            });
            return Response.json({ ok: true, upserted, nextOffset: more ? offset : null });
          } catch (e) {
            const msg = e instanceof Error ? e.message : "error";
            return Response.json({ ok: false, error: msg, offset }, { status: 500 });
          }
        }
        let holdersProcessed = 0;
        let bulletinsInserted = 0;
        let alertsCreated = 0;

        try {
          // Titulares vigilados (ordenados por más recientes primero).
          const { data: watches, error: wErr } = await sb
            .from("bulletin_watch_holders")
            .select("id, project_id, holder_name, holder_rut")
            .order("created_at", { ascending: false })
            .limit(MAX_HOLDERS_PER_RUN);
          if (wErr) throw new Error(wErr.message);

          for (const w of watches ?? []) {
            holdersProcessed++;
            const rows = await fetchHolderBulletins(
              w.holder_rut,
              w.holder_name,
              MAX_PER_HOLDER,
            ).catch(() => []);
            if (!rows.length) continue;

            // Dedupe: qué content_hash ya existen.
            const hashes = rows.map((r) => r.content_hash);
            const { data: existing } = await sb
              .from("mining_bulletins")
              .select("id, content_hash")
              .in("content_hash", hashes);
            const seen = new Map((existing ?? []).map((e) => [e.content_hash, e.id]));

            for (const r of rows) {
              let bulletinId = seen.get(r.content_hash) ?? null;

              if (!bulletinId) {
                const { data: ins, error: insErr } = await sb
                  .from("mining_bulletins")
                  .insert({ ...r, scraped_at: runStart })
                  .select("id")
                  .single();
                if (insErr) continue;
                bulletinId = ins.id;
                bulletinsInserted++;
              }

              // Alerta para el proyecto que vigila (idempotente por bulletin+proyecto).
              const { data: priorAlert } = await sb
                .from("bulletin_alerts")
                .select("id")
                .eq("bulletin_id", bulletinId)
                .eq("project_id", w.project_id)
                .maybeSingle();
              if (!priorAlert) {
                const { error: aErr } = await sb.from("bulletin_alerts").insert({
                  bulletin_id: bulletinId,
                  project_id: w.project_id,
                  match_type: "holder",
                  match_detail: `${r.publication_type} · ${r.concession_name ?? r.concession_code} (${w.holder_name ?? w.holder_rut})`,
                });
                if (!aErr) alertsCreated++;
              }
            }
          }

          // Registrar la corrida.
          await sb.from("bulletin_sync_runs").insert({
            source: "sernageomin-v2",
            started_at: runStart,
            finished_at: new Date().toISOString(),
            status: "ok",
            scraped_count: holdersProcessed,
            inserted_count: bulletinsInserted,
            alerts_created: alertsCreated,
          });

          return new Response(
            JSON.stringify({ ok: true, holdersProcessed, bulletinsInserted, alertsCreated }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "error";
          await sb
            .from("bulletin_sync_runs")
            .insert({
              source: "sernageomin-v2",
              started_at: runStart,
              finished_at: new Date().toISOString(),
              status: "error",
              error_message: msg,
              scraped_count: holdersProcessed,
              inserted_count: bulletinsInserted,
              alerts_created: alertsCreated,
            })
            .then(() => {});
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
