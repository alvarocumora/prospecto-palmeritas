import type { FeatureCollection } from "geojson";
import type { GeoSceneProject, GeoSceneProjectLayer } from "@/components/geoscene/projectLayers";
import { buildCholquiPublicGeoBundle } from "./cholquiPublicGeo";
import { cholquiCadTerrain, cholquiCadTerrainNotice } from "@/lib/cholqui/cadTerrain";
import { bundleSceneLayers } from "@/components/geoscene/bundleAdapter";

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
  return {
    project: { id: "e5360f13-1647-4e44-bb13-c0614e6f39fe", name: "Cholqui", center: bundle.center,
      bbox: bundle.bbox,
      cadTerrain: { tile: cholquiCadTerrain, notice: cholquiCadTerrainNotice },
    },
    layers: bundleSceneLayers(bundle).map((layer) => ({
      ...layer,
      source: SCENE_IDS.includes(layer.id as (typeof SCENE_IDS)[number])
        ? SOURCES[layer.id as (typeof SCENE_IDS)[number]] : undefined,
    })),
  };
}
