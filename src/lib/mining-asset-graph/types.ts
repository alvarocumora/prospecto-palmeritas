export type MiningProvenance =
  "OFFICIAL" | "CERTIFIED" | "DOCUMENTARY" | "DECLARED" | "DERIVED" | "INTERPRETED";

export type MiningAssetNodeType =
  | "project"
  | "concession"
  | "target"
  | "geological_body"
  | "sample"
  | "assay"
  | "drillhole"
  | "geophysics_dataset"
  | "geochemistry_dataset"
  | "interpretation"
  | "resource_model"
  | "economic_model"
  | "investment_asset"
  | "production_batch"
  | "commodity_lot"
  | "mineral_passport";

export type MiningAssetNode = {
  id: string;
  projectId: string;
  nodeType: MiningAssetNodeType;
  canonicalKey: string;
  entityId: string | null;
  label: string;
  commodity: string | null;
  provenance: MiningProvenance;
  confidence: number | null;
  status: string;
  sourceRef: string | null;
  metadata: Record<string, unknown>;
};

export type MiningAssetEdge = {
  id: string;
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: string;
  provenance: MiningProvenance;
  confidence: number | null;
  metadata: Record<string, unknown>;
};

export type MineralPassport = {
  id: string;
  projectId: string;
  passportCode: string;
  commodity: string;
  materialForm: string | null;
  status: string;
  originCountry: string | null;
  originNodeId: string | null;
  currentLotId: string | null;
  metadata: Record<string, unknown>;
};

export type TraceabilityEventType =
  | "EXTRACTED"
  | "STOCKPILED"
  | "SAMPLED"
  | "ASSAYED"
  | "PROCESSED"
  | "BLENDED"
  | "SPLIT"
  | "TRANSFERRED"
  | "SHIPPED"
  | "RECEIVED"
  | "SMELTED"
  | "REFINED"
  | "RECYCLED"
  | "CERTIFIED";

export type TraceabilityEventPayload = {
  passportId: string;
  sequenceNo: number;
  eventType: TraceabilityEventType;
  occurredAt: string;
  actorName?: string | null;
  facilityName?: string | null;
  countryCode?: string | null;
  quantity?: number | null;
  unit?: string | null;
  inputRefs?: string[];
  outputRefs?: string[];
  evidenceRefs?: string[];
  previousHash?: string | null;
  metadata?: Record<string, unknown>;
};

export type HashedTraceabilityEvent = TraceabilityEventPayload & { payloadHash: string };
