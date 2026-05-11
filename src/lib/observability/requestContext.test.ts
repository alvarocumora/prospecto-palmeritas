import { describe, expect, it, vi } from "vitest";
import {
  createRequestContext,
  createRequestContextHeaders,
  getRequestContextActorKey,
  withRequestContextMetadata,
} from "./requestContext";

describe("request context helpers", () => {
  it("creates a request context with an existing valid request id", () => {
    expect(
      createRequestContext({
        requestId: "geo:existing-1234",
        actor: { organizationId: "org-1", projectId: "project-1", userId: "user-1" },
      })
    ).toEqual({
      requestId: "geo:existing-1234",
      actor: { organizationId: "org-1", projectId: "project-1", userId: "user-1" },
      features: undefined,
      usage: undefined,
      metadata: undefined,
    });
  });

  it("creates a new request id when none is provided", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000003");

    expect(createRequestContext().requestId).toBe("geocapitals:00000000-0000-4000-8000-000000000003");

    vi.restoreAllMocks();
  });

  it("creates request context headers", () => {
    expect(createRequestContextHeaders({ requestId: "geo:abc-1234" })).toEqual({
      "x-request-id": "geo:abc-1234",
    });
  });

  it("merges request context metadata", () => {
    expect(
      withRequestContextMetadata(
        createRequestContext({ requestId: "geo:abc-1234", metadata: { source: "map" } }),
        { action: "sync" }
      ).metadata
    ).toEqual({ source: "map", action: "sync" });
  });

  it("creates stable actor keys", () => {
    expect(
      getRequestContextActorKey(
        createRequestContext({
          requestId: "geo:abc-1234",
          actor: { organizationId: "org-1", projectId: "project-1", userId: "user-1" },
        })
      )
    ).toBe("org-1/project-1/user-1");

    expect(getRequestContextActorKey(createRequestContext({ requestId: "geo:abc-1234" }))).toBe(
      "org:none/project:none/user:none"
    );
  });
});
