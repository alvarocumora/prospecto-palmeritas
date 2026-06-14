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
  void easting;
  void northing;
  return "EPSG:32719";
}

export const getDrillholes = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const [projectRes, holesRes] = await Promise.all([
      supabaseAdmin
        .from("projects")
        .select("center_lng, center_lat")
        .eq("id", data.projectId)
        .maybeSingle(),
      supabaseAdmin
        .from("drill_holes")
        .select(
          "hole_id, easting, northing, elevation, azimuth, dip, actual_depth, planned_depth, status, is_ai",
        )
        .eq("project_id", data.projectId),
    ]);

    type HoleRow = {
      hole_id: string | null;
      easting: number | null;
      northing: number | null;
      elevation: number | null;
      azimuth: number | null;
      dip: number | null;
      actual_depth: number | null;
      planned_depth: number | null;
      status: string | null;
      is_ai: boolean | null;
    };

    const rows = ((holesRes.data ?? []) as HoleRow[]).filter(
      (r): r is HoleRow & { easting: number; northing: number } =>
        r.easting != null && r.northing != null,
    );

    const projectCenterLng =
      projectRes.data?.center_lng != null ? Number(projectRes.data.center_lng) : null;
    const projectCenterLat =
      projectRes.data?.center_lat != null ? Number(projectRes.data.center_lat) : null;

    // Fallback: si no hay drillholes reales, generar sondajes "planned/synthetic"
    // a partir de los targets de exploración del proyecto.
    if (rows.length === 0) {
      const tRes = await supabaseAdmin
        .from("exploration_targets")
        .select("code, name, lat, lng, elevation_m, priority")
        .eq("project_id", data.projectId)
        .neq("stage", "closed");
      type TargetRow = {
        code: string | null;
        name: string | null;
        lat: number | null;
        lng: number | null;
        elevation_m: number | null;
        priority: string | null;
      };
      const trows = ((tRes.data ?? []) as TargetRow[]).filter(
        (t): t is TargetRow & { lat: number; lng: number } => t.lat != null && t.lng != null,
      );
      if (trows.length === 0) {
        return { holes: [], count: 0, source: "empty" } satisfies DrillholesDataset;
      }
      const centerLng = projectCenterLng ?? trows.reduce((s, r) => s + r.lng, 0) / trows.length;
      const centerLat = projectCenterLat ?? trows.reduce((s, r) => s + r.lat, 0) / trows.length;
      const elevs = trows.map((r) => Number(r.elevation_m ?? 0));
      const refElev = elevs.reduce((a, b) => a + b, 0) / Math.max(1, elevs.length);
      const holes: DrillholeSegment[] = trows.map((r, i) => {
        const { x, y } = lngLatToMeters(r.lng, r.lat, centerLng, centerLat);
        const elev = Number(r.elevation_m ?? refElev);
        const depth = (r.priority ?? "").toLowerCase() === "critical" ? 350 : 250;
        const collarZ = elev - refElev;
        return {
          collar: { x, y, z: collarZ },
          toe: { x, y, z: collarZ - depth },
          holeId: r.code ?? r.name ?? `PLAN-${i + 1}`,
          azimuth: 0,
          dip: 90,
          depth,
          status: "planned",
          isAi: true,
        };
      });
      return {
        holes,
        count: holes.length,
        source: "planned-from-targets",
      } satisfies DrillholesDataset;
    }

    // Centro: usa el del proyecto si existe; si no, deriva del promedio de collares (UTM→lng/lat)
    const utm = inferUtmZoneFromEasting(Number(rows[0].easting), Number(rows[0].northing));
    const rowsLngLat = rows.map((r) => {
      const [lng, lat] = proj4(utm, "EPSG:4326", [Number(r.easting), Number(r.northing)]);
      return { ...r, lng, lat };
    });

    const centerLng =
      projectCenterLng ?? rowsLngLat.reduce((s, r) => s + r.lng, 0) / rowsLngLat.length;
    const centerLat =
      projectCenterLat ?? rowsLngLat.reduce((s, r) => s + r.lat, 0) / rowsLngLat.length;

    const elevations = rows.map((r) => Number(r.elevation ?? 0));
    const refElev = elevations.reduce((a, b) => a + b, 0) / Math.max(1, elevations.length);

    const holes: DrillholeSegment[] = rowsLngLat.map((r) => {
      const { x, y } = lngLatToMeters(r.lng, r.lat, centerLng, centerLat);
      const elev = Number(r.elevation ?? refElev);
      const depth = Math.max(0, Number(r.actual_depth ?? r.planned_depth ?? 0));
      const azRad = (Number(r.azimuth ?? 0) * Math.PI) / 180;
      const dipRad = (Number(r.dip ?? 90) * Math.PI) / 180;
      const horiz = depth * Math.cos(dipRad);
      const dz = depth * Math.sin(dipRad);
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

    return { holes, count: holes.length, source: "server" } satisfies DrillholesDataset;
  });
