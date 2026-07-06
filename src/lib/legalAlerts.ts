// Consolidación de alertas legales de un proyecto en un solo feed accionable.
//
// La plataforma genera alertas en tres pipelines distintos que hasta ahora
// vivían en pestañas separadas:
//   - Boletín Oficial de Minería  (bulletin_alerts, match_type holder/aoi/…)
//   - Remates por patente impaga  (bulletin_alerts, match_type "remate" — ronda 28)
//   - Causas judiciales PJUD       (court_case_alerts)
// mergeLegalAlerts() las normaliza a un tipo común, las clasifica por severidad
// (remate → crítico, PJUD → advertencia, boletín → informativo) y las ordena
// dejando primero lo no leído y lo más grave.

export type LegalAlertKind = "remate" | "boletin" | "pjud";
export type LegalAlertSeverity = "critical" | "warning" | "info";

/** Forma estructural mínima de una alerta de boletín con su publicación. */
export type BulletinAlertInput = {
  id: string;
  match_type: string;
  match_detail: string | null;
  is_read: boolean;
  created_at: string;
  bulletin?: {
    publication_type: string;
    concession_name: string | null;
    concession_code: string | null;
    holder_name: string | null;
    holder_rut: string | null;
    comuna: string | null;
    region: string | null;
    source_url: string | null;
    raw_payload?: Record<string, unknown> | null;
  } | null;
};

/** Forma estructural mínima de una alerta PJUD con su causa. */
export type CourtAlertInput = {
  id: string;
  match_type: string;
  match_detail: string | null;
  is_read: boolean;
  created_at: string;
  case?: {
    case_number: string | null;
    court: string | null;
    matter: string | null;
    defendant: string | null;
    defendant_rut: string | null;
    comuna: string | null;
    region: string | null;
    source_url: string | null;
  } | null;
};

export type LegalAlert = {
  key: string;
  source: "bulletin" | "court";
  alertId: string;
  kind: LegalAlertKind;
  severity: LegalAlertSeverity;
  isRead: boolean;
  createdAt: string;
  badge: string;
  title: string;
  code: string | null;
  holder: string | null;
  location: string | null;
  detail: string | null;
  amountClp: number | null;
  year: number | null;
  sourceUrl: string | null;
};

const SEVERITY_RANK: Record<LegalAlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    // Montos/años enteros: se descartan separadores de miles (punto chileno) y
    // cualquier símbolo, conservando solo dígitos (y el signo).
    const cleaned = v.replace(/[^\d-]/g, "");
    if (!cleaned || cleaned === "-") return null;
    const n = parseInt(cleaned, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function joinLocation(comuna: string | null, region: string | null): string | null {
  return [comuna, region].filter(Boolean).join(", ") || null;
}

function bulletinBadge(matchType: string): string {
  switch (matchType) {
    case "remate":
      return "Remate";
    case "aoi":
      return "AOI";
    case "holder_rut":
      return "RUT";
    default:
      return "Titular";
  }
}

function mapBulletin(a: BulletinAlertInput): LegalAlert {
  const b = a.bulletin ?? null;
  const isRemate = a.match_type === "remate" || b?.publication_type === "remate";
  const payload = b?.raw_payload ?? null;
  return {
    key: `bulletin:${a.id}`,
    source: "bulletin",
    alertId: a.id,
    kind: isRemate ? "remate" : "boletin",
    severity: isRemate ? "critical" : "info",
    isRead: a.is_read,
    createdAt: a.created_at,
    badge: bulletinBadge(a.match_type),
    title: b?.concession_name ?? b?.concession_code ?? "Concesión",
    code: b?.concession_code ?? null,
    holder: b?.holder_name ?? b?.holder_rut ?? null,
    location: joinLocation(b?.comuna ?? null, b?.region ?? null),
    detail: a.match_detail,
    amountClp: isRemate && payload ? num(payload.amount_clp) : null,
    year: isRemate && payload ? num(payload.year) : null,
    sourceUrl: b?.source_url ?? null,
  };
}

function mapCourt(a: CourtAlertInput): LegalAlert {
  const c = a.case ?? null;
  return {
    key: `court:${a.id}`,
    source: "court",
    alertId: a.id,
    kind: "pjud",
    severity: "warning",
    isRead: a.is_read,
    createdAt: a.created_at,
    badge: a.match_type === "defendant_rut" ? "RUT demandado" : "Demandado",
    title: c?.defendant ?? c?.case_number ?? "Causa judicial",
    code: c?.case_number ?? null,
    holder: c?.defendant_rut ?? null,
    location: joinLocation(c?.comuna ?? null, c?.region ?? null),
    detail: a.match_detail ?? c?.matter ?? null,
    amountClp: null,
    year: null,
    sourceUrl: c?.source_url ?? null,
  };
}

/**
 * Une y ordena las alertas de boletín/remate y PJUD en un feed único.
 * Orden: no leídas primero, luego por severidad, luego por fecha descendente.
 */
export function mergeLegalAlerts(
  bulletins: BulletinAlertInput[],
  courts: CourtAlertInput[],
): LegalAlert[] {
  const merged = [...bulletins.map(mapBulletin), ...courts.map(mapCourt)];
  return merged.sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export type LegalAlertsSummary = {
  total: number;
  unread: number;
  remate: number;
  boletin: number;
  pjud: number;
};

/** Conteos por tipo y no leídas, para las tarjetas de resumen. */
export function summarizeLegalAlerts(alerts: LegalAlert[]): LegalAlertsSummary {
  return {
    total: alerts.length,
    unread: alerts.filter((a) => !a.isRead).length,
    remate: alerts.filter((a) => a.kind === "remate").length,
    boletin: alerts.filter((a) => a.kind === "boletin").length,
    pjud: alerts.filter((a) => a.kind === "pjud").length,
  };
}
