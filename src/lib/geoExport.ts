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

// Convertidores específicos -------------------------------------------------

export function satelliteAnomaliesToFeatures(rows: Array<Record<string, any>>): GeoFeature[] {
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

export function geophysicsAnomaliesToFeatures(rows: Array<Record<string, any>>): GeoFeature[] {
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

export function geologicalFeaturesToFeatures(rows: Array<Record<string, any>>): GeoFeature[] {
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

export function prospectivityCellsToFeatures(rows: Array<Record<string, any>>): GeoFeature[] {
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
          coordinates: [[
            [w, s],
            [e, s],
            [e, n],
            [w, n],
            [w, s],
          ]],
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
