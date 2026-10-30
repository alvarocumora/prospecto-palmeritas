/**
 * Regional public geophysics, as MapLibre raster sources (WMS tile templates).
 * Same services/layers as the legacy Leaflet overlay (`components/map/geophysicsOverlays.ts`),
 * reformatted for MapLibre's `{bbox-epsg-3857}` WMS tile template support.
 *
 * Escala apropiada para contexto regional/distrital, NO para escala de prospecto
 * (EMAG2 ~3.7 km, WGM2012 ~10 km de resolución nativa).
 */
export type RegionalGeophysicsSource = {
  id: "geophysics.emag2" | "geophysics.wgm2012";
  sourceId: string;
  tiles: [string];
  attribution: string;
};

const WMS_TILE_PARAMS =
  "service=WMS&request=GetMap&version=1.1.1&format=image/png&transparent=true&width=256&height=256&srs=EPSG:3857&bbox={bbox-epsg-3857}";

export const REGIONAL_GEOPHYSICS_SOURCES: readonly RegionalGeophysicsSource[] = [
  {
    id: "geophysics.emag2",
    sourceId: "regional-emag2",
    tiles: [
      `https://gis.ngdc.noaa.gov/arcgis/services/EMAG2v3/ImageServer/WMSServer?${WMS_TILE_PARAMS}&layers=0&styles=`,
    ],
    attribution: "Magnetometría EMAG2 v3 © NOAA NCEI · contexto regional",
  },
  {
    id: "geophysics.wgm2012",
    sourceId: "regional-wgm2012",
    tiles: [
      `https://bgi.obs-mip.fr/cgi-bin/wgm2012?${WMS_TILE_PARAMS}&layers=WGM2012_Bouguer&styles=`,
    ],
    attribution: "Gravimetría WGM2012 Bouguer © BGI/CGMW · contexto regional",
  },
];
