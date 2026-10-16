import grid from "@/data/geo/cholqui_cad_terrain.json";
import type { CadTerrainTile } from "@/lib/geospatial/terrainTile";

/** Null elevations stay masked; zero below is only unused GPU storage, never evidence. */
export const cholquiCadTerrain: CadTerrainTile = {
  source: "cad_contours",
  heights: grid.heights.map((height) => height ?? 0),
  validMask: grid.heights.map((height) => height != null && Number.isFinite(height)),
  size: grid.size,
  extentMeters: grid.extentMeters,
  centerLat: grid.centerLat,
  centerLng: grid.centerLng,
  centerElevationM: null,
  referenceElevationM: grid.referenceElevationM,
  minH: grid.minH,
  maxH: grid.maxH,
};

export const cholquiCadTerrainNotice =
  `Fuente: ${grid.contourCount} curvas del DWG del titular (14-oct-2026), ` +
  `${grid.sourceMinElevationM}–${grid.sourceMaxElevationM} m · DECLARADO. ` +
  `Relieve DERIVADO por interpolación lineal Delaunay; grilla visual ` +
  `${(grid.extentMeters / (grid.size - 1)).toFixed(1)} m (no precisión del levantamiento). ` +
  `Sin extrapolación: se omiten triángulos con aristas mayores de ${grid.maxTriangleEdgeM} m. ` +
  `Cotas de escena relativas a ${grid.referenceElevationM} m; exageración vertical 1×. ` +
  `UTM 19S/WGS84 asumido en la extracción; datum horizontal y vertical pendientes de verificación. ` +
  `No se fusionan cotas con Copernicus ni reemplaza la mensura oficial.`;
