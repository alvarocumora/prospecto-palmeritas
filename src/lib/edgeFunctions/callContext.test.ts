import { describe, expect, it } from "vitest";
import type { RequestContext } from "@/types/requestContext";
import {
  createEdgeFunctionHeaders,
  createEdgeFunctionLogLabel,
  createEdgeFunctionPayload,
} from "./callContext";

const context: RequestContext = {
  requestId: "geo:abc-1234",
  actor: {
    organizationId: "org-1",
    projectId: "project-1",
    userId: "user-1",
  },
  metadata: {
    source: "test",
  },
};

describe("edge function call context helpers", () => {
  it("creates request-id headers", () => {
    expect(
      createEdgeFunctionHeaders({
        functionName: "sync-catastro",
        body: { force: true },
        context,
      }),
    ).toEqual({ "x-request-id": "geo:abc-1234" });
  });

  it("creates payload with body and safe context", () => {
    expect(
      createEdgeFunctionPayload({
        functionName: "sync-catastro",
        body: { force: true },
        context,
      }),
    ).toEqual({
      body: { force: true },
      context: {
        requestId: "geo:abc-1234",
        actor: {
          organizationId: "org-1",
          projectId: "project-1",
          userId: "user-1",
        },
        metadata: { source: "test" },
      },
    });
  });

  it("creates stable log labels", () => {
    expect(
      createEdgeFunctionLogLabel({
        functionName: "sync-catastro",
        body: { force: true },
        context,
      }),
    ).toBe("edge:sync-catastro request:geo:abc-1234 org:org-1 project:project-1 user:user-1");
  });
});
