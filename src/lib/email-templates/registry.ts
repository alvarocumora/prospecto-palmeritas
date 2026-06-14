import type { ComponentType } from "react";

import { template as catastroExpirationInternal } from "./catastro-expiration-internal";
import { template as catastroExpirationInvestor } from "./catastro-expiration-investor";
import { template as satelliteAnomalyInternal } from "./satellite-anomaly-internal";
import { template as satelliteAnomalyInvestor } from "./satellite-anomaly-investor";
import { template as projectInvitationInternal } from "./project-invitation-internal";
import { template as projectInvitationInvestor } from "./project-invitation-investor";
import { template as reportSignedInternal } from "./report-signed-internal";
import { template as reportSignedInvestor } from "./report-signed-investor";

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
};
