// Utilidades para exportar datasets geoespaciales a GeoJSON / CSV
// (sin dependencias externas; pensado para integrar al borrador NI 43-101).

export type GeoJsonGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] }
  | { type: "LineString"; coordinates: number[][] }
  | Record<string, unknown>;

export interface GeoFeature {
  type: "Feature";
  geometry: GeoJsonGeometry | null;
  properties: Record<string, unknown>;
}

export interface GeoFeatureCollection {
  type: "FeatureCollection";
  name?: string;
  crs?: { type: "name"; properties: { name: string } };
  features: GeoFeature[];
}

export function buildFeatureCollection(name: string, features: GeoFeature[]): GeoFeatureCollection {
  return {
    type: "FeatureCollection",
    name,
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
    features,
  };
}

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v).replace(/"/g, '""');
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const headers = Array.from(
    rows.reduce<Set<string>>((s, r) => {
      Object.keys(r).forEach((k) => s.add(k));
      return s;
    }, new Set()),
  );
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escapeCsv(r[h])).join(","));
  }
  return lines.join("\n");
}

export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob(["\ufeff" + content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Metadatos de exportación (sidecar) ---------------------------------------

export type DatasetKey =
  "satellite_anomalies" | "geophysics_anomalies" | "geological_features" | "prospectivity_cells";

export interface FieldMapping {
  source: string; // columna en la tabla / propiedad original
  target: string; // nombre en el archivo exportado
  type: "string" | "number" | "integer" | "boolean" | "date" | "json" | "geometry";
  description: string;
  unit?: string;
}

export interface DatasetMetadata {
  dataset: DatasetKey;
  label: string;
  geometry_type: "Point" | "Polygon" | "LineString" | "MultiPolygon" | "Mixed";
  fields: FieldMapping[];
}

export const DATASET_METADATA: Record<DatasetKey, DatasetMetadata> = {
  satellite_anomalies: {
    dataset: "satellite_anomalies",
    label: "Anomalías satelitales",
    geometry_type: "Polygon",
    fields: [
      { source: "id", target: "id", type: "string", description: "Identificador único UUID" },
      {
        source: "project_id",
        target: "project_id",
        type: "string",
        description: "Proyecto al que pertenece",
      },
      {
        source: "run_id",
        target: "run_id",
        type: "string",
        description: "Corrida satelital de origen",
      },
      {
        source: "index_code",
        target: "index_code",
        type: "string",
        description: "Índice (NDVI, EMIT, ASTER, etc.)",
      },
      {
        source: "severity",
        target: "severity",
        type: "string",
        description: "Nivel cualitativo (low/medium/high/critical)",
      },
      { source: "score", target: "score", type: "number", description: "Score normalizado 0-100" },
      {
        source: "area_ha",
        target: "area_ha",
        type: "number",
        description: "Área de la anomalía",
        unit: "ha",
      },
      {
        source: "bbox",
        target: "bbox",
        type: "json",
        description: "Bounding box [minLng,minLat,maxLng,maxLat]",
      },
      { source: "notes", target: "notes", type: "string", description: "Notas del analista" },
      {
        source: "detected_at",
        target: "detected_at",
        type: "date",
        description: "Fecha de detección (ISO 8601)",
      },
      {
        source: "geometry",
        target: "geometry",
        type: "geometry",
        description: "Polígono WGS84 lon/lat",
      },
    ],
  },
  geophysics_anomalies: {
    dataset: "geophysics_anomalies",
    label: "Anomalías geofísicas",
    geometry_type: "Point",
    fields: [
      { source: "id", target: "id", type: "string", description: "Identificador único UUID" },
      {
        source: "code",
        target: "code",
        type: "string",
        description: "Código corto de la anomalía",
      },
      {
        source: "anomaly_type",
        target: "anomaly_type",
        type: "string",
        description: "Tipo (magnetic, IP, radiometric, etc.)",
      },
      { source: "severity", target: "severity", type: "string", description: "Nivel cualitativo" },
      {
        source: "status",
        target: "status",
        type: "string",
        description: "Estado (open, in_review, promoted, dismissed)",
      },
      {
        source: "confidence_pct",
        target: "confidence_pct",
        type: "number",
        description: "Confianza",
        unit: "%",
      },
      { source: "lat", target: "lat", type: "number", description: "Latitud WGS84", unit: "°" },
      { source: "lng", target: "lng", type: "number", description: "Longitud WGS84", unit: "°" },
      { source: "peak_value", target: "peak_value", type: "number", description: "Valor pico" },
      {
        source: "peak_unit",
        target: "peak_unit",
        type: "string",
        description: "Unidad del valor pico",
      },
      {
        source: "estimated_depth_m",
        target: "estimated_depth_m",
        type: "number",
        description: "Profundidad estimada",
        unit: "m",
      },
      {
        source: "estimated_area_m2",
        target: "estimated_area_m2",
        type: "number",
        description: "Área estimada",
        unit: "m²",
      },
      {
        source: "rationale",
        target: "rationale",
        type: "string",
        description: "Justificación interpretativa",
      },
    ],
  },
  geological_features: {
    dataset: "geological_features",
    label: "Estructuras geológicas",
    geometry_type: "Mixed",
    fields: [
      { source: "id", target: "id", type: "string", description: "Identificador único UUID" },
      {
        source: "feature_code",
        target: "feature_code",
        type: "string",
        description: "Código de campo",
      },
      { source: "name", target: "name", type: "string", description: "Nombre de la estructura" },
      {
        source: "feature_type",
        target: "feature_type",
        type: "string",
        description: "Tipo (fault, vein, contact, fold, dike)",
      },
      { source: "strike", target: "strike", type: "number", description: "Rumbo", unit: "°" },
      { source: "dip", target: "dip", type: "number", description: "Manteo", unit: "°" },
      {
        source: "length_m",
        target: "length_m",
        type: "number",
        description: "Longitud",
        unit: "m",
      },
      { source: "width_m", target: "width_m", type: "number", description: "Ancho", unit: "m" },
      {
        source: "description",
        target: "description",
        type: "string",
        description: "Descripción geológica",
      },
      {
        source: "source",
        target: "source",
        type: "string",
        description: "Origen del dato (mapeo, sat, geofísica)",
      },
      {
        source: "geometry_geojson",
        target: "geometry",
        type: "geometry",
        description: "Geometría GeoJSON WGS84",
      },
    ],
  },
  prospectivity_cells: {
    dataset: "prospectivity_cells",
    label: "Celdas de prospectividad",
    geometry_type: "Polygon",
    fields: [
      { source: "id", target: "id", type: "string", description: "Identificador único UUID" },
      {
        source: "run_id",
        target: "run_id",
        type: "string",
        description: "Corrida de prospectividad",
      },
      {
        source: "cell_lat",
        target: "cell_lat",
        type: "number",
        description: "Latitud del centroide WGS84",
        unit: "°",
      },
      {
        source: "cell_lng",
        target: "cell_lng",
        type: "number",
        description: "Longitud del centroide WGS84",
        unit: "°",
      },
      {
        source: "cell_size_m",
        target: "cell_size_m",
        type: "number",
        description: "Tamaño de celda (lado)",
        unit: "m",
      },
      {
        source: "score",
        target: "score",
        type: "integer",
        description: "Score de prospectividad 0-100",
      },
      {
        source: "features",
        target: "features",
        type: "json",
        description: "Evidencia agregada (vecinos, densidad, etc.)",
      },
      {
        source: "generated_at",
        target: "generated_at",
        type: "date",
        description: "Fecha de generación (ISO 8601)",
      },
      {
        source: "geometry",
        target: "geometry",
        type: "geometry",
        description: "Polígono cuadrado derivado del centroide y cell_size_m",
      },
    ],
  },
};

export interface ExportMetadata {
  dataset: DatasetKey;
  label: string;
  format: "geojson" | "csv";
  filename: string;
  exported_at: string;
  exported_by_app: string;
  project: { id: string; name?: string };
  record_count: number;
  crs: {
    name: "WGS 84 (CRS84)";
    epsg: 4326;
    urn: "urn:ogc:def:crs:OGC:1.3:CRS84";
    axis_order: "longitude, latitude";
  };
  geometry_type: DatasetMetadata["geometry_type"];
  source_table: string;
  parameters: {
    filter: Record<string, unknown>;
    notes?: string;
  };
  fields: FieldMapping[];
  references: {
    standard: "NI 43-101";
    geojson_spec: "RFC 7946";
  };
}

export function buildExportMetadata(args: {
  dataset: DatasetKey;
  format: "geojson" | "csv";
  filename: string;
  project: { id: string; name?: string };
  recordCount: number;
  notes?: string;
}): ExportMetadata {
  const meta = DATASET_METADATA[args.dataset];
  return {
    dataset: args.dataset,
    label: meta.label,
    format: args.format,
    filename: args.filename,
    exported_at: new Date().toISOString(),
    exported_by_app: "Geocapitals — NI 43-101 Draft",
    project: args.project,
    record_count: args.recordCount,
    crs: {
      name: "WGS 84 (CRS84)",
      epsg: 4326,
      urn: "urn:ogc:def:crs:OGC:1.3:CRS84",
      axis_order: "longitude, latitude",
    },
    geometry_type: meta.geometry_type,
    source_table: `public.${args.dataset}`,
    parameters: {
      filter: { project_id: args.project.id },
      notes: args.notes,
    },
    fields: meta.fields,
    references: {
      standard: "NI 43-101",
      geojson_spec: "RFC 7946",
    },
  };
}

export function metadataToCsv(meta: ExportMetadata): string {
  const header = [
    ["dataset", meta.dataset],
    ["label", meta.label],
    ["format", meta.format],
    ["filename", meta.filename],
    ["exported_at", meta.exported_at],
    ["project_id", meta.project.id],
    ["project_name", meta.project.name ?? ""],
    ["record_count", String(meta.record_count)],
    ["crs", meta.crs.urn],
    ["epsg", String(meta.crs.epsg)],
    ["axis_order", meta.crs.axis_order],
    ["geometry_type", meta.geometry_type],
    ["source_table", meta.source_table],
    ["geojson_spec", meta.references.geojson_spec],
    ["standard", meta.references.standard],
    ["notes", meta.parameters.notes ?? ""],
  ];
  const headerCsv = [
    "key,value",
    ...header.map(([k, v]) => `${escapeCsv(k)},${escapeCsv(v)}`),
  ].join("\n");
  const fieldRows = [
    "source,target,type,unit,description",
    ...meta.fields.map((f) =>
      [f.source, f.target, f.type, f.unit ?? "", f.description].map(escapeCsv).join(","),
    ),
  ].join("\n");
  return `${headerCsv}\n\nfields\n${fieldRows}\n`;
}

// Convertidores específicos -------------------------------------------------

export function satelliteAnomaliesToFeatures(rows: Array<Record<string, unknown>>): GeoFeature[] {
  return rows
    .map((r) => ({
      type: "Feature" as const,
      geometry: (r.geometry as GeoJsonGeometry) ?? null,
      properties: {
        id: r.id,
        project_id: r.project_id,
        run_id: r.run_id,
        index_code: r.index_code,
        severity: r.severity,
        score: r.score,
        area_ha: r.area_ha,
        notes: r.notes,
        bbox: r.bbox,
        detected_at: r.detected_at,
      },
    }))
    .filter((f) => f.geometry !== null);
}

export function geophysicsAnomaliesToFeatures(rows: Array<Record<string, unknown>>): GeoFeature[] {
  return rows
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({
      type: "Feature" as const,
      geometry: { type: "Point", coordinates: [Number(r.lng), Number(r.lat)] },
      properties: {
        id: r.id,
        code: r.code,
        anomaly_type: r.anomaly_type,
        severity: r.severity,
        status: r.status,
        confidence_pct: r.confidence_pct,
        peak_value: r.peak_value,
        peak_unit: r.peak_unit,
        estimated_depth_m: r.estimated_depth_m,
        estimated_area_m2: r.estimated_area_m2,
        rationale: r.rationale,
      },
    }));
}

export function geologicalFeaturesToFeatures(rows: Array<Record<string, unknown>>): GeoFeature[] {
  return rows.map((r) => ({
    type: "Feature" as const,
    geometry: (r.geometry_geojson as GeoJsonGeometry) ?? null,
    properties: {
      id: r.id,
      feature_code: r.feature_code,
      name: r.name,
      feature_type: r.feature_type,
      strike: r.strike,
      dip: r.dip,
      length_m: r.length_m,
      width_m: r.width_m,
      description: r.description,
      source: r.source,
    },
  }));
}

// Constante consistente con supabase/functions/prospectivity-grid (WGS84).
const METERS_PER_DEG_LAT = 111_320;

function round7(n: number): number {
  // ~1.1 cm de precisión, suficiente para QGIS/ArcGIS sin ruido flotante.
  return Math.round(n * 1e7) / 1e7;
}

export function prospectivityCellsToFeatures(rows: Array<Record<string, unknown>>): GeoFeature[] {
  return rows
    .filter((r) => Number.isFinite(Number(r.cell_lat)) && Number.isFinite(Number(r.cell_lng)))
    .map((r) => {
      const lat = Number(r.cell_lat);
      const lng = Number(r.cell_lng);
      const rawSize = Number(r.cell_size_m);
      const sizeM = Number.isFinite(rawSize) && rawSize > 0 ? rawSize : 100;

      const cosLat = Math.cos((lat * Math.PI) / 180);
      const dLat = sizeM / 2 / METERS_PER_DEG_LAT;
      const dLng = sizeM / 2 / (METERS_PER_DEG_LAT * Math.max(cosLat, 1e-6));

      // Esquinas redondeadas para que el cierre del anillo sea idéntico al primer vértice.
      const w = round7(lng - dLng);
      const e = round7(lng + dLng);
      const s = round7(lat - dLat);
      const n = round7(lat + dLat);

      return {
        type: "Feature" as const,
        geometry: {
          type: "Polygon",
          // Anillo exterior en sentido horario inverso (CCW) según RFC 7946,
          // primer y último vértice idénticos para cierre válido.
          coordinates: [
            [
              [w, s],
              [e, s],
              [e, n],
              [w, n],
              [w, s],
            ],
          ],
        },
        properties: {
          id: r.id,
          run_id: r.run_id,
          score: r.score,
          cell_lat: lat,
          cell_lng: lng,
          cell_size_m: sizeM,
          features: r.features,
          generated_at: r.generated_at,
        },
      };
    });
}
