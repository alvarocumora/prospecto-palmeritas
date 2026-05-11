import type { FusionScore, FusionScoreInputs } from "./fusionScore";
import type { GeoCopilotEvidenceRef, GeoCopilotEvidenceSummary } from "./geoCopilot";

export type ExplorationTargetContextInput = {
  targetId: string;
  name: string;
  inputs: FusionScoreInputs;
  evidence: GeoCopilotEvidenceRef[];
};

export type ExplorationTargetContext = {
  targetId: string;
  name: string;
  fusionScore: FusionScore;
  evidence: GeoCopilotEvidenceRef[];
  evidenceSummary: GeoCopilotEvidenceSummary;
};
