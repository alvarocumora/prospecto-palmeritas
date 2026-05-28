// Server function: retorna sondajes (drill holes) con collar y trayectoria
// proyectados a coordenadas locales ENU (metros) relativas al centro del proyecto.
//
// Los sondajes vienen en UTM (easting/northing) — convertimos a lng/lat con proj4
// y luego a ENU usando el centro del proyecto (mismo CRS local que las anomalías).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import proj4 from "proj4";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { lngLatToMeters } from "@/engine3d/geospatial/crs";

const InputSchema = z.object({
  projectId: z.string().uuid(),
});

export type DrillholeSegment = {
  /** Punto collar en ENU (metros) */
  collar: { x: number; y: number; z: number };
  /** Punto toe (fondo) en ENU (metros) */
  toe: { x: number; y: number; z: number };
  holeId: string;
  azimuth: number;
  dip: number;
  depth: number;
  status: string | null;
  isAi: boolean;
};

export type DrillholesDataset = {
  holes: DrillholeSegment[];
  count: number;
  source: "server" | "planned-from-targets" | "empty";
};

// EPSG:32719 = WGS84 / UTM zone 19S (Chile central — Los Verdes)
proj4.defs("EPSG:32719", "+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs");

function inferUtmZoneFromEasting(easting: number, northing: number): string {
  // Por defecto 19S para proyectos chilenos. Si vemos northings > 5e6 y eastings 100k-900k → UTM válido.
  // Se podría expandir según ubicación.
  void easting; void northing;
  return "EPSG:32719";
}

export const getDrillholes = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const [projectRes, holesRes] = await Promise.all([
      supabase
        .from("projects")
        .select("center_lng, center_lat")
        .eq("id", data.projectId)
        .maybeSingle(),
      supabase
        .from("drill_holes")
        .select("hole_id, easting, northing, elevation, azimuth, dip, actual_depth, planned_depth, status, is_ai")
        .eq("project_id", data.projectId),
    ]);

    const rows = (holesRes.data ?? []).filter(
      (r): r is typeof r & { easting: number; northing: number } =>
        r.easting != null && r.northing != null,
    );

    if (rows.length === 0) {
      return { holes: [], count: 0 } satisfies DrillholesDataset;
    }

    // Centro: usa el del proyecto si existe; si no, deriva del promedio de collares (UTM→lng/lat)
    const utm = inferUtmZoneFromEasting(Number(rows[0].easting), Number(rows[0].northing));
    const rowsLngLat = rows.map((r) => {
      const [lng, lat] = proj4(utm, "EPSG:4326", [Number(r.easting), Number(r.northing)]);
      return { ...r, lng, lat };
    });

    const centerLng =
      projectRes.data?.center_lng != null
        ? Number(projectRes.data.center_lng)
        : rowsLngLat.reduce((s, r) => s + r.lng, 0) / rowsLngLat.length;
    const centerLat =
      projectRes.data?.center_lat != null
        ? Number(projectRes.data.center_lat)
        : rowsLngLat.reduce((s, r) => s + r.lat, 0) / rowsLngLat.length;

    const elevations = rows.map((r) => Number(r.elevation ?? 0));
    const refElev =
      elevations.reduce((a, b) => a + b, 0) / Math.max(1, elevations.length);

    const holes: DrillholeSegment[] = rowsLngLat.map((r) => {
      const { x, y } = lngLatToMeters(r.lng, r.lat, centerLng, centerLat);
      const elev = Number(r.elevation ?? refElev);
      const depth = Math.max(0, Number(r.actual_depth ?? r.planned_depth ?? 0));
      // Azimuth: grados desde Norte (Y+ ENU), girando hacia Este (X+).
      const azRad = (Number(r.azimuth ?? 0) * Math.PI) / 180;
      // Dip: ángulo bajo la horizontal (positive = down). 90 = vertical.
      const dipRad = (Number(r.dip ?? 90) * Math.PI) / 180;
      const horiz = depth * Math.cos(dipRad);
      const dz = depth * Math.sin(dipRad);
      // Colar z relativa: queremos profundidad bajo la superficie ⇒ z=elev-refElev en superficie
      // Para una escena enfocada en sondajes, ponemos colar en z = (elev - refElev), toe en z = collar.z - dz
      const collarZ = elev - refElev;
      const dx = horiz * Math.sin(azRad);
      const dy = horiz * Math.cos(azRad);
      return {
        collar: { x, y, z: collarZ },
        toe: { x: x + dx, y: y + dy, z: collarZ - dz },
        holeId: String(r.hole_id),
        azimuth: Number(r.azimuth ?? 0),
        dip: Number(r.dip ?? 90),
        depth,
        status: r.status ?? null,
        isAi: Boolean(r.is_ai),
      };
    });

    return { holes, count: holes.length } satisfies DrillholesDataset;
  });
