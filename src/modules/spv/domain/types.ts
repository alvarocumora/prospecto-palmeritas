export type SpvStatus =
  | "draft"
  | "structuring"
  | "due_diligence"
  | "roadshow"
  | "negotiation"
  | "funded"
  | "operating"
  | "exit"
  | "closed"
  | "liquidated";

export type SpvObjective =
  | "asset_acquisition"
  | "joint_venture"
  | "exploration"
  | "development"
  | "production"
  | "asset_sale"
  | "capital_raise"
  | "stake_purchase"
  | "other";

export type SpvRole =
  | "geocapitals_super_admin"
  | "investment_executive"
  | "financial_analyst"
  | "asset_owner"
  | "investor"
  | "legal_advisor"
  | "technical_advisor"
  | "auditor";

export type ParticipantType =
  | "asset_owner"
  | "structurer"
  | "investor"
  | "operator"
  | "advisor"
  | "strategic_partner";

export type ContributionType =
  | "mining_asset"
  | "mining_rights"
  | "cash"
  | "geological_studies"
  | "professional_services"
  | "technology"
  | "equipment"
  | "commercial_network"
  | "investor_origination"
  | "transaction_management";

export type CompensationType =
  | "monthly_retainer"
  | "structuring_fee"
  | "success_fee"
  | "equity"
  | "profit_share"
  | "carry"
  | "royalty"
  | "nsr"
  | "capital_raise_commission"
  | "asset_sale_commission"
  | "milestone_fee";

export type ReviewStatus =
  | "not_started"
  | "pending"
  | "in_review"
  | "observations"
  | "approved"
  | "rejected"
  | "not_applicable";

export type MiningAsset = {
  id: string;
  name: string;
  ownerName: string;
  commodity: string;
  country: string;
  region: string;
  coordinates?: { lat: number; lng: number } | null;
  areaHa?: number | null;
  concessionCount?: number | null;
  legalStatus: ReviewStatus;
  explorationStage: string;
  inferredResources?: number | null;
  indicatedResources?: number | null;
  measuredResources?: number | null;
  probableReserves?: number | null;
  provenReserves?: number | null;
  averageGrade?: number | null;
  metallurgicalRecoveryPct?: number | null;
  mineLifeYears?: number | null;
  capexUsd?: number | null;
  opexUsd?: number | null;
  annualProduction?: number | null;
  technicalStandard?: "NI_43_101" | "JORC" | "other" | null;
  environmentalStatus: ReviewStatus;
  executiveSummary: string;
  keyRisks: string[];
};

export type SpvParticipant = {
  id: string;
  name: string;
  type: ParticipantType;
  ownershipPct: number;
  votingPct: number;
  economicRightsPct: number;
  contributionType: ContributionType;
  contributionValueUsd?: number | null;
  status: "proposed" | "confirmed" | "active" | "exited";
};

export type CompensationRule = {
  id: string;
  beneficiaryParticipantId: string;
  type: CompensationType;
  percentage?: number | null;
  fixedAmount?: number | null;
  currency: string;
  calculationBase?: string | null;
  triggerEvent?: string | null;
  paymentPriority: number;
  capAmount?: number | null;
  minimumAmount?: number | null;
  durationMonths?: number | null;
  conditions: string[];
  disclosed: boolean;
};

export type SpvDeal = {
  id: string;
  legalName: string;
  commercialName: string;
  jurisdiction: string;
  entityType: string;
  baseCurrency: string;
  status: SpvStatus;
  objective: SpvObjective;
  asset: MiningAsset;
  participants: SpvParticipant[];
  compensationRules: CompensationRule[];
  referenceAssetValueUsd: number;
  capitalTargetUsd: number;
  capitalCommittedUsd: number;
  preferredReturnPct?: number | null;
  nextMilestone?: string | null;
  createdAt: string;
  updatedAt: string;
};
