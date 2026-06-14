// Tipo plano del DTO devuelto por getPre43101Data. Vive en archivo aparte
// para evitar que sectionsCatalog (cliente) importe la server function.
type Row = Record<string, unknown>;

export type Pre43101Data = {
  project: {
    name?: string | null;
    code?: string | null;
    commodity?: string | null;
    region?: string | null;
    country?: string | null;
    center_lat?: number | null;
    center_lng?: number | null;
  } | null;
  concessions: Row[];
  satAnomalies: Row[];
  veins: Row[];
  targets: Row[];
  magTargets: Row[];
  resourceModel: Row | null;
  drillHoles: Row[];
  geophysicsSurveys: Row[];
  qaqcResults: Row[];
  counts: {
    concessions: number;
    satAnomalies: number;
    veins: number;
    targets: number;
    magTargets: number;
    drillHoles: number;
    geophysicsSurveys: number;
    qaqcResults: number;
    hasResourceModel: boolean;
  };
  generatedAt: string;
};
