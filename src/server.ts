import "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { consumeLastCapturedError } from "./lib/error-capture";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as unknown as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function summarizeError(err: unknown): { cls: string; msg: string; stack: string } {
  if (err instanceof Error) {
    return {
      cls: err.name || err.constructor?.name || "Error",
      msg: (err.message || String(err)).slice(0, 400),
      stack: (err.stack || "").split("\n").slice(0, 8).join(" | ").slice(0, 1200),
    };
  }
  try {
    const s = typeof err === "string" ? err : JSON.stringify(err);
    return { cls: typeof err, msg: s.slice(0, 400), stack: "" };
  } catch {
    return { cls: typeof err, msg: String(err).slice(0, 400), stack: "" };
  }
}

function diagHeaders(err: unknown, source: string): Record<string, string> {
  const { cls, msg, stack } = summarizeError(err);
  return {
    "content-type": "text/html; charset=utf-8",
    "x-geo-err-source": source,
    "x-geo-err-class": cls,
    "x-geo-err-message": encodeURIComponent(msg),
    "x-geo-err-stack": encodeURIComponent(stack),
  };
}

async function normalizeCatastrophicSsrResponse(
  request: Request,
  response: Response,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const captured = consumeLastCapturedError();
  const err = captured ?? new Error(`h3-swallowed: ${body.slice(0, 300)}`);
  // Multiple log shapes to maximize chance of reaching the log pipeline.
  console.error("[geo-ssr-500]", request.url, err);
  try {
    console.error("[geo-ssr-500-json]", JSON.stringify({
      url: request.url,
      body: body.slice(0, 500),
      ...summarizeError(err),
    }));
  } catch {}

  return new Response(renderErrorPage(), {
    status: 500,
    headers: diagHeaders(err, "h3-swallowed"),
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(request, response);
    } catch (error) {
      console.error("[geo-ssr-throw]", request.url, error);
      try {
        console.error("[geo-ssr-throw-json]", JSON.stringify({
          url: request.url,
          ...summarizeError(error),
        }));
      } catch {}
      return new Response(renderErrorPage(), {
        status: 500,
        headers: diagHeaders(error, "wrapper-catch"),
      });
    }
  },
};
