export const COMMODITY_OPTIONS = ["Au", "Ag", "Cu", "Au-Ag", "Au-Cu", "Cu-Au", "Li", "Fe", "Mo"];
export const STAGE_OPTIONS = ["greenfield", "scoping", "brownfield", "prefeasibility", "feasibility", "production"];
export const MODALITY_OPTIONS = ["sale", "jv", "royalty", "option", "lease"];

export const STAGE_LABEL: Record<string, string> = {
  greenfield: "Greenfield",
  scoping: "Scoping",
  brownfield: "Brownfield",
  prefeasibility: "Pre-feasibility",
  feasibility: "Feasibility",
  production: "Producción",
};

export const MODALITY_LABEL: Record<string, string> = {
  sale: "Venta",
  jv: "JV",
  royalty: "Royalty",
  option: "Opción",
  lease: "Arriendo",
};
