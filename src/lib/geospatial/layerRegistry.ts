/**
 * Canonical geospatial layer registry for GeoCapitals.
 *
 * This is the shared contract between the official 2D workbench (ProjectMap),
 * GeoScene3D, field mode, public/live views and report snapshots.
 *
 * It intentionally stores metadata/capabilities, not runtime Leaflet/deck.gl objects.
 * Project-specific adapters provide the actual data and renderer implementation.
 */

export type GeoLayerDomain =
  | "basemap"
  | "territory"
  | "remote_sensing"
  | "geology"
  | "geophysics"
  | "geochemistry"
  | "sampling"
  | "targets"
  | "drilling"
  | "models";

export type GeoEvidenceClass =
  "OFICIAL" | "MEDIDO" | "CERTIFICADO" | "DERIVADO" | "INTERPRETADO" | "PROPUESTO" | "CONTEXTO";

export type GeoLayerCapability = "2d" | "3d" | "field" | "public" | "report";

export type GeoLayerUse = "evidence" | "context" | "proposal" | "visualization";

export type GeoLayerDefinition = {
  id: string;
  label: string;
  domain: GeoLayerDomain;
  evidence: GeoEvidenceClass;
  use: GeoLayerUse;
  scaleLabel: string;
  sourceSystem: string;
  datasetType?: string;
  units?: string;
  capabilities: readonly GeoLayerCapability[];
  /** Existing layer identifiers accepted during migration. */
  legacyAliases: readonly string[];
  /** Short evidence/scale warning rendered by inspectors and reports. */
  caution?: string;
};

const layer = (definition: GeoLayerDefinition): GeoLayerDefinition => definition;

export const GEO_LAYER_REGISTRY = [
  layer({
    id: "basemap.esri_imagery",
    label: "Esri World Imagery",
    domain: "basemap",
    evidence: "CONTEXTO",
    use: "visualization",
    scaleLabel: "basemap",
    sourceSystem: "Esri",
    capabilities: ["2d", "field", "public", "report"],
    legacyAliases: ["basemap:esri-imagery"],
    caution: "Imagen base para orientación; no constituye evidencia geológica.",
  }),
  layer({
    id: "basemap.esri_topo",
    label: "Esri Topographic",
    domain: "basemap",
    evidence: "CONTEXTO",
    use: "visualization",
    scaleLabel: "basemap",
    sourceSystem: "Esri",
    capabilities: ["2d", "field", "public", "report"],
    legacyAliases: ["basemap:esri-topo"],
  }),
  layer({
    id: "basemap.carto_dark",
    label: "CARTO Dark",
    domain: "basemap",
    evidence: "CONTEXTO",
    use: "visualization",
    scaleLabel: "basemap",
    sourceSystem: "CARTO",
    capabilities: ["2d", "field"],
    legacyAliases: ["basemap:carto-dark"],
  }),
  layer({
    id: "basemap.opentopo",
    label: "OpenTopoMap",
    domain: "basemap",
    evidence: "CONTEXTO",
    use: "visualization",
    scaleLabel: "basemap",
    sourceSystem: "OpenTopoMap",
    capabilities: ["2d", "field"],
    legacyAliases: ["basemap:opentopo"],
  }),
  layer({
    id: "territory.cadastre",
    label: "Catastro SERNAGEOMIN",
    domain: "territory",
    evidence: "OFICIAL",
    use: "evidence",
    scaleLabel: "catastro",
    sourceSystem: "SERNAGEOMIN",
    datasetType: "geology",
    capabilities: ["2d", "3d", "field", "public", "report"],
    legacyAliases: [
      "tenencia",
      "concessions:project",
      "catastro:EXPLOTA_1983",
      "catastro:EXPLOTA_1932",
      "catastro:EXPLORA_1983",
      "catastro:ESTACAMENTO",
      "sernageomin:explotacion",
      "sernageomin:exploracion",
      "sernageomin:mensura",
      "sernageomin:manifestacion",
    ],
  }),
  layer({
    id: "territory.pending_pedimentos",
    label: "Pedimentos del titular no publicados",
    domain: "territory",
    evidence: "CONTEXTO",
    use: "context",
    scaleLabel: "KML titular",
    sourceSystem: "Titular / proyecto",
    capabilities: ["2d", "3d", "field", "public", "report"],
    legacyAliases: ["pedimentosPendientes"],
    caution: "Verificar publicación y estado legal antes de tratar como tenencia.",
  }),
  layer({
    id: "territory.mojones",
    label: "Hitos de mensura",
    domain: "territory",
    evidence: "CONTEXTO",
    use: "context",
    scaleLabel: "HM declarado",
    sourceSystem: "Titular / proyecto",
    capabilities: ["2d", "3d", "field", "public", "report"],
    legacyAliases: ["mojones"],
  }),
  layer({
    id: "territory.project_center",
    label: "Centro del proyecto",
    domain: "territory",
    evidence: "CONTEXTO",
    use: "visualization",
    scaleLabel: "punto de referencia",
    sourceSystem: "projects",
    capabilities: ["2d", "3d", "field", "public", "report"],
    legacyAliases: ["geo:prospect"],
    caution: "Punto de referencia del proyecto; no representa un cuerpo geológico.",
  }),
  layer({
    id: "territory.protected_areas",
    label: "Áreas protegidas",
    domain: "territory",
    evidence: "OFICIAL",
    use: "context",
    scaleLabel: "regional",
    sourceSystem: "SNASPE / IDE",
    capabilities: ["2d", "report"],
    legacyAliases: ["geochile:areas-protegidas"],
  }),
  layer({
    id: "territory.external_infrastructure",
    label: "Infraestructura OSM",
    domain: "territory",
    evidence: "CONTEXTO",
    use: "context",
    scaleLabel: "vista actual",
    sourceSystem: "OpenStreetMap / Overpass",
    capabilities: ["2d", "field"],
    legacyAliases: ["ext:osm-infra"],
  }),
  layer({
    id: "territory.seismic_context",
    label: "Sismicidad USGS",
    domain: "territory",
    evidence: "CONTEXTO",
    use: "context",
    scaleLabel: "último mes",
    sourceSystem: "USGS",
    capabilities: ["2d"],
    legacyAliases: ["ext:usgs-quakes"],
  }),
  layer({
    id: "territory.proposed_pedimentos",
    label: "Pedimentos propuestos",
    domain: "territory",
    evidence: "PROPUESTO",
    use: "proposal",
    scaleLabel: "borrador",
    sourceSystem: "Proyecto",
    capabilities: ["2d", "3d", "field", "public", "report"],
    legacyAliases: ["pedimentos"],
    caution: "Borrador/propuesta; no tratar como tenencia oficial.",
  }),
  layer({
    id: "territory.dem",
    label: "DEM / relieve",
    domain: "territory",
    evidence: "OFICIAL",
    use: "evidence",
    scaleLabel: "DEM ~30 m",
    sourceSystem: "Copernicus / SRTM",
    datasetType: "dem",
    units: "m",
    capabilities: ["2d", "3d", "field", "public", "report"],
    legacyAliases: ["sat:copernicus-dem"],
    caution: "El remuestreo no crea detalle topográfico nuevo.",
  }),
  layer({
    id: "territory.hillshade",
    label: "Hillshade / relieve sombreado",
    domain: "territory",
    evidence: "DERIVADO",
    use: "visualization",
    scaleLabel: "SRTM / DEM",
    sourceSystem: "Esri / SRTM",
    datasetType: "dem",
    capabilities: ["2d", "3d", "field", "report"],
    legacyAliases: ["relieve", "geophys:hillshade"],
    caution: "Representación de relieve derivada de un DEM; no agrega resolución al terreno.",
  }),
  layer({
    id: "remote_sensing.sentinel2_alteration",
    label: "Sentinel-2 · alteración espectral",
    domain: "remote_sensing",
    evidence: "DERIVADO",
    use: "evidence",
    scaleLabel: "10–20 m",
    sourceSystem: "Copernicus Sentinel-2",
    datasetType: "remote_sensing",
    capabilities: ["2d", "3d", "field", "public", "report"],
    legacyAliases: ["halos"],
    caution: "Proxy espectral; requiere ground-truth y no confirma mineralización.",
  }),
  layer({
    id: "remote_sensing.sentinel2_processed_indices",
    label: "Sentinel-2 · índices procesados",
    domain: "remote_sensing",
    evidence: "DERIVADO",
    use: "visualization",
    scaleLabel: "malla reducida · píxeles fuente 20 m",
    sourceSystem: "Copernicus Sentinel-2 L2A",
    datasetType: "remote_sensing",
    capabilities: ["2d", "3d", "public", "report"],
    legacyAliases: [],
    caution:
      "Vista vectorial reducida del GeoTIFF. Valores derivados modelados; no son ensayes ni identificación mineral.",
  }),
  layer({
    id: "remote_sensing.sentinel2_truecolor",
    label: "Sentinel-2 · color verdadero",
    domain: "remote_sensing",
    evidence: "DERIVADO",
    use: "visualization",
    scaleLabel: "10 m",
    sourceSystem: "Copernicus Sentinel-2",
    datasetType: "remote_sensing",
    capabilities: ["2d", "3d", "public", "report"],
    legacyAliases: ["sat:s2-truecolor"],
  }),
  layer({
    id: "remote_sensing.sentinel2_ndvi",
    label: "Sentinel-2 · NDVI",
    domain: "remote_sensing",
    evidence: "DERIVADO",
    use: "context",
    scaleLabel: "10 m",
    sourceSystem: "Copernicus Sentinel-2",
    datasetType: "remote_sensing",
    capabilities: ["2d", "report"],
    legacyAliases: ["sat:s2-ndvi"],
    caution: "Índice de vegetación; no es indicador directo de mineralización.",
  }),
  layer({
    id: "remote_sensing.worldcover",
    label: "ESA WorldCover",
    domain: "remote_sensing",
    evidence: "DERIVADO",
    use: "context",
    scaleLabel: "10 m",
    sourceSystem: "ESA WorldCover",
    datasetType: "remote_sensing",
    capabilities: ["2d", "field", "report"],
    legacyAliases: ["sat:worldcover"],
  }),
  layer({
    id: "remote_sensing.lineaments",
    label: "Lineamientos derivados de teledetección",
    domain: "remote_sensing",
    evidence: "DERIVADO",
    use: "evidence",
    scaleLabel: "interpretación estructural",
    sourceSystem: "Sentinel / GeoCapitals",
    datasetType: "remote_sensing",
    capabilities: ["2d", "3d", "field", "public", "report"],
    legacyAliases: ["sat:lineaments", "STRUCTURAL_LINEAMENTS"],
    caution: "Lineamiento derivado de imagen; requiere verificación estructural en terreno.",
  }),
  layer({
    id: "remote_sensing.anomaly_intensity",
    label: "Intensidad de anomalías espectrales",
    domain: "remote_sensing",
    evidence: "DERIVADO",
    use: "evidence",
    scaleLabel: "IDW · z-score",
    sourceSystem: "GeoCapitals",
    datasetType: "remote_sensing",
    // "public" agregado al portar la superficie IDW de ProjectMasterViewer
    // (Cholqui) a PublicCanonicalMap — la definición ya existía pero sin
    // datos ni renderer conectados a ningún preset público.
    capabilities: ["2d", "3d", "public", "report"],
    legacyAliases: ["halosIntensidad"],
    caution: "Superficie interpolada; no es kriging ni medición continua en terreno.",
  }),
  layer({
    id: "remote_sensing.insar",
    label: "InSAR",
    domain: "remote_sensing",
    evidence: "DERIVADO",
    use: "evidence",
    scaleLabel: "satélite radar",
    sourceSystem: "Sentinel-1 / procesamiento",
    datasetType: "remote_sensing",
    units: "mm/año",
    capabilities: ["2d", "3d", "report"],
    legacyAliases: ["insar"],
  }),
  layer({
    id: "remote_sensing.hyperspectral",
    label: "Productos hiperespectrales",
    domain: "remote_sensing",
    evidence: "DERIVADO",
    use: "evidence",
    scaleLabel: "sensor/producto",
    sourceSystem: "ASTER / EMIT / proveedor",
    datasetType: "remote_sensing",
    capabilities: ["2d", "3d", "report"],
    legacyAliases: ["hyper_aster", "hyper_emit"],
  }),
  layer({
    id: "remote_sensing.dem_diff",
    label: "DEM-diff / stockpiles",
    domain: "remote_sensing",
    evidence: "DERIVADO",
    use: "evidence",
    scaleLabel: "diferencia DEM",
    sourceSystem: "GeoCapitals",
    datasetType: "dem",
    units: "m³",
    capabilities: ["2d", "3d", "report"],
    legacyAliases: ["demdiff"],
    caution: "Volumen geométrico derivado; no equivale a tonelaje mineral.",
  }),
  layer({
    id: "geology.host_rock",
    label: "Litología / roca caja",
    domain: "geology",
    evidence: "OFICIAL",
    use: "evidence",
    scaleLabel: "mapa geológico",
    sourceSystem: "SERNAGEOMIN / Macrostrat / proyecto",
    datasetType: "geology",
    capabilities: ["2d", "3d", "field", "report"],
    legacyAliases: ["geo:host-rock", "geochile:litologia"],
  }),
  layer({
    id: "geology.macrostrat_context",
    label: "Macrostrat · contexto geológico",
    domain: "geology",
    evidence: "CONTEXTO",
    use: "context",
    scaleLabel: "global / regional",
    sourceSystem: "Macrostrat",
    datasetType: "geology",
    capabilities: ["2d", "report"],
    legacyAliases: ["geo:macrostrat"],
    caution: "Fallback global; priorizar cartografía oficial/local cuando exista.",
  }),
  layer({
    id: "geology.alteration",
    label: "Alteración geológica",
    domain: "geology",
    evidence: "INTERPRETADO",
    use: "evidence",
    scaleLabel: "mapeo / interpretación",
    sourceSystem: "Proyecto",
    datasetType: "geology",
    capabilities: ["2d", "3d", "field", "report"],
    legacyAliases: ["geo:alteration"],
  }),
  layer({
    id: "geology.structures",
    label: "Estructuras, vetas y lineamientos",
    domain: "geology",
    evidence: "MEDIDO",
    use: "evidence",
    scaleLabel: "punto / rumbo-manteo",
    sourceSystem: "Terreno / proyecto",
    datasetType: "structure",
    capabilities: ["2d", "3d", "field", "public", "report"],
    legacyAliases: ["estructuras"],
  }),
  layer({
    id: "geology.interpreted_structures",
    label: "Vetas / estructuras interpretadas",
    domain: "geology",
    evidence: "INTERPRETADO",
    use: "evidence",
    scaleLabel: "mapeo / modelo conceptual",
    sourceSystem: "Proyecto / interpretación",
    datasetType: "structure",
    capabilities: ["2d", "3d", "public", "report"],
    legacyAliases: ["veins:interpreted"],
    caution:
      "Geometría interpretada o conceptual; no tratar como estructura medida sin respaldo de terreno.",
  }),
  layer({
    id: "geology.metallogenic_belts",
    label: "Franjas metalogénicas",
    domain: "geology",
    evidence: "OFICIAL",
    use: "context",
    scaleLabel: "regional",
    sourceSystem: "SERNAGEOMIN",
    datasetType: "geology",
    capabilities: ["2d", "public", "report"],
    legacyAliases: ["franjas"],
  }),
  layer({
    id: "geology.known_deposits",
    label: "Yacimientos conocidos",
    domain: "geology",
    evidence: "OFICIAL",
    use: "context",
    scaleLabel: "depósito",
    sourceSystem: "SERNAGEOMIN",
    datasetType: "geology",
    capabilities: ["2d", "3d", "public", "report"],
    legacyAliases: ["yacimientos", "geochile:yacimientos"],
  }),
  layer({
    id: "geophysics.emag2",
    label: "Magnetometría EMAG2 v3",
    domain: "geophysics",
    evidence: "DERIVADO",
    use: "context",
    scaleLabel: "~3.7 km regional",
    sourceSystem: "NOAA NCEI",
    datasetType: "geophysics",
    units: "nT",
    capabilities: ["2d", "3d", "report"],
    legacyAliases: ["magneticaRegional", "geophys:emag2"],
    caution: "Contexto regional; no usar como geofísica de detalle del prospecto.",
  }),
  layer({
    id: "geophysics.wgm2012",
    label: "Gravedad Bouguer WGM2012",
    domain: "geophysics",
    evidence: "DERIVADO",
    use: "context",
    scaleLabel: "~10 km regional",
    sourceSystem: "BGI WGM2012",
    datasetType: "geophysics",
    units: "mGal",
    capabilities: ["2d", "3d", "report"],
    legacyAliases: ["gravedadRegional", "geophys:wgm2012"],
    caution: "Contexto regional; no usar como gravimetría de detalle del prospecto.",
  }),
  layer({
    id: "geophysics.planned_survey",
    label: "Geofísica planificada",
    domain: "geophysics",
    evidence: "PROPUESTO",
    use: "proposal",
    scaleLabel: "líneas / estaciones",
    sourceSystem: "Programa geofísico",
    datasetType: "geophysics",
    capabilities: ["2d", "3d", "field", "report"],
    legacyAliases: ["geophys:planned"],
    caution: "Diseño de campaña; no es evidencia medida.",
  }),
  layer({
    id: "geophysics.project_stations",
    label: "Geofísica de proyecto · estaciones y líneas",
    domain: "geophysics",
    evidence: "MEDIDO",
    use: "evidence",
    scaleLabel: "estaciones",
    sourceSystem: "Campaña de terreno",
    datasetType: "geophysics",
    capabilities: ["2d", "3d", "field", "report"],
    legacyAliases: ["geofisicaProyecto", "geophys:real"],
  }),
  layer({
    id: "geophysics.mag_idw",
    label: "Superficie magnética residual",
    domain: "geophysics",
    evidence: "INTERPRETADO",
    use: "evidence",
    scaleLabel: "CAMPO → IDW",
    sourceSystem: "GeoCapitals",
    datasetType: "geophysics",
    units: "nT",
    capabilities: ["2d", "3d", "report"],
    legacyAliases: ["magSurfaceProject"],
    caution: "Interpolación IDW de estaciones medidas; no es inversión 3D.",
  }),
  layer({
    id: "geophysics.ip_chargeability_idw",
    label: "IP cargabilidad · superficie",
    domain: "geophysics",
    evidence: "INTERPRETADO",
    use: "evidence",
    scaleLabel: "CAMPO → IDW",
    sourceSystem: "GeoCapitals",
    datasetType: "geophysics",
    units: "mV/V",
    capabilities: ["2d", "3d", "report"],
    legacyAliases: ["ipChargeSurfaceProject"],
  }),
  layer({
    id: "geophysics.ip_resistivity_idw",
    label: "IP resistividad · superficie",
    domain: "geophysics",
    evidence: "INTERPRETADO",
    use: "evidence",
    scaleLabel: "CAMPO → IDW",
    sourceSystem: "GeoCapitals",
    datasetType: "geophysics",
    units: "ohm·m",
    capabilities: ["2d", "3d", "report"],
    legacyAliases: ["ipResSurfaceProject"],
  }),
  layer({
    id: "geophysics.anomalies",
    label: "Anomalías geofísicas interpretadas",
    domain: "geophysics",
    evidence: "INTERPRETADO",
    use: "evidence",
    scaleLabel: "anomalía / profundidad estimada",
    sourceSystem: "geophysics_anomalies",
    datasetType: "geophysics",
    capabilities: ["2d", "3d", "public", "report"],
    legacyAliases: ["geoscene-geophys-anomalies"],
    caution:
      "La profundidad y geometría son interpretadas; no equivalen a un cuerpo mineral probado.",
  }),
  layer({
    id: "geochemistry.stream_sediment",
    label: "Geoquímica de sedimentos",
    domain: "geochemistry",
    evidence: "MEDIDO",
    use: "evidence",
    scaleLabel: "sedimento",
    sourceSystem: "SERNAGEOMIN / campaña",
    datasetType: "geochemistry",
    capabilities: ["2d", "3d", "report"],
    legacyAliases: ["geoquimica"],
    caution: "Dispersión geoquímica; no equivale a ley in situ.",
  }),
  layer({
    id: "sampling.results",
    label: "Muestreo de proyecto",
    domain: "sampling",
    evidence: "MEDIDO",
    use: "evidence",
    scaleLabel: "muestra puntual",
    sourceSystem: "sampling_results",
    datasetType: "assay",
    capabilities: ["2d", "3d", "field", "public", "report"],
    legacyAliases: ["samples:raw", "samples:draft"],
    caution:
      "Revisar record_status, laboratorio y certificado antes de tratar un resultado como certificado.",
  }),
  layer({
    id: "sampling.assays",
    label: "Ensayes certificados",
    domain: "sampling",
    evidence: "CERTIFICADO",
    use: "evidence",
    scaleLabel: "muestra puntual",
    sourceSystem: "Laboratorio / proyecto",
    datasetType: "assay",
    capabilities: ["2d", "3d", "field", "public", "report"],
    legacyAliases: ["ensayes", "samples:project"],
  }),
  layer({
    id: "sampling.drill_intercepts",
    label: "Interceptos de sondaje",
    domain: "sampling",
    evidence: "INTERPRETADO",
    use: "evidence",
    scaleLabel: "intervalo compositado",
    sourceSystem: "drill_core_logs / desurvey",
    datasetType: "assay",
    capabilities: ["3d", "report"],
    legacyAliases: ["geoscene-intercepts"],
    caution: "Intervalo interpretado a partir de logs/ensayes; no es una estimación de recursos.",
  }),
  layer({
    id: "remote_sensing.drone_survey",
    label: "Drones · vuelos y rasters",
    domain: "remote_sensing",
    evidence: "MEDIDO",
    use: "evidence",
    scaleLabel: "campaña UAV",
    sourceSystem: "drone_flights / drone_rasters",
    datasetType: "remote_sensing",
    capabilities: ["2d", "3d", "field", "report"],
    legacyAliases: ["drones:flights", "drones:rasters"],
  }),
  layer({
    id: "targets.exploration",
    label: "Targets de exploración",
    domain: "targets",
    evidence: "INTERPRETADO",
    use: "evidence",
    scaleLabel: "target",
    sourceSystem: "exploration_targets",
    capabilities: ["2d", "3d", "field", "public", "report"],
    legacyAliases: ["targets", "targets:project", "hotspots_high"],
    caution: "Target priorizado; no constituye recurso ni mineralización confirmada.",
  }),
  layer({
    id: "drilling.proposed",
    label: "Sondajes propuestos",
    domain: "drilling",
    evidence: "PROPUESTO",
    use: "proposal",
    scaleLabel: "conceptual",
    sourceSystem: "Programa de exploración",
    datasetType: "drilling",
    capabilities: ["2d", "3d", "field", "public", "report"],
    legacyAliases: ["sondajes"],
  }),
  layer({
    id: "drilling.completed",
    label: "Sondajes ejecutados",
    domain: "drilling",
    evidence: "MEDIDO",
    use: "evidence",
    scaleLabel: "collar / trayectoria",
    sourceSystem: "drillholes",
    datasetType: "drilling",
    capabilities: ["2d", "3d", "field", "report"],
    legacyAliases: ["drills:project"],
  }),
  layer({
    id: "models.implicit_geology",
    label: "Modelo geológico 3D",
    domain: "models",
    evidence: "INTERPRETADO",
    use: "evidence",
    scaleLabel: "modelo 3D",
    sourceSystem: "geoscience_compute_jobs",
    datasetType: "model_3d",
    capabilities: ["3d", "report"],
    legacyAliases: ["model:implicit-geology"],
    caution: "Modelo interpretado; conservar inputs, versión, hash y motor de cómputo.",
  }),
  layer({
    id: "models.resource_blocks",
    label: "Block model / recursos",
    domain: "models",
    evidence: "INTERPRETADO",
    use: "evidence",
    scaleLabel: "block model",
    sourceSystem: "geoscience_compute_jobs",
    datasetType: "block_model",
    capabilities: ["3d", "report"],
    legacyAliases: ["resource:blocks"],
    caution:
      "Sólo mostrar clasificación de recursos cuando exista estimación y revisión competente aplicable.",
  }),
] as const satisfies readonly GeoLayerDefinition[];

export type CanonicalGeoLayerId = (typeof GEO_LAYER_REGISTRY)[number]["id"];

const BY_ID = new Map<string, GeoLayerDefinition>(
  GEO_LAYER_REGISTRY.map((definition) => [definition.id, definition] as const),
);

const BY_ALIAS = new Map<string, GeoLayerDefinition>();
for (const definition of GEO_LAYER_REGISTRY) {
  for (const alias of definition.legacyAliases) {
    if (BY_ALIAS.has(alias)) {
      throw new Error(`Duplicate geospatial layer alias: ${alias}`);
    }
    BY_ALIAS.set(alias, definition);
  }
}

export function getGeoLayer(id: string): GeoLayerDefinition | null {
  return BY_ID.get(id) ?? null;
}

export function resolveGeoLayer(idOrAlias: string): GeoLayerDefinition | null {
  return BY_ID.get(idOrAlias) ?? BY_ALIAS.get(idOrAlias) ?? null;
}

export function layersForCapability(capability: GeoLayerCapability): GeoLayerDefinition[] {
  return GEO_LAYER_REGISTRY.filter((definition) =>
    (definition.capabilities as readonly GeoLayerCapability[]).includes(capability),
  );
}

export function layersForDomain(domain: GeoLayerDomain): GeoLayerDefinition[] {
  return GEO_LAYER_REGISTRY.filter((definition) => definition.domain === domain);
}

export type GeoViewerPresetId =
  "official_workbench" | "official_3d" | "field" | "public_live" | "toki2_field";

export type GeoViewerPreset = {
  id: GeoViewerPresetId;
  label: string;
  capability: GeoLayerCapability;
  enabled: readonly CanonicalGeoLayerId[];
};

export const GEO_VIEWER_PRESETS: readonly GeoViewerPreset[] = [
  {
    id: "official_workbench",
    label: "Official Geo Workbench",
    capability: "2d",
    enabled: [
      "territory.cadastre",
      "territory.hillshade",
      "remote_sensing.sentinel2_alteration",
      "geology.host_rock",
      "geology.alteration",
      "geology.structures",
      "geophysics.project_stations",
      "sampling.assays",
      "targets.exploration",
      "drilling.completed",
    ],
  },
  {
    id: "official_3d",
    label: "Official GeoScene3D",
    capability: "3d",
    enabled: [
      "territory.dem",
      "remote_sensing.sentinel2_alteration",
      "targets.exploration",
      "drilling.completed",
      "drilling.proposed",
      "sampling.drill_intercepts",
      "geophysics.anomalies",
      "models.implicit_geology",
    ],
  },
  {
    id: "field",
    label: "Field Mode",
    capability: "field",
    enabled: [
      "territory.cadastre",
      "territory.dem",
      "remote_sensing.sentinel2_alteration",
      "remote_sensing.lineaments",
      "geology.structures",
      "sampling.assays",
      "targets.exploration",
      "drilling.completed",
    ],
  },
  {
    id: "public_live",
    label: "Public / Live",
    capability: "public",
    enabled: [
      "territory.cadastre",
      "territory.pending_pedimentos",
      "territory.mojones",
      "territory.proposed_pedimentos",
      "territory.dem",
      "remote_sensing.anomaly_intensity",
      "remote_sensing.sentinel2_alteration",
      "geology.structures",
      "geology.interpreted_structures",
      "geology.metallogenic_belts",
      "geology.known_deposits",
      "geophysics.anomalies",
      "sampling.results",
      "sampling.assays",
      "targets.exploration",
      "drilling.proposed",
    ],
  },
  {
    id: "toki2_field",
    label: "Toki 2 · Field Plan",
    capability: "field",
    enabled: [
      "territory.cadastre",
      "territory.dem",
      "remote_sensing.sentinel2_alteration",
      "geology.structures",
      "sampling.assays",
      "targets.exploration",
    ],
  },
];

export function getGeoViewerPreset(id: GeoViewerPresetId): GeoViewerPreset {
  const preset = GEO_VIEWER_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Unknown GeoViewer preset: ${id}`);
  return preset;
}
