import type { SpvRole } from "./types";

export type SpvCapability =
  | "spv.view"
  | "spv.manage"
  | "asset.edit"
  | "participants.manage"
  | "cap_table.manage"
  | "financial_model.edit"
  | "waterfall.manage"
  | "dataroom.upload"
  | "dataroom.review"
  | "due_diligence.manage"
  | "pipeline.manage"
  | "documents.generate"
  | "compliance.manage"
  | "reports.export"
  | "audit.view";

const ALL_CAPABILITIES: SpvCapability[] = [
  "spv.view",
  "spv.manage",
  "asset.edit",
  "participants.manage",
  "cap_table.manage",
  "financial_model.edit",
  "waterfall.manage",
  "dataroom.upload",
  "dataroom.review",
  "due_diligence.manage",
  "pipeline.manage",
  "documents.generate",
  "compliance.manage",
  "reports.export",
  "audit.view",
];

export const SPV_ROLE_CAPABILITIES: Record<SpvRole, readonly SpvCapability[]> = {
  geocapitals_super_admin: ALL_CAPABILITIES,
  investment_executive: [
    "spv.view",
    "spv.manage",
    "participants.manage",
    "cap_table.manage",
    "financial_model.edit",
    "waterfall.manage",
    "dataroom.upload",
    "dataroom.review",
    "due_diligence.manage",
    "pipeline.manage",
    "documents.generate",
    "compliance.manage",
    "reports.export",
    "audit.view",
  ],
  financial_analyst: [
    "spv.view",
    "cap_table.manage",
    "financial_model.edit",
    "waterfall.manage",
    "dataroom.review",
    "due_diligence.manage",
    "reports.export",
    "audit.view",
  ],
  asset_owner: [
    "spv.view",
    "asset.edit",
    "dataroom.upload",
    "due_diligence.manage",
    "reports.export",
    "audit.view",
  ],
  investor: ["spv.view", "dataroom.review", "reports.export", "audit.view"],
  legal_advisor: [
    "spv.view",
    "dataroom.upload",
    "dataroom.review",
    "due_diligence.manage",
    "documents.generate",
    "compliance.manage",
    "reports.export",
    "audit.view",
  ],
  technical_advisor: [
    "spv.view",
    "asset.edit",
    "dataroom.upload",
    "dataroom.review",
    "due_diligence.manage",
    "reports.export",
    "audit.view",
  ],
  auditor: ["spv.view", "dataroom.review", "reports.export", "audit.view"],
};

export function hasSpvCapability(role: SpvRole, capability: SpvCapability): boolean {
  return SPV_ROLE_CAPABILITIES[role].includes(capability);
}
