export type ReportReviewStatus = "draft" | "review" | "changes" | "approved" | "declined";

export type ReportReviewAction = "submit" | "request_changes" | "resubmit" | "approve" | "decline" | "reopen";

export type ReportReviewTransition = {
  from: ReportReviewStatus;
  to: ReportReviewStatus;
  action: ReportReviewAction;
};

export const REPORT_REVIEW_TRANSITIONS: ReportReviewTransition[] = [
  { from: "draft", to: "review", action: "submit" },
  { from: "review", to: "changes", action: "request_changes" },
  { from: "changes", to: "review", action: "resubmit" },
  { from: "review", to: "approved", action: "approve" },
  { from: "review", to: "declined", action: "decline" },
  { from: "approved", to: "review", action: "reopen" },
  { from: "declined", to: "draft", action: "reopen" },
];

export function canTransitionReportReview(from: ReportReviewStatus, to: ReportReviewStatus): boolean {
  return REPORT_REVIEW_TRANSITIONS.some((transition) => transition.from === from && transition.to === to);
}

export function getAllowedReportReviewTransitions(from: ReportReviewStatus): ReportReviewTransition[] {
  return REPORT_REVIEW_TRANSITIONS.filter((transition) => transition.from === from);
}

export function transitionReportReviewStatus(from: ReportReviewStatus, action: ReportReviewAction): ReportReviewStatus {
  const transition = REPORT_REVIEW_TRANSITIONS.find((item) => item.from === from && item.action === action);
  if (!transition) throw new Error(`Invalid report review transition: ${from} via ${action}`);
  return transition.to;
}

export function isTerminalReportReviewStatus(status: ReportReviewStatus): boolean {
  return status === "approved" || status === "declined";
}
