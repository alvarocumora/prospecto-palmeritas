/**
 * GeoCapitals Report Architecture v4
 *
 * The report type owns the narrative. Project data fills that narrative;
 * optional data must never silently reorder the document.
 */

export type ReportProfile = "investment" | "technical" | "targeting";

export type EvidenceClass =
  | "OFFICIAL"
  | "CERTIFIED"
  | "DOCUMENTARY"
  | "DECLARED"
  | "OBSERVED"
  | "DERIVED"
  | "INTERPRETED"
  | "PROPOSED"
  | "SCENARIO"
  | "PENDING_DD";

export type ReportSectionId =
  | "executive_snapshot"
  | "scope"
  | "objective"
  | "evidence_confidence"
  | "asset_ownership"
  | "investment_thesis"
  | "evidence_summary"
  | "data_inventory"
  | "property_crs"
  | "geology"
  | "field_observations"
  | "sampling_qaqc"
  | "laboratory"
  | "geochemistry"
  | "geophysics"
  | "remote_sensing"
  | "integrated_interpretation"
  | "input_datasets"
  | "data_quality"
  | "methodology"
  | "spectral_products"
  | "structural_interpretation"
  | "anomalies"
  | "target_ranking"
  | "ground_truth"
  | "validated_targets"
  | "targets"
  | "development_strategy"
  | "economics"
  | "capital_raise"
  | "critical_risks"
  | "exploration_gaps"
  | "work_program"
  | "proposed_drilling"
  | "milestones"
  | "dd_checklist"
  | "technical_limitations"
  | "limitations"
  | "reproducibility"
  | "appendices";

export type ReportSectionSpec = {
  id: ReportSectionId;
  title: string;
  required: boolean;
};

export type ReportArchitecture = {
  profile: ReportProfile;
  title: string;
  purpose: string;
  audience: string;
  sections: readonly ReportSectionSpec[];
  allowedEvidence: readonly EvidenceClass[];
};

const section = (id: ReportSectionId, title: string, required = false): ReportSectionSpec => ({
  id,
  title,
  required,
});

export const REPORT_ARCHITECTURES: Record<ReportProfile, ReportArchitecture> = {
  investment: {
    profile: "investment",
    title: "Investment Memorandum",
    purpose: "Explain the investment thesis, evidence base, risks, capital need and de-risking path.",
    audience: "Investors, family offices, funds and investment committees",
    allowedEvidence: [
      "OFFICIAL",
      "CERTIFIED",
      "DOCUMENTARY",
      "DECLARED",
      "OBSERVED",
      "DERIVED",
      "INTERPRETED",
      "PROPOSED",
      "SCENARIO",
      "PENDING_DD",
    ],
    sections: [
      section("executive_snapshot", "Executive Investment Snapshot", true),
      section("evidence_confidence", "Evidence & Confidence Dashboard", true),
      section("asset_ownership", "Asset & Ownership", true),
      section("investment_thesis", "Why This Asset", true),
      section("evidence_summary", "Evidence Base", true),
      section("development_strategy", "Development Strategy"),
      section("economics", "Economics & Sensitivities"),
      section("capital_raise", "Capital Raise & Use of Funds"),
      section("critical_risks", "Key Risks & De-risking", true),
      section("milestones", "Value-Creation Milestones"),
      section("dd_checklist", "Due-Diligence Checklist", true),
      section("appendices", "Technical Appendices"),
    ],
  },
  technical: {
    profile: "technical",
    title: "Technical Report",
    purpose: "State what is technically known, its provenance, quality, interpretation and remaining gaps.",
    audience: "Geologists, technical reviewers, due-diligence teams and competent persons",
    allowedEvidence: [
      "OFFICIAL",
      "CERTIFIED",
      "DOCUMENTARY",
      "DECLARED",
      "OBSERVED",
      "DERIVED",
      "INTERPRETED",
      "PENDING_DD",
    ],
    sections: [
      section("scope", "Scope & Purpose", true),
      section("evidence_confidence", "Evidence & Confidence Dashboard", true),
      section("data_inventory", "Data Inventory & Provenance", true),
      section("property_crs", "Property & Coordinate Systems"),
      section("geology", "Geological Setting", true),
      section("field_observations", "Field Observations"),
      section("sampling_qaqc", "Sampling & QA/QC"),
      section("laboratory", "Laboratory Results"),
      section("geochemistry", "Geochemistry"),
      section("geophysics", "Geophysics"),
      section("remote_sensing", "Remote Sensing"),
      section("integrated_interpretation", "Integrated Geological Interpretation"),
      section("targets", "Exploration Targets"),
      section("exploration_gaps", "Exploration Gaps", true),
      section("work_program", "Recommended Work Program"),
      section("technical_limitations", "Technical Limitations", true),
      section("appendices", "Technical Appendices"),
    ],
  },
  targeting: {
    profile: "targeting",
    title: "Exploration Targeting Report",
    purpose: "Show the reproducible path from input datasets to anomalies, ranked targets and field validation.",
    audience: "Exploration teams, geoscientists and technical reviewers",
    allowedEvidence: [
      "OFFICIAL",
      "CERTIFIED",
      "DOCUMENTARY",
      "OBSERVED",
      "DERIVED",
      "INTERPRETED",
      "PROPOSED",
      "PENDING_DD",
    ],
    sections: [
      section("objective", "Objective", true),
      section("evidence_confidence", "Evidence & Confidence Dashboard", true),
      section("input_datasets", "Input Datasets & Provenance", true),
      section("data_quality", "Data Quality & Coverage", true),
      section("methodology", "Processing Methodology", true),
      section("spectral_products", "Spectral Products"),
      section("structural_interpretation", "Structural Interpretation"),
      section("anomalies", "Detected Anomalies", true),
      section("target_ranking", "Multi-Layer Target Ranking", true),
      section("ground_truth", "Ground-Truth Program", true),
      section("validated_targets", "Validated Targets"),
      section("proposed_drilling", "Conceptual Drilling", false),
      section("limitations", "Limitations", true),
      section("reproducibility", "Reproducibility & Run Metadata", true),
      section("appendices", "Technical Appendices"),
    ],
  },
};

export function architectureFor(profile: ReportProfile): ReportArchitecture {
  return REPORT_ARCHITECTURES[profile];
}

export function evidenceAllowed(profile: ReportProfile, evidence: EvidenceClass): boolean {
  return REPORT_ARCHITECTURES[profile].allowedEvidence.includes(evidence);
}

export function sectionNumber(profile: ReportProfile, id: ReportSectionId): string | null {
  const index = REPORT_ARCHITECTURES[profile].sections.findIndex((item) => item.id === id);
  return index < 0 ? null : String(index + 1).padStart(2, "0");
}

export function validateReportArchitecture(architecture: ReportArchitecture): string[] {
  const errors: string[] = [];
  const ids = architecture.sections.map((item) => item.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) errors.push(`DUPLICATE_SECTIONS:${[...new Set(duplicates)].join(",")}`);
  if (!ids.includes("evidence_confidence")) errors.push("EVIDENCE_DASHBOARD_REQUIRED");
  if (architecture.profile === "technical" && architecture.allowedEvidence.includes("SCENARIO")) {
    errors.push("TECHNICAL_REPORT_CANNOT_TREAT_SCENARIOS_AS_TECHNICAL_EVIDENCE");
  }
  if (architecture.profile === "technical" && architecture.allowedEvidence.includes("PROPOSED")) {
    errors.push("TECHNICAL_REPORT_CANNOT_TREAT_PROPOSALS_AS_TECHNICAL_EVIDENCE");
  }
  if (architecture.profile === "targeting" && !ids.includes("ground_truth")) {
    errors.push("TARGETING_GROUND_TRUTH_REQUIRED");
  }
  return errors;
}
