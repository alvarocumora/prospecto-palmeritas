import { describe, expect, it } from "vitest";
import {
  canTransitionReportReview,
  getAllowedReportReviewTransitions,
  isTerminalReportReviewStatus,
  transitionReportReviewStatus,
} from "./state";

describe("report review state", () => {
  it("allows valid transitions", () => {
    expect(canTransitionReportReview("draft", "review")).toBe(true);
    expect(canTransitionReportReview("review", "approved")).toBe(true);
    expect(canTransitionReportReview("draft", "approved")).toBe(false);
  });

  it("transitions by action", () => {
    expect(transitionReportReviewStatus("draft", "submit")).toBe("review");
    expect(transitionReportReviewStatus("review", "request_changes")).toBe("changes");
    expect(() => transitionReportReviewStatus("draft", "approve")).toThrow("Invalid report review transition");
  });

  it("lists allowed transitions", () => {
    expect(getAllowedReportReviewTransitions("review").map((item) => item.action)).toEqual([
      "request_changes",
      "approve",
      "decline",
    ]);
  });

  it("detects terminal statuses", () => {
    expect(isTerminalReportReviewStatus("approved")).toBe(true);
    expect(isTerminalReportReviewStatus("declined")).toBe(true);
    expect(isTerminalReportReviewStatus("review")).toBe(false);
  });
});
