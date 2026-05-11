import type { PlanId } from "./featureFlags";

export type UsageLimitKey =
  | "projects_per_org"
  | "ai_briefs_per_month"
  | "ni43101_exports_per_month"
  | "storage_gb"
  | "heavy_sync_jobs_per_day";

export type UsageLimitConfig = Record<UsageLimitKey, number>;

export type UsageSnapshot = Partial<Record<UsageLimitKey, number>>;

export type UsageLimitContext = {
  plan: PlanId;
  usage: UsageSnapshot;
  overrides?: Partial<Record<UsageLimitKey, number>>;
};

export type UsageLimitDecision = {
  key: UsageLimitKey;
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
  source: "plan" | "override";
};
