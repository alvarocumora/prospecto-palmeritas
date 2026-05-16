import { evaluateFeatureFlag, listEnabledFeatures } from "./featureFlags";
import { evaluateAllUsageLimits } from "@/lib/usage/limits";
import type {
  FeatureFlagContext,
  FeatureFlagDecision,
  FeatureFlagKey,
  PlanId,
} from "@/types/featureFlags";
import type { UsageLimitContext, UsageLimitDecision, UsageSnapshot } from "@/types/usage";

export type SaaSCapabilityContext = {
  plan: PlanId;
  featureOverrides?: FeatureFlagContext["overrides"];
  usage?: UsageSnapshot;
  usageOverrides?: UsageLimitContext["overrides"];
};

export type SaaSCapabilitySnapshot = {
  plan: PlanId;
  enabledFeatures: FeatureFlagKey[];
  featureDecisions: Record<FeatureFlagKey, FeatureFlagDecision>;
  usageDecisions: UsageLimitDecision[];
};

export const CORE_GEOCAPITAL_FEATURES: FeatureFlagKey[] = [
  "geocapital.ai_copilot",
  "geocapital.ni43101_export",
  "geocapital.investor_crm",
  "geocapital.marketplace",
  "geocapital.advanced_3d",
  "geocapital.bulk_sync",
];

export function buildCapabilitySnapshot(context: SaaSCapabilityContext): SaaSCapabilitySnapshot {
  const featureContext: FeatureFlagContext = {
    plan: context.plan,
    overrides: context.featureOverrides,
  };

  return {
    plan: context.plan,
    enabledFeatures: listEnabledFeatures(featureContext),
    featureDecisions: Object.fromEntries(
      CORE_GEOCAPITAL_FEATURES.map((feature) => [
        feature,
        evaluateFeatureFlag(feature, featureContext),
      ]),
    ) as Record<FeatureFlagKey, FeatureFlagDecision>,
    usageDecisions: evaluateAllUsageLimits({
      plan: context.plan,
      usage: context.usage ?? {},
      overrides: context.usageOverrides,
    }),
  };
}

export function canUseFeature(feature: FeatureFlagKey, context: SaaSCapabilityContext): boolean {
  return buildCapabilitySnapshot(context).featureDecisions[feature].enabled;
}
