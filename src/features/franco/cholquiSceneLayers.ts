import type { GeoSceneProject, GeoSceneProjectLayer } from "@/components/geoscene/projectLayers";
import { buildCholquiPublicGeoBundle } from "./cholquiPublicGeo";
import { cholquiCadTerrain, cholquiCadTerrainNotice } from "@/lib/cholqui/cadTerrain";
import { bundleSceneLayers } from "@/components/geoscene/bundleAdapter";
import { terrainGridCoordinate } from "@/lib/geospatial/terrainCoordinates";
import imageryAsset from "@/assets/cholqui-world-imagery.jpg.asset.json";
import imageryMeta from "@/data/geo/cholqui_satellite_imagery.json";

const SCENE_IDS = [
  "territory.cadastre",
  "territory.pending_pedimentos",
  "territory.proposed_pedimentos",
  "territory.mojones",
] as const;

const SOURCES: Record<(typeof SCENE_IDS)[number], string> = {
  "territory.cadastre": "SERNAGEOMIN (copias oficiales SIGEX/ArcGIS Online)",
  "territory.pending_pedimentos": "KML del titular — no publicado",
  "territory.proposed_pedimentos": "Borrador del proyecto",
  "territory.mojones": "KML del titular (FINAL_GIANFRANCO.kml)",
};

/** Cholqui tenure layers + explicit project frame for GeoScene3D. */
export function buildCholquiSceneInput(): {
  project: GeoSceneProject;
  layers: GeoSceneProjectLayer[];
} {
  const bundle = buildCholquiPublicGeoBundle();
  const tile = cholquiCadTerrain;
  const southwest = terrainGridCoordinate(
    Number(tile.centerLat),
    Number(tile.centerLng),
    2,
    tile.extentMeters,
    0,
    1,
  );
  const northeast = terrainGridCoordinate(
    Number(tile.centerLat),
    Number(tile.centerLng),
    2,
    tile.extentMeters,
    1,
    0,
  );
  return {
    project: {
      id: "e5360f13-1647-4e44-bb13-c0614e6f39fe",
      name: "Cholqui",
      center: bundle.center,
      // National geological context must not zoom the project frame out to Chile.
      bbox: [southwest[0], southwest[1], northeast[0], northeast[1]],
      cadTerrain: {
        tile,
        notice: cholquiCadTerrainNotice,
        imagery: {
          url: imageryAsset.url,
          bbox: imageryMeta.bbox as [number, number, number, number],
          attribution: imageryMeta.attribution,
          notice: imageryMeta.notice,
        },
      },
    },
    layers: bundleSceneLayers(bundle).map((layer) => ({
      ...layer,
      defaultVisible: [
        "territory.cadastre",
        "territory.mojones",
        "sampling.assays",
        "geology.structures",
      ].includes(layer.id),
      source: SCENE_IDS.includes(layer.id as (typeof SCENE_IDS)[number])
        ? SOURCES[layer.id as (typeof SCENE_IDS)[number]]
        : undefined,
    })),
  };
}
