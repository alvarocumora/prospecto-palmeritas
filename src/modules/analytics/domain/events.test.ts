import { describe, expect, it } from "vitest";
import { createAnalyticsEvent } from "./events";

describe("analytics event catalog", () => {
  it("creates typed analytics events", () => {
    expect(
      createAnalyticsEvent("deal.created", {
        organizationId: "org-1",
        projectId: "project-1",
        actorId: "user-1",
        entityId: "deal-1",
        occurredAt: "2026-05-22T00:00:00.000Z",
        properties: { valueUsd: 1000 },
      }),
    ).toEqual({
      name: "deal.created",
      organizationId: "org-1",
      projectId: "project-1",
      actorId: "user-1",
      entityId: "deal-1",
      occurredAt: "2026-05-22T00:00:00.000Z",
      properties: { valueUsd: 1000 },
    });
  });
});
