import type {
  FusionScore,
  FusionScoreConfidence,
  FusionScoreInputKey,
  FusionScoreInputs,
  FusionScoreWeights,
} from "@/types/fusionScore";

export const DEFAULT_FUSION_SCORE_WEIGHTS: FusionScoreWeights = {
  geophysics: 0.25,
  geochemistry: 0.25,
  structural: 0.2,
  satellite: 0.15,
  drilling: 0.15,
};

const DRIVER_LABELS: Record<FusionScoreInputKey, string> = {
  geophysics: "Geophysics",
  geochemistry: "Geochemistry",
  structural: "Structural control",
  satellite: "Satellite alteration",
  drilling: "Drilling evidence",
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function normalizeWeights(weights: FusionScoreWeights): FusionScoreWeights {
  const total = Object.values(weights).reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (total <= 0) return DEFAULT_FUSION_SCORE_WEIGHTS;

  return {
    geophysics: Math.max(0, weights.geophysics) / total,
    geochemistry: Math.max(0, weights.geochemistry) / total,
    structural: Math.max(0, weights.structural) / total,
    satellite: Math.max(0, weights.satellite) / total,
    drilling: Math.max(0, weights.drilling) / total,
  };
}

function confidenceFromInputs(inputs: FusionScoreInputs, score: number): FusionScoreConfidence {
  const strongSignals = Object.values(inputs).filter((value) => clampScore(value) >= 60).length;
  const veryWeakSignals = Object.values(inputs).filter((value) => clampScore(value) < 25).length;

  if (score >= 70 && strongSignals >= 3) return "high";
  if (score >= 45 && strongSignals >= 2 && veryWeakSignals <= 2) return "medium";
  return "low";
}

function getDrivers(inputs: FusionScoreInputs): string[] {
  return (Object.entries(inputs) as [FusionScoreInputKey, number][])
    .filter(([, value]) => clampScore(value) >= 60)
    .sort((a, b) => clampScore(b[1]) - clampScore(a[1]))
    .map(([key, value]) => `${DRIVER_LABELS[key]} (${Math.round(clampScore(value))})`);
}

export function calculateFusionScore(
  inputs: FusionScoreInputs,
  weights: FusionScoreWeights = DEFAULT_FUSION_SCORE_WEIGHTS
): FusionScore {
  const normalizedWeights = normalizeWeights(weights);
  const score = Math.round(
    clampScore(inputs.geophysics) * normalizedWeights.geophysics +
      clampScore(inputs.geochemistry) * normalizedWeights.geochemistry +
      clampScore(inputs.structural) * normalizedWeights.structural +
      clampScore(inputs.satellite) * normalizedWeights.satellite +
      clampScore(inputs.drilling) * normalizedWeights.drilling
  );

  return {
    score,
    confidence: confidenceFromInputs(inputs, score),
    drivers: getDrivers(inputs),
  };
}
