import type { FeatureFlagContext, FeatureFlagDecision, FeatureFlagKey, PlanId } from "@/types/featureFlags";

export const PLAN_FEATURES: Record<PlanId, ReadonlySet<FeatureFlagKey>> = {
  free: new Set([]),
  starter: new Set([
    "geocapital.marketplace",
  ]),
  pro: new Set([
    "geocapital.ai_copilot",
    "geocapital.ni43101_export",
    "geocapital.marketplace",
    "geocapital.advanced_3d",
  ]),
  enterprise: new Set([
    "geocapital.ai_copilot",
    "geocapital.ni43101_export",
    "geocapital.investor_crm",
    "geocapital.marketplace",
    "geocapital.advanced_3d",
    "geocapital.bulk_sync",
  ]),
};

export function isKnownPlan(plan: string): plan is PlanId {
  return plan in PLAN_FEATURES;
}

export function isFeatureEnabled(feature: FeatureFlagKey, context: FeatureFlagContext): boolean {
  return evaluateFeatureFlag(feature, context).enabled;
}

export function evaluateFeatureFlag(feature: FeatureFlagKey, context: FeatureFlagContext): FeatureFlagDecision {
  const override = context.overrides?.[feature];
  if (override) {
    return {
      enabled: override.enabled,
      source: "override",
      reason: override.reason ?? `Feature ${override.enabled ? "enabled" : "disabled"} by explicit override`,
    };
  }

  const enabled = PLAN_FEATURES[context.plan].has(feature);
  return {
    enabled,
    source: "plan",
    reason: enabled ? `Feature enabled for ${context.plan} plan` : `Feature unavailable for ${context.plan} plan`,
  };
}

export function listEnabledFeatures(context: FeatureFlagContext): FeatureFlagKey[] {
  const features = new Set<FeatureFlagKey>(PLAN_FEATURES[context.plan]);

  for (const [feature, override] of Object.entries(context.overrides ?? {}) as [FeatureFlagKey, { enabled: boolean }][]) {
    if (override.enabled) features.add(feature);
    else features.delete(feature);
  }

  return [...features].sort();
}
