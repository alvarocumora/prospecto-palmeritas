import type { JobStatus, JobStatusDecision, JobStatusInput } from "@/types/jobs";

const DEFAULT_STALE_AFTER_MS = 1000 * 60 * 30;

const TERMINAL_STATUSES = new Set<JobStatus>(["succeeded", "failed", "cancelled"]);

function toTimestamp(value: string | Date | null): number | null {
  if (!value) return null;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isJobStale(input: JobStatusInput, now = Date.now()): boolean {
  if (input.status !== "running" && input.status !== "retrying") return false;

  const updatedAt = toTimestamp(input.updatedAt);
  if (updatedAt === null) return true;

  const staleAfterMs = input.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  return now - updatedAt > staleAfterMs;
}

export function getAttemptsRemaining(input: Pick<JobStatusInput, "attempts" | "maxAttempts">): number {
  return Math.max(0, input.maxAttempts - input.attempts);
}

export function canRetryJob(input: JobStatusInput): boolean {
  if (input.status === "succeeded" || input.status === "cancelled") return false;
  return getAttemptsRemaining(input) > 0;
}

export function evaluateJobStatus(input: JobStatusInput, now = Date.now()): JobStatusDecision {
  const isStale = isJobStale(input, now);
  const status = isStale ? "stale" : input.status;
  const attemptsRemaining = getAttemptsRemaining(input);

  return {
    status,
    isTerminal: isTerminalJobStatus(status),
    canRetry: status === "stale" ? attemptsRemaining > 0 : canRetryJob(input),
    isStale,
    attemptsRemaining,
  };
}
