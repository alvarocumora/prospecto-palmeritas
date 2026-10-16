import {
  CHOLQUI_ASSAYS,
  CHOLQUI_ASSAY_REPORTS,
  CHOLQUI_POINTS,
} from "@/features/franco/data/cholqui";
import {
  CHOLQUI_COORDINATE_NOTICE,
  CHOLQUI_INTERPOLATION_NOTICE,
} from "@/features/franco/cholquiGeoPolicy";
import candidatesRaw from "@/data/geo/cholqui_satellite_candidates.geojson?raw";
import drillRaw from "@/data/geo/cholqui_drill_grid.geojson?raw";
import { parsePublishedDrillGrid, totalMeters } from "@/lib/cholqui/drillGrid";
import emitRaw from "@/data/geo/cholqui_emit_mineralogia.json?raw";
import { crossValidate, type AssayPoint, type EmitFeature } from "@/lib/cholqui/crossValidation";
import type { DocSection } from "../model";

const CV_RADIUS_M = 150;

function crossValidationSection(): DocSection {
  const emit = JSON.parse(emitRaw) as {
    metadata: { familias: Record<string, string>; escenas: Array<{ id: string }> };
    features: EmitFeature[];
  };
  const families = Object.keys(emit.metadata.familias);
  const points: AssayPoint[] = [];
  const unlocated: string[] = [];
  for (const a of CHOLQUI_ASSAYS) {
    const p = CHOLQUI_POINTS.find((pt) => pt.code.replace("-", "") === a.sample.replace("-", ""));
    if (p) points.push({ ...a, lat: p.lat, lng: p.lng });
    else unlocated.push(a.sample);
  }
  const rows = crossValidate(points, emit.features, families, CV_RADIUS_M);
  const withSignal = rows.filter((r) => r.convergent.length > 0).length;
  const fmt = (f: { nearestM: number | null; countWithin: number }) =>
    f.nearestM == null
      ? "—"
      : f.nearestM + " m" + (f.countWithin ? " (" + f.countWithin + ")" : "");
  const noAdvanced = rows.filter(
    (r) => !r.convergent.includes("alunita") && !r.convergent.includes("arcillas"),
  );
  return {
    eyebrow: "Validación cruzada",
    title: "Ensayes certificados frente a mineralogía espectral EMIT",
    lead: "Mide la proximidad entre cada muestra de laboratorio y las detecciones satelitales; no transforma una estimación espectral en ley.",
    blocks: [
      {
        kind: "narrative",
        body:
          "Para cada ensaye con coordenadas publicadas se calculó la distancia geodésica a la detección NASA EMIT L2B más cercana de cada familia mineral y el número de detecciones dentro de " +
          CV_RADIUS_M +
          " m (≈2,5 píxeles EMIT de 60 m). " +
          withSignal +
          " de " +
          rows.length +
          " muestras ubicadas tienen al menos una familia espectral dentro del radio. La coincidencia espacial apoya priorizar terreno; no demuestra continuidad, génesis ni ley.",
        provenance: "DERIVED",
        source: "crossValidation.ts · " + emit.metadata.escenas.map((e) => e.id).join(", "),
      },
      {
        kind: "appendixTable",
        title: "Distancia a la detección EMIT más cercana (n.º dentro de " + CV_RADIUS_M + " m)",
        head: [
          "Muestra",
          "Cu %",
          "Au g/t",
          ...families.map((f) => f[0].toUpperCase() + f.slice(1)),
        ],
        widths: [0.13, 0.1, 0.1, ...families.map(() => 0.67 / families.length)],
        provenance: "DERIVED",
        source: "Ensayes CERTIFICADOS × EMIT MODELADO; distancia haversine",
        rows: rows.map((r) => [
          r.assay.sample,
          r.assay.cuTotalPct.toLocaleString("es-CL"),
          r.assay.auGpt.toLocaleString("es-CL"),
          ...r.families.map(fmt),
        ]),
      },
      ...(noAdvanced.length
        ? [
            {
              kind: "gap" as const,
              title: "Muestras sin alteración argílica espectral cercana",
              body:
                noAdvanced.map((r) => r.assay.sample).join(", ") +
                " no tienen alunita ni arcillas EMIT dentro de " +
                CV_RADIUS_M +
                " m. Puede deberse a cobertura vegetal, sombra topográfica, tamaño de la estructura (vetas de 1 m frente a píxeles de 60 m) o a un estilo de mineralización sin halo argílico.",
              action:
                "Mapeo de alteración en terreno y espectrometría portátil (SWIR) en los afloramientos muestreados antes de usar la señal satelital como criterio de exclusión.",
            },
          ]
        : []),
      ...(unlocated.length
        ? [
            {
              kind: "gap" as const,
              title: "Ensayes sin coordenadas publicadas",
              body:
                unlocated.join(", ") +
                " no tienen punto georreferenciado y quedan fuera del cruce.",
              action: "Registrar coordenadas GPS con datum declarado para cada muestra.",
            },
          ]
        : []),
      {
        kind: "recommendation",
        title: "Programa de validación de terreno",
        body: "Visitar primero las detecciones de alunita y arcillas que coinciden en ambas escenas y no tienen ensaye a menos de 500 m; tomar muestras de roca con descripción de alteración y QA/QC (duplicados, blancos y estándares).",
        priority: "high",
      },
    ],
  };
}

export function cholquiGeoscienceSections(): DocSection[] {
  const candidates = JSON.parse(candidatesRaw) as {
    metadata?: { config_sha256?: string; nota_metodologica?: string };
    features: unknown[];
  };
  const collars = parsePublishedDrillGrid(JSON.parse(drillRaw));
  return [
    crossValidationSection(),
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
