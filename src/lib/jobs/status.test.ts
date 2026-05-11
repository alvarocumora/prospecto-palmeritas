import { describe, expect, it } from "vitest";
import { canRetryJob, evaluateJobStatus, getAttemptsRemaining, isJobStale, isTerminalJobStatus } from "./status";

describe("job status helpers", () => {
  const now = new Date("2026-05-11T12:00:00Z").getTime();

  it("detects terminal statuses", () => {
    expect(isTerminalJobStatus("succeeded")).toBe(true);
    expect(isTerminalJobStatus("failed")).toBe(true);
    expect(isTerminalJobStatus("cancelled")).toBe(true);
    expect(isTerminalJobStatus("running")).toBe(false);
  });

  it("calculates attempts remaining", () => {
    expect(getAttemptsRemaining({ attempts: 1, maxAttempts: 3 })).toBe(2);
    expect(getAttemptsRemaining({ attempts: 5, maxAttempts: 3 })).toBe(0);
  });

  it("detects stale running jobs", () => {
    expect(
      isJobStale(
        {
          status: "running",
          attempts: 1,
          maxAttempts: 3,
          updatedAt: "2026-05-11T11:00:00Z",
          staleAfterMs: 1000 * 60 * 30,
        },
        now
      )
    ).toBe(true);
  });

  it("does not mark fresh running jobs as stale", () => {
    expect(
      isJobStale(
        {
          status: "running",
          attempts: 1,
          maxAttempts: 3,
          updatedAt: "2026-05-11T11:45:00Z",
          staleAfterMs: 1000 * 60 * 30,
        },
        now
      )
    ).toBe(false);
  });

  it("marks missing updatedAt running jobs as stale", () => {
    expect(
      isJobStale({ status: "running", attempts: 0, maxAttempts: 3, updatedAt: null }, now)
    ).toBe(true);
  });

  it("checks retry eligibility", () => {
    expect(canRetryJob({ status: "failed", attempts: 1, maxAttempts: 3, updatedAt: null })).toBe(true);
    expect(canRetryJob({ status: "failed", attempts: 3, maxAttempts: 3, updatedAt: null })).toBe(false);
    expect(canRetryJob({ status: "succeeded", attempts: 1, maxAttempts: 3, updatedAt: null })).toBe(false);
  });

  it("evaluates stale job status decisions", () => {
    expect(
      evaluateJobStatus(
        {
          status: "running",
          attempts: 1,
          maxAttempts: 3,
          updatedAt: "2026-05-11T11:00:00Z",
          staleAfterMs: 1000 * 60 * 30,
        },
        now
      )
    ).toEqual({
      status: "stale",
      isTerminal: false,
      canRetry: true,
      isStale: true,
      attemptsRemaining: 2,
    });
  });
});
