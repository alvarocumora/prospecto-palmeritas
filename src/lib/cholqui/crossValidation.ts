/**
 * Validación cruzada espacial: ensayes certificados de superficie vs detecciones
 * espectrales NASA EMIT L2B (MODELADO). Cálculo reproducible (DERIVADO): distancia
 * haversine desde cada punto de muestreo con coordenadas publicadas a la detección
 * EMIT más cercana por familia, y conteo de detecciones dentro de un radio.
 * No convierte ninguna clase de evidencia en otra ni infiere leyes.
 */
export type EmitFeature = {
  geometry: { coordinates: [number, number] };
  properties: { familia: string; profundidad_banda: number; coincide_2_escenas?: boolean };
};

export type AssayPoint = {
  sample: string;
  location: string;
  lat: number;
  lng: number;
  cuTotalPct: number;
  auGpt: number;
  reportId: string;
};

export type FamilyProximity = {
  familia: string;
  nearestM: number | null;
  countWithin: number;
  maxDepthWithin: number | null;
};

export type CrossValidationRow = {
  assay: AssayPoint;
  families: FamilyProximity[];
  /** Familias con al menos una detección dentro del radio. */
  convergent: string[];
};

const R = 6371008.8;
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function crossValidate(
  assays: AssayPoint[],
  emit: EmitFeature[],
  families: string[],
  radiusM = 150,
): CrossValidationRow[] {
  return assays.map((assay) => {
    const fam = families.map<FamilyProximity>((familia) => {
      let nearest = Infinity;
      let count = 0;
      let maxDepth: number | null = null;
      for (const f of emit) {
        if (f.properties.familia !== familia) continue;
        const [lng, lat] = f.geometry.coordinates;
        const d = haversineM(assay.lat, assay.lng, lat, lng);
        if (d < nearest) nearest = d;
        if (d <= radiusM) {
          count++;
          maxDepth = Math.max(maxDepth ?? 0, f.properties.profundidad_banda);
        }
      }
      return {
        familia,
        nearestM: Number.isFinite(nearest) ? Math.round(nearest) : null,
        countWithin: count,
        maxDepthWithin: maxDepth,
      };
    });
    return { assay, families: fam, convergent: fam.filter((f) => f.countWithin > 0).map((f) => f.familia) };
  });
}
