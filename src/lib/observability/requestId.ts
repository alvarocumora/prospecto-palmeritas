const REQUEST_ID_HEADER = "x-request-id";
const REQUEST_ID_PREFIX = "geo";
const REQUEST_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{7,127}$/i;

export type RequestIdHeaders = Record<typeof REQUEST_ID_HEADER, string>;

export function isValidRequestId(value: string | null | undefined): value is string {
  if (!value) return false;
  return REQUEST_ID_PATTERN.test(value.trim());
}

export function normalizeRequestId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return isValidRequestId(normalized) ? normalized : null;
}

export function createRequestId(scope = REQUEST_ID_PREFIX): string {
  const safeScope =
    scope
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || REQUEST_ID_PREFIX;

  const randomPart =
    crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${safeScope}:${randomPart}`;
}

export function getOrCreateRequestId(existing?: string | null, scope?: string): string {
  return normalizeRequestId(existing) ?? createRequestId(scope);
}

export function createRequestIdHeaders(requestId: string): RequestIdHeaders {
  const normalized = normalizeRequestId(requestId);
  if (!normalized) throw new Error("Invalid request id");
  return { [REQUEST_ID_HEADER]: normalized };
}

export const requestIdHeaderName = REQUEST_ID_HEADER;
