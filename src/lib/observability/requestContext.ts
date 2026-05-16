import { createRequestIdHeaders, getOrCreateRequestId } from "./requestId";
import type { RequestContext, RequestContextInit } from "@/types/requestContext";

export function createRequestContext(init: RequestContextInit = {}): RequestContext {
  return {
    requestId: getOrCreateRequestId(init.requestId, "geocapitals"),
    actor: init.actor ?? {},
    features: init.features,
    usage: init.usage,
    metadata: init.metadata,
  };
}

export function createRequestContextHeaders(context: Pick<RequestContext, "requestId">) {
  return createRequestIdHeaders(context.requestId);
}

export function withRequestContextMetadata(
  context: RequestContext,
  metadata: Record<string, unknown>,
): RequestContext {
  return {
    ...context,
    metadata: {
      ...(context.metadata ?? {}),
      ...metadata,
    },
  };
}

export function getRequestContextActorKey(context: RequestContext): string {
  const { userId, organizationId, projectId } = context.actor;
  return [organizationId ?? "org:none", projectId ?? "project:none", userId ?? "user:none"].join(
    "/",
  );
}
