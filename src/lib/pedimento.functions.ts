import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { sngmQueryGeoJSON, SNGM_CONCESIONES_URL } from "@/lib/sngm";
import { proposePedimento, type PedimentoResult } from "@/lib/pedimentoGeometry";

const PolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]).rest(z.number()))),
});
const pedimentoInput = z.object({
  aoi: PolygonSchema,
  maxHa: z.number().optional(),
});

export type ProposePedimentoResult =
  | { ok: true; result: PedimentoResult; catastro: GeoJSON.FeatureCollection }
  | { ok: false; error: string };

/**
 * Server fn G1: sobre un AOI dibujado, consulta el catastro SERNAGEOMIN en vivo
 * (concesiones ocupadas = CONSTITUIDA + EN TRÁMITE) y propone el mayor pedimento
 * (rectángulo N-S/E-W) sobre el terreno vacante. Devuelve la geometría + vértices
 * UTM + el catastro para pintar. Vacancia INDICATIVA (confirmar en OJV).
 */
export const proposePedimentoOnAoi = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pedimentoInput.parse(d))
  .handler(async ({ data }): Promise<ProposePedimentoResult> => {
    const aoi = data.aoi as Polygon;
    const [minX, minY, maxX, maxY] = turf.bbox(aoi);
    // margen para capturar concesiones que crucen el borde
    const pad = 0.01;
    const catastro = await sngmQueryGeoJSON(SNGM_CONCESIONES_URL, {
      bbox: [minX - pad, minY - pad, maxX + pad, maxY + pad],
      where: "SITUACION_CONCESION IN ('CONSTITUIDA','EN TRAMITE')",
      outFields: "NUMERO_ROL,SITUACION_CONCESION,TIPO_CONCESION,NOMBRE",
      returnGeometry: true,
      limit: 2000,
    });
    if (!catastro) return { ok: false, error: "No se pudo consultar el catastro SERNAGEOMIN." };

    const result = proposePedimento(aoi as Feature<Polygon> | Polygon, catastro, {
      maxHa: data.maxHa ?? 5000,
    });
    if (!result) {
      return { ok: false, error: "No hay terreno vacante suficiente en el AOI para un pedimento." };
    }
    return { ok: true, result, catastro };
  });
