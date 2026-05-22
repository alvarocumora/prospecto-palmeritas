export type AnalyticsEventName =
  | "dashboard.viewed"
  | "deal.created"
  | "deal.stage_changed"
  | "report.review_submitted"
  | "report.review_approved"
  | "report.review_declined"
  | "evidence.added"
  | "signature.requested"
  | "dataroom.file_uploaded"
  | "tenant.plan_changed";

export type AnalyticsEvent = {
  name: AnalyticsEventName;
  organizationId?: string | null;
  projectId?: string | null;
  actorId?: string | null;
  entityId?: string | null;
  occurredAt: string;
  properties?: Record<string, unknown>;
};

export function createAnalyticsEvent(
  name: AnalyticsEventName,
  input: Omit<AnalyticsEvent, "name" | "occurredAt"> & { occurredAt?: string } = {},
): AnalyticsEvent {
  return {
    name,
    organizationId: input.organizationId ?? null,
    projectId: input.projectId ?? null,
    actorId: input.actorId ?? null,
    entityId: input.entityId ?? null,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    properties: input.properties ?? {},
  };
}
