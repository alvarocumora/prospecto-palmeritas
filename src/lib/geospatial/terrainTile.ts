import type { DemTile } from "@/engine3d/terrain/dem.functions";

/** CAD is derived from declared contours, never re-labelled as an official DEM. */
export type CadTerrainTile = Omit<DemTile, "source"> & {
  source: "cad_contours";
  validMask: boolean[];
  referenceElevationM: number;
};
export type TerrainTile = DemTile | CadTerrainTile;
