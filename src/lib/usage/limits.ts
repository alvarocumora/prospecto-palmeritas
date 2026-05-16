import type { PlanId } from "@/types/featureFlags";
import type {
  UsageLimitConfig,
  UsageLimitContext,
  UsageLimitDecision,
  UsageLimitKey,
} from "@/types/usage";

export const PLAN_USAGE_LIMITS: Record<PlanId, UsageLimitConfig> = {
  free: {
    projects_per_org: 1,
    ai_briefs_per_month: 0,
    ni43101_exports_per_month: 0,
    storage_gb: 1,
    heavy_sync_jobs_per_day: 0,
  },
  starter: {
    projects_per_org: 5,
    ai_briefs_per_month: 10,
    ni43101_exports_per_month: 1,
    storage_gb: 25,
    heavy_sync_jobs_per_day: 1,
  },
  pro: {
    projects_per_org: 25,
    ai_briefs_per_month: 100,
    ni43101_exports_per_month: 10,
    storage_gb: 250,
    heavy_sync_jobs_per_day: 10,
  },
  enterprise: {
    projects_per_org: 250,
    ai_briefs_per_month: 1000,
    ni43101_exports_per_month: 100,
    storage_gb: 5000,
    heavy_sync_jobs_per_day: 100,
  },
};

export function getUsageLimit(key: UsageLimitKey, context: UsageLimitContext) {
  const override = context.overrides?.[key];
  return {
    limit: override ?? PLAN_USAGE_LIMITS[context.plan][key],
    source: override === undefined ? ("plan" as const) : ("override" as const),
  };
}

export function evaluateUsageLimit(
  key: UsageLimitKey,
  context: UsageLimitContext,
): UsageLimitDecision {
  const used = Math.max(0, context.usage[key] ?? 0);
  const { limit, source } = getUsageLimit(key, context);
  const remaining = Math.max(0, limit - used);

  return {
    key,
    used,
    limit,
    remaining,
    allowed: used < limit,
    source,
  };
}

export function canConsumeUsage(
  key: UsageLimitKey,
  context: UsageLimitContext,
  amount = 1,
): boolean {
  const decision = evaluateUsageLimit(key, context);
  return decision.remaining >= amount;
}

export function evaluateAllUsageLimits(context: UsageLimitContext): UsageLimitDecision[] {
  return (Object.keys(PLAN_USAGE_LIMITS[context.plan]) as UsageLimitKey[]).map((key) =>
    evaluateUsageLimit(key, context),
  );
}
