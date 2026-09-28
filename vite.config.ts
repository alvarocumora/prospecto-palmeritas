// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { loadEnv } from "vite";

// Load server env vars (no VITE_ prefix) into process.env so server routes can read them.
const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
    // Nota: NO aliasear `entities`. El árbol resuelve naturalmente v4 (cadena
    // html-to-text, usa lib/decode.js) y v7 anidado bajo htmlparser2@10 de
    // cheerio (usa decode.js). Un alias fijo asume una versión hoisteada
    // concreta y rompe el build cuando npm hoistea la otra.
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return;
            // Match on the package directory boundary, not a loose substring:
            // `id.includes("three")` also matched unrelated paths and produced
            // circular manual chunks (three <-> radix) that blew up Rollup.
            const has = (pkg: string) => id.includes(`node_modules/${pkg}/`);
            if (has("three") || id.includes("node_modules/@react-three/")) return "three";
            if (has("maplibre-gl")) return "maplibre";
            if (id.includes("node_modules/@deck.gl/")) return "deckgl";
            if (has("leaflet")) return "leaflet";
            if (has("recharts")) return "charts";
            if (has("jspdf") || has("html2canvas")) return "pdf";
            if (id.includes("node_modules/@turf/")) return "turf";
            if (has("geotiff")) return "geotiff";
            if (has("proj4")) return "geo";
            // Do NOT split @tanstack — breaks SSR bundle (createRequestHandler ReferenceError)
            // Do NOT split @radix-ui / @supabase / lucide-react — shared by nearly
            // every chunk, which is what created the circular-chunk failure.
          },
        },
      },
    },

  },
});
