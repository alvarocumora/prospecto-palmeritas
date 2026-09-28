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

// Valores publicos que el navegador necesita. Si falta alguno, no lo definimos
// y dejamos que la inyeccion por defecto del preset haga su trabajo.
const pick = (...keys: string[]) => {
  for (const key of keys) {
    const value = env[key] ?? process.env[key];
    if (value) return value;
  }
  return undefined;
};

const publicEnv: Record<string, string | undefined> = {
  "import.meta.env.VITE_SUPABASE_URL": pick("VITE_SUPABASE_URL", "SUPABASE_URL"),
  "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": pick(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
  ),
  "import.meta.env.VITE_SUPABASE_PROJECT_ID": pick(
    "VITE_SUPABASE_PROJECT_ID",
    "SUPABASE_PROJECT_ID",
  ),
};

const define = Object.fromEntries(
  Object.entries(publicEnv)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => [key, JSON.stringify(value)]),
);

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
    // El bundle de produccion quedaba con `import.meta.env` vacio y el cliente
    // lanzaba "Missing Supabase environment variables", rompiendo la hidratacion.
    // Fijamos los valores publicos como literales para que siempre viajen al cliente.
    define,

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
