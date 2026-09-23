import * as turf from "@turf/turf";

export type ReconciliationState = "EXACT_MATCH" | "INTERSECTS" | "NEIGHBOR" | "UNMATCHED";
export type ReconciliationResult = {
  state: ReconciliationState;
  projectFeatureIndex: number | null;
  officialFeatureIndex: number | null;
  overlapHa: number;
  overlapPctProject: number;
  distanceKm: number | null;
  reasons: string[];
};

const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
const prop = (f: GeoJSON.Feature, keys: string[]) => {
  const p = (f.properties ?? {}) as Record<string, unknown>;
  for (const k of keys) if (p[k] != null && String(p[k]).trim()) return p[k];
  return "";
};

export function reconcileCadastre(
  project: GeoJSON.FeatureCollection,
  official: GeoJSON.FeatureCollection,
  neighborKm = 5,
): ReconciliationResult[] {
  const out: ReconciliationResult[] = [];
  project.features.forEach((pf, pi) => {
    if (!pf.geometry || !["Polygon","MultiPolygon"].includes(pf.geometry.type)) return;
    const pName = norm(prop(pf, ["name","NOMBRE","nombre","concesion"]));
    const pRole = norm(prop(pf, ["rol","ROL","NUMERO_ROL"]));
    const pArea = turf.area(pf as never) / 10_000;
    let matched = false;

    official.features.forEach((of, oi) => {
      if (!of.geometry || !["Polygon","MultiPolygon"].includes(of.geometry.type)) return;
      const oName = norm(prop(of, ["NOMBRE","name"]));
      const oRole = norm(prop(of, ["NUMERO_ROL","rol"]));
      const exactIdentity = Boolean((pRole && oRole && pRole === oRole) || (pName && oName && pName === oName));
      const intersects = turf.booleanIntersects(pf as never, of as never);
      let overlapHa = 0;
      if (intersects) {
        try {
          const intersection = turf.intersect(turf.featureCollection([pf as never, of as never]) as never);
          overlapHa = intersection ? turf.area(intersection) / 10_000 : 0;
        } catch { overlapHa = 0; }
      }
      const distanceKm = intersects ? 0 : turf.distance(turf.centroid(pf as never), turf.centroid(of as never));
      const state: ReconciliationState | null = exactIdentity ? "EXACT_MATCH" : intersects ? "INTERSECTS" : distanceKm <= neighborKm ? "NEIGHBOR" : null;
      if (!state) return;
      matched = matched || state === "EXACT_MATCH" || state === "INTERSECTS";
      out.push({
        state, projectFeatureIndex: pi, officialFeatureIndex: oi, overlapHa,
        overlapPctProject: pArea > 0 ? Math.min(100, overlapHa / pArea * 100) : 0,
        distanceKm, reasons: [
          exactIdentity ? "Coincidencia de rol o nombre normalizado" : "",
          intersects ? "Geometrías intersectan" : "",
          !intersects && distanceKm <= neighborKm ? `Dentro de buffer ${neighborKm} km` : "",
        ].filter(Boolean),
      });
    });
    if (!matched) out.push({ state:"UNMATCHED", projectFeatureIndex:pi, officialFeatureIndex:null, overlapHa:0, overlapPctProject:0, distanceKm:null, reasons:["Sin coincidencia oficial por identidad o intersección"] });
  });
  return out;
}
