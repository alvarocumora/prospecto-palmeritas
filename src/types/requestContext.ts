import type { FeatureFlagContext } from "./featureFlags";
import type { UsageLimitContext } from "./usage";

export type RequestActor = {
  userId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
};

export type RequestContext = {
  requestId: string;
  actor: RequestActor;
  features?: FeatureFlagContext;
  usage?: UsageLimitContext;
  metadata?: Record<string, unknown>;
};

export type RequestContextInit = {
  requestId?: string | null;
  actor?: RequestActor;
  features?: FeatureFlagContext;
  usage?: UsageLimitContext;
  metadata?: Record<string, unknown>;
};
