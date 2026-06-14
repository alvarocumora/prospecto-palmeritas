// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  // Load server env vars (no VITE_ prefix) into process.env so server routes can read them.
  const env = loadEnv(mode ?? "development", process.cwd(), "");
  for (const [k, v] of Object.entries(env)) {
    if (!process.env[k]) process.env[k] = v;
  }

  const entitiesDir = path.resolve(process.cwd(), "node_modules/entities");

  return {
    tanstackStart: {
      server: { entry: "server" },
    },
    vite: {
      resolve: {
        alias: [
          { find: /^entities\/lib\/decode\.js$/, replacement: path.join(entitiesDir, "lib/decode.js") },
          { find: /^entities\/lib\/encode\.js$/, replacement: path.join(entitiesDir, "lib/encode.js") },
          { find: /^entities$/, replacement: entitiesDir },
        ],
      },
      build: {
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
          output: {
            manualChunks(id) {
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
              if (id.includes("@tanstack")) return "tanstack";
              if (id.includes("lucide-react")) return "icons";
              if (id.includes("proj4") || id.includes("martini")) return "geo";
            },
          },
        },
      },
    },
  };
});
