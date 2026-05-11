export type GeoCopilotEvidenceCategory =
  | "target"
  | "intercept"
  | "lithology"
  | "alteration"
  | "concession"
  | "permit"
  | "assay"
  | "raster";

export type GeoCopilotEvidenceRef = {
  id: string;
  category: GeoCopilotEvidenceCategory;
  label: string;
  source?: string;
  confidence?: "low" | "medium" | "high";
  url?: string;
  metadata?: Record<string, unknown>;
};

export type GeoCopilotEvidenceGroup = {
  category: GeoCopilotEvidenceCategory;
  items: GeoCopilotEvidenceRef[];
};

export type GeoCopilotEvidenceSummary = {
  total: number;
  categories: GeoCopilotEvidenceCategory[];
  labels: string[];
};
