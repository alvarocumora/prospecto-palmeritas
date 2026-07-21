import type { ComponentType } from "react";

import { template as catastroExpirationInternal } from "./catastro-expiration-internal";
import { template as catastroExpirationInvestor } from "./catastro-expiration-investor";
import { template as satelliteAnomalyInternal } from "./satellite-anomaly-internal";
import { template as satelliteAnomalyInvestor } from "./satellite-anomaly-investor";
import { template as projectInvitationInternal } from "./project-invitation-internal";
import { template as projectInvitationInvestor } from "./project-invitation-investor";
import { template as reportSignedInternal } from "./report-signed-internal";
import { template as reportSignedInvestor } from "./report-signed-investor";
import { template as investorWelcome } from "./investor-welcome";
import { template as investorApproved } from "./investor-approved";
import { template as investorLeadInternal } from "./investor-lead-internal";
import { template as investorRejected } from "./investor-rejected";
import { template as contactMessageInternal } from "./contact-message-internal";
import { template as commodityInquiryInternal } from "./commodity-inquiry-internal";
import { template as inquiryUpdateBuyer } from "./inquiry-update-buyer";
import { template as signRequestSigner } from "./sign-request-signer";
import { template as signCompletedOwner } from "./sign-completed-owner";
import { template as signCompletedInternal } from "./sign-completed-internal";
import { template as shipmentUpdate } from "./shipment-update";
import { template as sourcingProposalReceived } from "./sourcing-proposal-received";
import { template as sourcingConvertedSupplier } from "./sourcing-converted-supplier";
import { template as paymentReminder } from "./payment-reminder";
import { template as supplierOnboarding } from "./supplier-onboarding";
import { template as antimonyProductSheet } from "./antimony-product-sheet";
import { template as agentOutreach } from "./agent-outreach";

export interface TemplateEntry {
  component: ComponentType<Record<string, unknown>>;
  subject: string | ((data: Record<string, unknown>) => string);
  displayName?: string;
  previewData?: Record<string, unknown>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 * Add new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  "catastro-expiration-internal": catastroExpirationInternal,
  "catastro-expiration-investor": catastroExpirationInvestor,
  "satellite-anomaly-internal": satelliteAnomalyInternal,
  "satellite-anomaly-investor": satelliteAnomalyInvestor,
  "project-invitation-internal": projectInvitationInternal,
  "project-invitation-investor": projectInvitationInvestor,
  "report-signed-internal": reportSignedInternal,
  "report-signed-investor": reportSignedInvestor,
  "investor-welcome": investorWelcome,
  "investor-approved": investorApproved,
  "investor-lead-internal": investorLeadInternal,
  "investor-rejected": investorRejected,
  "contact-message-internal": contactMessageInternal,
  "commodity-inquiry-internal": commodityInquiryInternal,
  "inquiry-update-buyer": inquiryUpdateBuyer,
  "sign-request-signer": signRequestSigner,
  "sign-completed-owner": signCompletedOwner,
  "sign-completed-internal": signCompletedInternal,
  "shipment-update": shipmentUpdate,
  "sourcing-proposal-received": sourcingProposalReceived,
  "sourcing-converted-supplier": sourcingConvertedSupplier,
  "payment-reminder": paymentReminder,
  "supplier-onboarding": supplierOnboarding,
  "antimony-product-sheet": antimonyProductSheet,
  "agent-outreach": agentOutreach,
};
