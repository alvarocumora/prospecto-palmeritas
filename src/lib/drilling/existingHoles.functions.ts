// Server function: ubicaciones (lat/lng) de sondajes ya ejecutados o en curso
// de un proyecto, para alimentar la selección geoestadística de nuevos
// targets (ganancia de información respecto a lo ya perforado). Los
// sondajes vienen en UTM (easting/northing) — se convierten con proj4,
// igual que en engine3d/data/drillholes.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import proj4 from "proj4";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  projectId: z.string().uuid(),
});

export type ExistingHoleLocation = { lat: number; lng: number };

// EPSG:32719 = WGS84 / UTM zone 19S (Chile central — Cholqui, Los Verdes).
proj4.defs("EPSG:32719", "+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs");

/** Estados que representan terreno efectivamente investigado (no un sondaje solo propuesto). */
const INVESTIGATED_STATUSES = new Set(["completed", "in_progress"]);

export const getExistingDrillholeLocations = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<ExistingHoleLocation[]> => {
    const { data: rows } = await supabaseAdmin
      .from("drill_holes")
      .select("easting, northing, status")
      .eq("project_id", data.projectId);

    type HoleRow = { easting: number | null; northing: number | null; status: string | null };

    return ((rows ?? []) as HoleRow[])
      .filter(
        (r): r is HoleRow & { easting: number; northing: number } =>
          r.easting != null && r.northing != null && INVESTIGATED_STATUSES.has(r.status ?? ""),
      )
      .map((r) => {
        const [lng, lat] = proj4("EPSG:32719", "EPSG:4326", [r.easting, r.northing]);
        return { lat, lng };
      });
  });
