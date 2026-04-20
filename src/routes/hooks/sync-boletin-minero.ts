/**
 * Hook route: sync-boletin-minero
 *
 * Scrapes the Chilean Mining Bulletin (boletinminero.cl) using Firecrawl
 * and inserts new publications into mining_bulletins. Then matches each
 * new publication against:
 *   - project AOIs (centroid-in-polygon)
 *   - bulletin_watch_holders (by RUT or holder name)
 * and creates rows in bulletin_alerts for each match.
 *
 * Triggered by:
 *   - Daily cron job (pg_cron) — see migration
 *   - Manual button from the Boletín dashboard page
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const BOLETIN_INDEX_URL = "https://www.boletinminero.cl/";

type ScrapedPublication = {
  publication_number: string | null;
  publication_date: string | null; // ISO YYYY-MM-DD
  publication_type: "pedimento" | "mensura" | "manifestacion" | "otro";
  holder_name: string | null;
  holder_rut: string | null;
  concession_name: string | null;
  concession_code: string | null;
  region: string | null;
  provincia: string | null;
  comuna: string | null;
  area_ha: number | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  source_url: string | null;
  raw_payload: Record<string, unknown>;
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
      waitFor: 1500,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firecrawl scrape failed [${res.status}]: ${text}`);
  }
  const json = (await res.json()) as { data?: { json?: unknown } };
  return json.data?.json;
}

function hashPublication(p: ScrapedPublication): string {
  const key = [
    p.publication_number ?? "",
    p.publication_date ?? "",
    p.holder_rut ?? p.holder_name ?? "",
    p.concession_name ?? "",
    p.comuna ?? "",
  ].join("|");
  return crypto.createHash("sha256").update(key).digest("hex");
}

function pointInPolygon(
  point: [number, number],
  polygon: [number, number][],
): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function extractPolygonsFromGeoJSON(geom: unknown): [number, number][][] {
  if (!geom || typeof geom !== "object") return [];
  const g = geom as { type?: string; coordinates?: unknown };
  if (g.type === "Polygon" && Array.isArray(g.coordinates)) {
    const ring = (g.coordinates as unknown[])[0] as [number, number][];
    return Array.isArray(ring) ? [ring] : [];
  }
  if (g.type === "MultiPolygon" && Array.isArray(g.coordinates)) {
    return (g.coordinates as unknown[])
      .map((poly) => (poly as unknown[])[0] as [number, number][])
      .filter(Array.isArray);
  }
  return [];
}

export const Route = createFileRoute("/hooks/sync-boletin-minero")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.replace("Bearer ", "");
        if (!token) {
          return new Response(JSON.stringify({ error: "Missing auth" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const SUPABASE_URL = process.env.SUPABASE_URL;
        if (!SUPABASE_URL) {
          return new Response(
            JSON.stringify({ error: "SUPABASE_URL not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        // Use service role to bypass RLS for ingestion (cron is unauthenticated context)
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const adminClient = SERVICE_KEY
          ? createClient(SUPABASE_URL, SERVICE_KEY, {
              auth: { autoRefreshToken: false, persistSession: false },
            })
          : createClient(SUPABASE_URL, token, {
              auth: { autoRefreshToken: false, persistSession: false },
            });

        try {
          // 1. Scrape boletinminero.cl index page for latest publications.
          //    Firecrawl with JSON extraction prompt — robust to layout changes.
          const schema = {
            type: "object",
            properties: {
              publications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    publication_number: { type: "string" },
                    publication_date: {
                      type: "string",
                      description: "Fecha en formato YYYY-MM-DD",
                    },
                    publication_type: {
                      type: "string",
                      enum: [
                        "pedimento",
                        "mensura",
                        "manifestacion",
                        "otro",
                      ],
                    },
                    holder_name: { type: "string" },
                    holder_rut: {
                      type: "string",
                      description: "RUT chileno formato 12345678-9",
                    },
                    concession_name: { type: "string" },
                    concession_code: { type: "string" },
                    region: { type: "string" },
                    provincia: { type: "string" },
                    comuna: { type: "string" },
                    area_ha: { type: "number" },
                    centroid_lat: { type: "number" },
                    centroid_lng: { type: "number" },
                    source_url: { type: "string" },
                  },
                },
              },
            },
          };

          const extractPrompt = `Extrae todas las publicaciones del Boletín Oficial de Minería de Chile visibles en esta página: pedimentos, mensuras y manifestaciones. Para cada una incluye: número de publicación, fecha (YYYY-MM-DD), tipo, titular completo, RUT del titular si aparece, nombre de la concesión, código si existe, región, provincia, comuna, área en hectáreas, y coordenadas centroide (lat/lng) si están disponibles.`;

          const extracted = await firecrawlExtract(
            BOLETIN_INDEX_URL,
            extractPrompt,
            schema,
          );

          const publications =
            (extracted as { publications?: ScrapedPublication[] })
              ?.publications ?? [];

          let inserted = 0;
          let skipped = 0;
          const newBulletinIds: string[] = [];

          for (const pub of publications) {
            const normalized: ScrapedPublication = {
              publication_number: pub.publication_number ?? null,
              publication_date: pub.publication_date ?? null,
              publication_type: pub.publication_type ?? "otro",
              holder_name: pub.holder_name ?? null,
              holder_rut: pub.holder_rut ?? null,
              concession_name: pub.concession_name ?? null,
              concession_code: pub.concession_code ?? null,
              region: pub.region ?? null,
              provincia: pub.provincia ?? null,
              comuna: pub.comuna ?? null,
              area_ha: pub.area_ha ?? null,
              centroid_lat: pub.centroid_lat ?? null,
              centroid_lng: pub.centroid_lng ?? null,
              source_url: pub.source_url ?? BOLETIN_INDEX_URL,
              raw_payload: pub as unknown as Record<string, unknown>,
            };

            const content_hash = hashPublication(normalized);

            const { data: ins, error } = await adminClient
              .from("mining_bulletins")
              .insert({
                source: "boletin_minero_cl",
                ...normalized,
                content_hash,
              })
              .select("id")
              .single();

            if (error) {
              if (error.code === "23505") {
                skipped++;
                continue;
              }
              console.error("Insert error", error);
              continue;
            }
            if (ins) {
              inserted++;
              newBulletinIds.push(ins.id);
            }
          }

          // 2. Match new bulletins against project AOIs and watch_holders.
          let alertsCreated = 0;
          if (newBulletinIds.length > 0) {
            const { data: newBulletins } = await adminClient
              .from("mining_bulletins")
              .select(
                "id, holder_rut, holder_name, centroid_lat, centroid_lng",
              )
              .in("id", newBulletinIds);

            const { data: watchHolders } = await adminClient
              .from("bulletin_watch_holders")
              .select("project_id, holder_rut, holder_name");

            const { data: campaigns } = await adminClient
              .from("exploration_campaigns")
              .select("project_id, aoi_geojson")
              .not("aoi_geojson", "is", null);

            for (const b of newBulletins ?? []) {
              // Holder RUT/name match
              for (const w of watchHolders ?? []) {
                let matchType: string | null = null;
                let detail = "";
                if (
                  w.holder_rut &&
                  b.holder_rut &&
                  w.holder_rut.replace(/\./g, "").toLowerCase() ===
                    b.holder_rut.replace(/\./g, "").toLowerCase()
                ) {
                  matchType = "holder_rut";
                  detail = `RUT ${b.holder_rut}`;
                } else if (
                  w.holder_name &&
                  b.holder_name &&
                  b.holder_name
                    .toLowerCase()
                    .includes(w.holder_name.toLowerCase())
                ) {
                  matchType = "holder_name";
                  detail = b.holder_name;
                }
                if (matchType) {
                  const { error: aErr } = await adminClient
                    .from("bulletin_alerts")
                    .insert({
                      project_id: w.project_id,
                      bulletin_id: b.id,
                      match_type: matchType,
                      match_detail: detail,
                    });
                  if (!aErr) alertsCreated++;
                }
              }

              // AOI match (centroid in polygon)
              if (b.centroid_lat != null && b.centroid_lng != null) {
                const point: [number, number] = [
                  Number(b.centroid_lng),
                  Number(b.centroid_lat),
                ];
                const seenProjects = new Set<string>();
                for (const c of campaigns ?? []) {
                  if (seenProjects.has(c.project_id)) continue;
                  const polygons = extractPolygonsFromGeoJSON(c.aoi_geojson);
                  for (const poly of polygons) {
                    if (pointInPolygon(point, poly)) {
                      seenProjects.add(c.project_id);
                      const { error: aErr } = await adminClient
                        .from("bulletin_alerts")
                        .insert({
                          project_id: c.project_id,
                          bulletin_id: b.id,
                          match_type: "aoi",
                          match_detail: `Centroide ${point[1].toFixed(4)}, ${point[0].toFixed(4)}`,
                        });
                      if (!aErr) alertsCreated++;
                      break;
                    }
                  }
                }
              }
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              scraped: publications.length,
              inserted,
              skipped,
              alertsCreated,
              timestamp: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("sync-boletin-minero error:", message);
          return new Response(
            JSON.stringify({ success: false, error: message }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});
