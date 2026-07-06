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
            if (id.includes("three") || id.includes("@react-three")) return "three";
            if (id.includes("maplibre-gl")) return "maplibre";
            if (id.includes("@deck.gl") || id.includes("deck.gl")) return "deckgl";
            if (id.includes("leaflet")) return "leaflet";
            if (id.includes("recharts") || id.includes("d3-")) return "charts";
            if (id.includes("jspdf") || id.includes("html2canvas")) return "pdf";
            if (id.includes("@turf") || id.includes("turf")) return "turf";
            if (id.includes("geotiff")) return "geotiff";
            if (id.includes("@radix-ui")) return "radix";
            if (id.includes("@supabase")) return "supabase";
            // Do NOT split @tanstack — breaks SSR bundle (createRequestHandler ReferenceError)
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("proj4") || id.includes("martini")) return "geo";
          },
        },
      },
    },
  },
});
