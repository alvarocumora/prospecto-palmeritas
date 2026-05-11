export type FusionScoreConfidence = "low" | "medium" | "high";

export type FusionScoreInputs = {
  geophysics: number;
  geochemistry: number;
  structural: number;
  satellite: number;
  drilling: number;
};

export type FusionScoreWeights = FusionScoreInputs;

export type FusionScore = {
  score: number;
  confidence: FusionScoreConfidence;
  drivers: string[];
};

export type FusionScoreInputKey = keyof FusionScoreInputs;
