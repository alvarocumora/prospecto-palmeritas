import type {
  GeoCopilotEvidenceCategory,
  GeoCopilotEvidenceGroup,
  GeoCopilotEvidenceRef,
  GeoCopilotEvidenceSummary,
} from "@/types/geoCopilot";

export const GEO_COPILOT_EVIDENCE_CATEGORY_LABELS: Record<GeoCopilotEvidenceCategory, string> = {
  target: "Target",
  intercept: "Intercept",
  lithology: "Lithology",
  alteration: "Alteration",
  concession: "Concession",
  permit: "Permit",
  assay: "Assay",
  raster: "Raster",
};

export function groupEvidenceByCategory(evidence: GeoCopilotEvidenceRef[]): GeoCopilotEvidenceGroup[] {
  const groups = new Map<GeoCopilotEvidenceCategory, GeoCopilotEvidenceRef[]>();

  for (const item of evidence) {
    const current = groups.get(item.category) ?? [];
    current.push(item);
    groups.set(item.category, current);
  }

  return [...groups.entries()].map(([category, items]) => ({ category, items }));
}

export function createEvidenceLabel(evidence: GeoCopilotEvidenceRef): string {
  const category = GEO_COPILOT_EVIDENCE_CATEGORY_LABELS[evidence.category];
  const confidence = evidence.confidence ? ` · ${evidence.confidence}` : "";
  const source = evidence.source ? ` · ${evidence.source}` : "";
  return `${category}: ${evidence.label}${confidence}${source}`;
}

export function summarizeEvidence(evidence: GeoCopilotEvidenceRef[]): GeoCopilotEvidenceSummary {
  const categories = [...new Set(evidence.map((item) => item.category))];
  return {
    total: evidence.length,
    categories,
    labels: evidence.map(createEvidenceLabel),
  };
}

export function filterEvidenceByConfidence(
  evidence: GeoCopilotEvidenceRef[],
  confidence: "low" | "medium" | "high"
): GeoCopilotEvidenceRef[] {
  return evidence.filter((item) => item.confidence === confidence);
}
