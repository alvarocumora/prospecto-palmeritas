export type JobStatus =
  "queued" | "running" | "succeeded" | "failed" | "retrying" | "cancelled" | "stale";

export type JobStatusInput = {
  status: Exclude<JobStatus, "stale">;
  attempts: number;
  maxAttempts: number;
  updatedAt: string | Date | null;
  staleAfterMs?: number;
};

export type JobStatusDecision = {
  status: JobStatus;
  isTerminal: boolean;
  canRetry: boolean;
  isStale: boolean;
  attemptsRemaining: number;
};
