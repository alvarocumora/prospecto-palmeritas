import type { HashedTraceabilityEvent, TraceabilityEventPayload } from "./types";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)]),
    );
  }
  return value;
}

export function canonicalEventPayload(event: TraceabilityEventPayload): string {
  return JSON.stringify(
    stable({
      ...event,
      inputRefs: event.inputRefs ?? [],
      outputRefs: event.outputRefs ?? [],
      evidenceRefs: event.evidenceRefs ?? [],
      metadata: event.metadata ?? {},
      previousHash: event.previousHash ?? null,
    }),
  );
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashTraceabilityEvent(
  event: TraceabilityEventPayload,
): Promise<HashedTraceabilityEvent> {
  return { ...event, payloadHash: await sha256Hex(canonicalEventPayload(event)) };
}

export async function verifyTraceabilityChain(events: HashedTraceabilityEvent[]) {
  const ordered = [...events].sort((a, b) => a.sequenceNo - b.sequenceNo);
  const errors: string[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const event = ordered[i];
    if (event.sequenceNo !== i + 1) errors.push(`SEQUENCE_GAP:${event.sequenceNo}`);
    const expectedPrevious = i === 0 ? null : ordered[i - 1].payloadHash;
    if ((event.previousHash ?? null) !== expectedPrevious)
      errors.push(`CHAIN_BREAK:${event.sequenceNo}`);
    const actual = await sha256Hex(canonicalEventPayload(event));
    if (actual !== event.payloadHash) errors.push(`HASH_MISMATCH:${event.sequenceNo}`);
  }
  return { valid: errors.length === 0, errors };
}
