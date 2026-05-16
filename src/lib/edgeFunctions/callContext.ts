import { createRequestContextHeaders } from "@/lib/observability/requestContext";
import type {
  EdgeFunctionCallOptions,
  EdgeFunctionCallPayload,
  EdgeFunctionHeaders,
} from "@/types/edgeFunctions";

export function createEdgeFunctionHeaders<TBody>(
  options: EdgeFunctionCallOptions<TBody>,
): EdgeFunctionHeaders {
  return createRequestContextHeaders(options.context);
}

export function createEdgeFunctionPayload<TBody>(
  options: EdgeFunctionCallOptions<TBody>,
): EdgeFunctionCallPayload<TBody> {
  return {
    body: options.body,
    context: {
      requestId: options.context.requestId,
      actor: options.context.actor,
      metadata: options.context.metadata,
    },
  };
}

export function createEdgeFunctionLogLabel<TBody>(options: EdgeFunctionCallOptions<TBody>): string {
  const { organizationId, projectId, userId } = options.context.actor;
  return [
    `edge:${options.functionName}`,
    `request:${options.context.requestId}`,
    `org:${organizationId ?? "none"}`,
    `project:${projectId ?? "none"}`,
    `user:${userId ?? "none"}`,
  ].join(" ");
}
