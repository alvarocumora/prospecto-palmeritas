export type ReportReadiness = {
  projectId: string | null;
  geochem: {
    measured: number;
    declared: number;
    incomplete: number;
    total: number;
    ready: boolean;
  };
  geophysics: {
    realStations: number;
    syntheticStations: number;
    surveys: number;
    ready: boolean;
  };
  targets: {
    validated: number;
    candidates: number;
    total: number;
    note: string | null;
  };
  magTargets: {
    total: number;
    note: string | null;
  };
  overall: {
    hasRealData: boolean;
    reportReady: boolean;
    level: string;
    note: string | null;
  };
};

export type GovernanceReport = {
  id: string;
  version: number;
  status: string;
  leadQpId: string | null;
  activeStandards: string[];
  complianceScore: number | null;
  complianceThreshold: number;
};

export type GovernanceReviewer = {
  id: string;
  fullName: string;
  isVerified: boolean;
};

export type GovernanceSection = {
  status: string;
  requiresQpReview: boolean;
  qpId: string | null;
  signedAt: string | null;
};

export type GovernanceVersion = {
  versionNo: number;
  hashSha256: string;
  generatedAt: string;
  watermark: string | null;
};

export type DeliveryGateStatus =
  | "no_report"
  | "data_blocked"
  | "reviewer_required"
  | "review_incomplete"
  | "compliance_review"
  | "snapshot_required"
  | "controlled_release_candidate";

export type DeliveryGate = {
  status: DeliveryGateStatus;
  label: string;
  detail: string;
  dataReady: boolean;
  reviewerReady: boolean;
  sectionsReady: boolean;
  complianceReady: boolean;
  snapshotReady: boolean;
  requiredSections: number;
  signedRequiredSections: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function parseReportReadiness(value: unknown): ReportReadiness {
  const root = asRecord(value);
  const geochem = asRecord(root.geochem);
  const geophysics = asRecord(root.geophysics);
  const targets = asRecord(root.targets);
  const magTargets = asRecord(root.mag_targets);
  const overall = asRecord(root.overall);

  return {
    projectId: asString(root.project_id),
    geochem: {
      measured: asNumber(geochem.measured),
      declared: asNumber(geochem.declared),
      incomplete: asNumber(geochem.incomplete),
      total: asNumber(geochem.total),
      ready: asBoolean(geochem.ready),
    },
    geophysics: {
      realStations: asNumber(geophysics.real_stations),
      syntheticStations: asNumber(geophysics.synthetic_stations),
      surveys: asNumber(geophysics.surveys),
      ready: asBoolean(geophysics.ready),
    },
    targets: {
      validated: asNumber(targets.validated),
      candidates: asNumber(targets.candidates),
      total: asNumber(targets.total),
      note: asString(targets.note),
    },
    magTargets: {
      total: asNumber(magTargets.total),
      note: asString(magTargets.note),
    },
    overall: {
      hasRealData: asBoolean(overall.has_real_data),
      reportReady: asBoolean(overall.report_ready),
      level: asString(overall.level) ?? "empty",
      note: asString(overall.note),
    },
  };
}

export function evaluateDeliveryGate(input: {
  readiness: ReportReadiness | null;
  report: GovernanceReport | null;
  reviewer: GovernanceReviewer | null;
  sections: GovernanceSection[];
  versions: GovernanceVersion[];
}): DeliveryGate {
  const { readiness, report, reviewer, sections, versions } = input;
  const dataReady = readiness?.overall.reportReady ?? false;

  if (!report) {
    return {
      status: "no_report",
      label: "Sin reporte controlado",
      detail: "Crea o selecciona un technical report antes de evaluar emisión y revisión.",
      dataReady,
      reviewerReady: false,
      sectionsReady: false,
      complianceReady: false,
      snapshotReady: false,
      requiredSections: 0,
      signedRequiredSections: 0,
    };
  }

  const requiresReviewer = report.activeStandards.length > 0;
  const reviewerReady =
    !requiresReviewer ||
    Boolean(report.leadQpId && reviewer?.id === report.leadQpId && reviewer.isVerified);

  const requiredSections = sections.filter((section) => section.requiresQpReview).length;
  const signedRequiredSections = sections.filter(
    (section) =>
      section.requiresQpReview &&
      section.status === "signed" &&
      Boolean(section.signedAt) &&
      Boolean(section.qpId),
  ).length;
  const sectionsReady = requiredSections === 0 || signedRequiredSections === requiredSections;

  const complianceReady =
    report.activeStandards.length === 0 ||
    (report.complianceScore != null && report.complianceScore >= report.complianceThreshold);

  const latestVersion = [...versions].sort((a, b) => b.versionNo - a.versionNo)[0] ?? null;
  const snapshotReady = Boolean(latestVersion?.hashSha256);

  if (!dataReady) {
    return {
      status: "data_blocked",
      label: "Bloqueado por procedencia",
      detail:
        readiness?.overall.note ??
        "El gate de evidencia no confirma datos medidos suficientes para una salida entregable.",
      dataReady,
      reviewerReady,
      sectionsReady,
      complianceReady,
      snapshotReady,
      requiredSections,
      signedRequiredSections,
    };
  }

  if (!reviewerReady) {
    return {
      status: "reviewer_required",
      label: "Revisor competente requerido",
      detail:
        "El reporte declara un estándar activo, pero falta un QP/CP verificado como responsable principal.",
      dataReady,
      reviewerReady,
      sectionsReady,
      complianceReady,
      snapshotReady,
      requiredSections,
      signedRequiredSections,
    };
  }

  if (!sectionsReady) {
    return {
      status: "review_incomplete",
      label: "Revisión de secciones incompleta",
      detail: `${signedRequiredSections}/${requiredSections} secciones que requieren revisión QP/CP están firmadas.`,
      dataReady,
      reviewerReady,
      sectionsReady,
      complianceReady,
      snapshotReady,
      requiredSections,
      signedRequiredSections,
    };
  }

  if (!complianceReady) {
    return {
      status: "compliance_review",
      label: "Checklist bajo umbral",
      detail:
        report.complianceScore == null
          ? "El checklist regulatorio todavía no tiene una evaluación calculada."
          : `Compliance interno ${report.complianceScore}% < umbral ${report.complianceThreshold}%.`,
      dataReady,
      reviewerReady,
      sectionsReady,
      complianceReady,
      snapshotReady,
      requiredSections,
      signedRequiredSections,
    };
  }

  if (!snapshotReady) {
    return {
      status: "snapshot_required",
      label: "Snapshot versionado requerido",
      detail:
        "La evidencia puede pasar a control de emisión, pero falta una versión inmutable con hash SHA-256.",
      dataReady,
      reviewerReady,
      sectionsReady,
      complianceReady,
      snapshotReady,
      requiredSections,
      signedRequiredSections,
    };
  }

  return {
    status: "controlled_release_candidate",
    label: "Candidato a emisión controlada",
    detail:
      "Los gates internos están completos. Esto no equivale por sí solo a cumplimiento NI 43-101/JORC ni sustituye la responsabilidad del QP/CP.",
    dataReady,
    reviewerReady,
    sectionsReady,
    complianceReady,
    snapshotReady,
    requiredSections,
    signedRequiredSections,
  };
}
