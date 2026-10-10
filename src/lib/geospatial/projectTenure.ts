import type { FeatureCollection, Geometry } from "geojson";

export type ProjectTenure = {
  projectId: string;
  concessionCodes?: readonly string[];
  holderRuts?: readonly string[];
};

const identifier = (value: unknown) =>
  typeof value === "string" ? value.toUpperCase().replace(/[.\s-]/g, "") : "";

/** Association is documentary, never a legal certification or a geometry source. */
export function resolveProjectTenure<G extends Geometry | null>(
  collection: FeatureCollection<G>,
  tenure: ProjectTenure,
): FeatureCollection<G> {
  const codes = new Set((tenure.concessionCodes ?? []).map(identifier).filter(Boolean));
  const ruts = new Set((tenure.holderRuts ?? []).map(identifier).filter(Boolean));
  return {
    ...collection,
    features: collection.features.map((feature) => {
      const p = feature.properties ?? {};
      const reason =
        p.project_id === tenure.projectId
          ? "project_id"
          : [p.rol, p.code].some((code) => codes.has(identifier(code)))
            ? "concession_code"
            : [p.rut_holder, p.holder_rut, p.rut].some((rut) => ruts.has(identifier(rut)))
              ? "holder_rut"
              : p.es_tenencia_proyecto === true
                ? "source_declaration"
                : null;
      return {
        ...feature,
        properties: {
          ...p,
          es_tenencia_proyecto: reason ? true : p.es_tenencia_proyecto === false ? false : null,
          tenencia_procedencia: reason ? "declared" : "unresolved",
          tenencia_asociacion: reason,
        },
      };
    }),
  };
}
