// Tipo plano del DTO devuelto por getPre43101Data. Vive en archivo aparte
// para evitar que sectionsCatalog (cliente) importe la server function.
export type Pre43101Data = {
  project: any | null;
  concessions: any[];
  satAnomalies: any[];
  veins: any[];
  targets: any[];
  magTargets: any[];
  resourceModel: any | null;
  drillHoles: any[];
  geophysicsSurveys: any[];
  qaqcResults: any[];
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
