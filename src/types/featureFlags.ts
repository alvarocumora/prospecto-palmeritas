export type PlanId = "free" | "starter" | "pro" | "enterprise";

export type FeatureFlagKey =
  | "geocapital.ai_copilot"
  | "geocapital.ni43101_export"
  | "geocapital.investor_crm"
  | "geocapital.marketplace"
  | "geocapital.advanced_3d"
  | "geocapital.bulk_sync";

export type FeatureFlagOverride = {
  enabled: boolean;
  reason?: string;
};

export type FeatureFlagContext = {
  plan: PlanId;
  overrides?: Partial<Record<FeatureFlagKey, FeatureFlagOverride>>;
};

export type FeatureFlagDecision = {
  enabled: boolean;
  source: "plan" | "override";
  reason: string;
};
