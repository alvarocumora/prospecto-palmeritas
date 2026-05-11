import type { RequestContext } from "./requestContext";

export type EdgeFunctionCallOptions<TBody = unknown> = {
  functionName: string;
  body?: TBody;
  context: RequestContext;
};

export type EdgeFunctionCallPayload<TBody = unknown> = {
  body?: TBody;
  context: {
    requestId: string;
    actor: RequestContext["actor"];
    metadata?: RequestContext["metadata"];
  };
};

export type EdgeFunctionHeaders = Record<string, string>;
