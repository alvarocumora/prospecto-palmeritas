import type { SpvStatus } from "./types";

export type SpvTransitionAction =
  | "start_structuring"
  | "start_due_diligence"
  | "start_roadshow"
  | "start_negotiation"
  | "mark_funded"
  | "start_operations"
  | "start_exit"
  | "close"
  | "liquidate"
  | "reopen";

export type SpvTransition = {
  from: SpvStatus;
  to: SpvStatus;
  action: SpvTransitionAction;
};

export const SPV_TRANSITIONS: readonly SpvTransition[] = [
  { from: "draft", to: "structuring", action: "start_structuring" },
  { from: "structuring", to: "due_diligence", action: "start_due_diligence" },
  { from: "due_diligence", to: "roadshow", action: "start_roadshow" },
  { from: "roadshow", to: "negotiation", action: "start_negotiation" },
  { from: "negotiation", to: "funded", action: "mark_funded" },
  { from: "funded", to: "operating", action: "start_operations" },
  { from: "operating", to: "exit", action: "start_exit" },
  { from: "exit", to: "closed", action: "close" },
  { from: "closed", to: "liquidated", action: "liquidate" },
  { from: "closed", to: "operating", action: "reopen" },
] as const;

export function getAllowedSpvTransitions(status: SpvStatus): SpvTransition[] {
  return SPV_TRANSITIONS.filter((transition) => transition.from === status);
}

export function canTransitionSpv(from: SpvStatus, to: SpvStatus): boolean {
  return SPV_TRANSITIONS.some((transition) => transition.from === from && transition.to === to);
}

export function transitionSpvStatus(from: SpvStatus, action: SpvTransitionAction): SpvStatus {
  const transition = SPV_TRANSITIONS.find((item) => item.from === from && item.action === action);
  if (!transition) throw new Error(`Invalid SPV transition: ${from} via ${action}`);
  return transition.to;
}
