import { CHOLQUI_ASSAYS, CHOLQUI_ASSAY_REPORTS } from "@/features/franco/data/cholqui";
import {
  CHOLQUI_COORDINATE_NOTICE,
  CHOLQUI_INTERPOLATION_NOTICE,
} from "@/features/franco/cholquiGeoPolicy";
import candidatesRaw from "@/data/geo/cholqui_satellite_candidates.geojson?raw";
import drillRaw from "@/data/geo/cholqui_drill_grid.geojson?raw";
import { parsePublishedDrillGrid, totalMeters } from "@/lib/cholqui/drillGrid";
import type { DocSection } from "../model";

export function cholquiGeoscienceSections(): DocSection[] {
  const candidates = JSON.parse(candidatesRaw) as {
    metadata?: { config_sha256?: string; nota_metodologica?: string };
    features: unknown[];
  };
  const collars = parsePublishedDrillGrid(JSON.parse(drillRaw));
  return [
    {
      eyebrow: "Integración geocientífica",
      title: "Terreno, geofísica y límites de estimación",
      lead: "El relieve organiza la evidencia superficial; las propiedades del subsuelo requieren datos y modelos independientes.",
      blocks: [
        {
          kind: "narrative",
          body: "Copernicus GLO-30 aporta un modelo digital de superficie. La escena pública usa 20 × 20 km, una grilla visual de 257 × 257 nodos (78,1 m) y exageración vertical 1×. La resolución nominal del producto (~30 m) no es el paso de esta grilla ni precisión topográfica de replanteo. Ninguna cota o pendiente se incorpora como resultado sin un snapshot de terreno real y versionado.",
          provenance: "DOCUMENTARY",
          source:
            "https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM",
        },
        {
          kind: "finding",
          title: "Medición, interpolación e inversión",
          body: "Las estaciones MAG/IP del proyecto se consultan por campaña. Una superficie IDW es una interpolación visual, no inversión. El residual magnético mostrado es TMI menos la mediana de la campaña: no acredita corrección diurna, IGRF ni reducción al polo. IP requiere geometría de electrodos y parámetros de adquisición antes de una inversión con topografía.",
          provenance: "INTERPRETED",
          source: "GeoCapitals · geophysicsSurface / SimPEG magnetics worker",
        },
        {
          kind: "gap",
          title: "Estimación mineral todavía pendiente",
          body: "Los ensayes puntuales, las huellas espectrales y el DEM no delimitan un volumen mineralizado. IDW/NN requieren sondajes ejecutados, compositado, dominios geológicos, densidad y QA/QC. Kriging requiere además variograma y validación espacial; la distancia por sí sola no justifica una categoría de recursos.",
          action:
            "Validar collars/CRS, trayectorias y ensayes; definir dominios, densidad, corte topográfico y revisión competente antes de publicar tonelaje, ley media o clasificación.",
        },
        {
          kind: "narrative",
          body: CHOLQUI_COORDINATE_NOTICE,
          provenance: "PENDING_DD",
          source: "Prospecto histórico de Cholqui y coordenadas WGS84 publicadas",
        },
      ],
    },
    {
      eyebrow: "Reproducibilidad",
      title: "Inventario de evidencia y propuesta publicada",
      blocks: [
        {
          kind: "narrative",
          body: CHOLQUI_INTERPOLATION_NOTICE,
          provenance: "DERIVED",
          source: "cholqui_satellite_candidates.geojson · metadata.nota_metodologica",
        },
        {
          kind: "appendixTable",
          title: "Fuentes y alcance de los datos de Cholqui",
          head: ["Dataset", "Versión / cantidad", "Alcance"],
          widths: [0.29, 0.3, 0.41],
          provenance: "DOCUMENTARY",
          source: "Archivos publicados y registro analítico canónico de Cholqui",
          rows: [
            [
              "Ensayes de superficie",
              CHOLQUI_ASSAYS.length + " muestras / " + CHOLQUI_ASSAY_REPORTS.length + " informes",
              CHOLQUI_ASSAY_REPORTS.map((report) => report.id).join(", ") + "; no ley media",
            ],
            [
              "Sentinel-2 L2A",
              candidates.features.length + " huellas originales",
              "Campañas e índices distintos; z-scores sin interpolación conjunta",
            ],
            [
              "Configuración satelital SHA-256",
              candidates.metadata?.config_sha256 ?? "No informado",
              "Identifica configuración; no acredita por sí sola reproducibilidad completa",
            ],
            [
              "Propuesta de sondajes",
              collars.length + " collares / " + totalMeters(collars).toLocaleString("es-CL") + " m",
              "cholqui_drill_grid.geojson; no ejecutada ni regenerada por ranking",
            ],
            [
              "DEM Copernicus",
              "GLO-30 / grilla visual 78,1 m",
              "Terreno real requerido; datum vertical y exactitud local pendientes de control",
            ],
            [
              "Geofísica de terreno",
              "Snapshot de campaña no adjunto a este documento",
              "Datos MAG/IP, parámetros de proceso y corrida necesarios para resultados numéricos",
            ],
          ],
        },
        {
          kind: "appendixTable",
          title: "Collares de la propuesta publicada",
          head: ["Sondaje", "Latitud", "Longitud", "Azimut", "Dip", "Prof. m"],
          widths: [0.2, 0.2, 0.2, 0.14, 0.12, 0.14],
          provenance: "PROPOSED",
          source: "cholqui_drill_grid.geojson",
          rows: collars.map((collar) => [
            collar.code,
            collar.lat.toFixed(6),
            collar.lng.toFixed(6),
            collar.azimuthDeg + "°",
            collar.dipDeg + "°",
            String(collar.depthM),
          ]),
        },
      ],
    },
  ];
}
