import type { FeatureFlagKey, PlanId } from "@/types/featureFlags";

const FEATURE_LABELS: Record<FeatureFlagKey, string> = {
  "geocapital.ai_copilot": "AI Copilot",
  "geocapital.ni43101_export": "NI 43-101 Export",
  "geocapital.investor_crm": "Investor CRM",
  "geocapital.marketplace": "Marketplace",
  "geocapital.advanced_3d": "Advanced 3D",
  "geocapital.bulk_sync": "Bulk Sync",
};

type FeatureUnavailableProps = {
  feature: FeatureFlagKey;
  currentPlan: PlanId;
  requiredPlan?: PlanId;
  className?: string;
};

export function FeatureUnavailable({ feature, currentPlan, requiredPlan = "pro", className = "" }: FeatureUnavailableProps) {
  return (
    <div className={`rounded-lg border border-dashed border-border bg-muted/30 p-4 ${className}`}>
      <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Feature limit</div>
      <h3 className="mt-1 text-sm font-semibold text-foreground">{FEATURE_LABELS[feature]}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Current plan: <span className="font-medium text-foreground">{currentPlan}</span>. Required plan:{" "}
        <span className="font-medium text-foreground">{requiredPlan}</span>.
      </p>
    </div>
  );
}
