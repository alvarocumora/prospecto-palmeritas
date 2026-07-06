import { createFileRoute } from "@tanstack/react-router";

// Proxy de tiles DEM Terrarium (AWS Terrain Tiles) con CORS.
//
// Motivo: el bucket público elevation-tiles-prod NO envía
// Access-Control-Allow-Origin. MapLibre `raster-dem` LEE los píxeles del PNG
// para computar la elevación, y sin CORS el canvas de terreno 3D se pinta
// completamente NEGRO. Reproxeando server-side (donde CORS no aplica) y
// re-sirviendo con ACAO desde nuestro propio origen, el terreno 3D funciona.
//
// Uso en MapLibre: tiles: ["/api/terrain/{z}/{x}/{y}"] con encoding "terrarium".

const UPSTREAM = "https://elevation-tiles-prod.s3.amazonaws.com/terrarium";

export const Route = createFileRoute("/api/terrain/$z/$x/$y")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const z = String(params.z).replace(/[^\d]/g, "");
        const x = String(params.x).replace(/[^\d]/g, "");
        // El último segmento puede venir como "1233" o "1233.png".
        const y = String(params.y)
          .replace(/\.png$/i, "")
          .replace(/[^\d]/g, "");
        if (!z || !x || !y) return new Response("bad tile", { status: 400 });

        try {
          const upstream = await fetch(`${UPSTREAM}/${z}/${x}/${y}.png`);
          if (!upstream.ok) {
            return new Response("tile not found", {
              status: upstream.status,
              headers: { "Access-Control-Allow-Origin": "*" },
            });
          }
          const buf = await upstream.arrayBuffer();
          return new Response(buf, {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Access-Control-Allow-Origin": "*",
              // Los tiles DEM son estáticos: cache agresivo en el edge/CDN.
              "Cache-Control": "public, max-age=604800, immutable",
            },
          });
        } catch {
          return new Response("upstream error", {
            status: 502,
            headers: { "Access-Control-Allow-Origin": "*" },
          });
        }
      },
    },
  },
});
