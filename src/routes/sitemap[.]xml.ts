import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BASE_URL = "https://geocapitals.com";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/proyectos", changefreq: "daily", priority: "0.9" },
  { path: "/marketplace", changefreq: "daily", priority: "0.9" },
  { path: "/inversionistas", changefreq: "weekly", priority: "0.8" },
  { path: "/oportunidades", changefreq: "daily", priority: "0.85" },
  { path: "/empresas", changefreq: "weekly", priority: "0.8" },
  { path: "/recursos", changefreq: "monthly", priority: "0.6" },
  { path: "/contacto", changefreq: "monthly", priority: "0.6" },
  { path: "/catastro", changefreq: "weekly", priority: "0.7" },
  { path: "/catastro/mapa", changefreq: "weekly", priority: "0.7" },
  { path: "/catastro/precios", changefreq: "daily", priority: "0.6" },
  { path: "/satelital", changefreq: "weekly", priority: "0.75" },
  { path: "/visor-3d", changefreq: "weekly", priority: "0.75" },
  { path: "/legal/privacidad", changefreq: "yearly", priority: "0.3" },
  { path: "/legal/terminos", changefreq: "yearly", priority: "0.3" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [...STATIC_ENTRIES];

        try {
          const supabase = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
          );
          const { data } = await supabase
            .from("property_listings")
            .select("id, updated_at, is_published")
            .eq("is_published", true)
            .order("updated_at", { ascending: false })
            .limit(500);
          for (const row of data ?? []) {
            entries.push({
              path: `/proyectos/${row.id}`,
              lastmod: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
              changefreq: "weekly",
              priority: "0.8",
            });
          }
          const { data: lots } = await supabase
            .from("commodity_lots")
            .select("id, updated_at, status, is_verified")
            .eq("status", "published")
            .eq("is_verified", true)
            .order("updated_at", { ascending: false })
            .limit(500);
          for (const row of lots ?? []) {
            entries.push({
              path: `/marketplace/${row.id}`,
              lastmod: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
              changefreq: "weekly",
              priority: "0.7",
            });
          }
        } catch {
          // On failure, still emit the static sitemap.
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
