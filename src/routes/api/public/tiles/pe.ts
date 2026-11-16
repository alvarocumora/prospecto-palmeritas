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
        const ok = (body: BodyInit, type: string, cache = "public, max-age=3600") =>
          new Response(body, {
            headers: { "Content-Type": type, "Access-Control-Allow-Origin": "*", "Cache-Control": cache },
          });
        try {
          const res = await fetch(up, { signal: AbortSignal.timeout(20_000) });
          const type = res.headers.get("content-type") ?? "";
          if (res.ok && type.startsWith("image/")) return ok(res.body!, type);
        } catch {
          // INGEMMET omite el certificado intermedio: reintentar con él adjunto.
        }
        const img = await fetchWithIntermediate(up);
        if (img) return ok(img, "image/png");
        // Tesela vacía (no error) para no romper el mapa; se reintenta en 1 min.
        return ok(EMPTY_PNG, "image/png", "public, max-age=60");
      },
    },
  },
});

const EMPTY_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

async function fetchWithIntermediate(url: string): Promise<Uint8Array | null> {
  try {
    const [{ default: https }, tls, { SECTIGO_OV_R36 }] = await Promise.all([
      import("node:https"),
      import("node:tls"),
      import("@/lib/cadastre/ingemmetCa.server"),
    ]);
    const ca = [...(tls.rootCertificates ?? []), SECTIGO_OV_R36];
    return await new Promise((resolve) => {
      const req = https.get(url, { ca, timeout: 20_000 }, (res) => {
        if (res.statusCode !== 200 || !String(res.headers["content-type"]).startsWith("image/")) {
          res.resume();
          return resolve(null);
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
        res.on("error", () => resolve(null));
      });
      req.on("timeout", () => req.destroy());
      req.on("error", () => resolve(null));
    });
  } catch {
    return null;
  }
}
