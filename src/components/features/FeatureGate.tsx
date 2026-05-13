import type { ReactNode } from "react";
import { canUseFeature, type SaaSCapabilityContext } from "@/lib/features/capabilities";
import type { FeatureFlagKey } from "@/types/featureFlags";

type FeatureGateProps = {
  feature: FeatureFlagKey;
  context: SaaSCapabilityContext;
  children: ReactNode;
  fallback?: ReactNode;
};

export function FeatureGate({ feature, context, children, fallback = null }: FeatureGateProps) {
  if (!canUseFeature(feature, context)) return <>{fallback}</>;
  return <>{children}</>;
}
