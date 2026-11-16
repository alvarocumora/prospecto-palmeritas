// Proxy de teselas del Catastro Minero de Perú (INGEMMET GEOCATMIN).
// El servidor oficial no envía cabeceras CORS, por eso el mapa no podía
// dibujarlo. Solo reenvía imágenes de la capa pública; sin datos privados.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const UPSTREAM =
  "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services/SERV_CATASTRO_MINERO_WGS84/MapServer/export";

const Q = z.object({
  bbox: z.string().regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/),
  layer: z.enum(["0", "1"]).default("0"),
});

export const Route = createFileRoute("/api/public/tiles/pe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = Q.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) return new Response("bad bbox", { status: 400 });
        const up = `${UPSTREAM}?bbox=${parsed.data.bbox}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&layers=show:${parsed.data.layer}&f=image`;
        try {
          const res = await fetch(up, { signal: AbortSignal.timeout(20_000) });
          const type = res.headers.get("content-type") ?? "";
          if (!res.ok || !type.startsWith("image/")) return new Response("upstream", { status: 502 });
          return new Response(res.body, {
            headers: {
              "Content-Type": type,
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=3600",
            },
          });
        } catch {
          return new Response("upstream unavailable", { status: 504 });
        }
      },
    },
  },
});
