// Semáforo de certeza catastral (Chile).
// Regla legal: la prioridad la fija la FECHA DE INGRESO JUDICIAL (OJV / juzgado),
// no la publicación en el Boletín ni la aparición en SERNAGEOMIN. Un sector en
// blanco en SERNAGEOMIN puede tener una solicitud anterior pendiente.
// Resultado indicativo: no reemplaza estudio de títulos ni certificado del juzgado.

export type CertaintyLevel = "ocupado" | "riesgo_ojv" | "condicionado" | "libre_indicativo";

export type PriorClaim = {
  source: "sernageomin" | "boletin" | "ojv";
  label: string;
  /** Fecha de ingreso judicial (YYYY-MM-DD) si se conoce: define prelación. */
  filedAt: string | null;
  /** Fecha de publicación en Boletín: solo evidencia, no define prioridad. */
  publishedAt: string | null;
  distanceKm: number | null;
  url: string | null;
};

export type PriorityInput = {
  /** El punto cae dentro de una concesión digitalizada en SERNAGEOMIN. */
  sernageomin: { hit: boolean; label?: string | null } | null;
  bulletins: Array<{
    label: string;
    publishedAt: string | null;
    distanceKm: number | null;
    insideGeometry: boolean;
    url: string | null;
  }>;
  filings: Array<{
    label: string;
    filedAt: string | null;
    matter: string | null;
    url: string | null;
  }>;
  /** Fecha de ingreso propia planificada; las anteriores tienen preferencia. */
  ownFiledAt?: string | null;
  today: string; // YYYY-MM-DD
};

export const BULLETIN_RADIUS_KM = 5;
export const BULLETIN_WINDOW_DAYS = 180;
export const OJV_WINDOW_DAYS = 365;

const CONSTITUTION_RE = /pedimento|manifestaci|constituci|mensura/i;

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export type PriorityResult = {
  level: CertaintyLevel;
  reasons: string[];
  /** Solicitudes ordenadas por fecha de ingreso judicial (las sin fecha al final). */
  claims: PriorClaim[];
  /** Solicitudes con ingreso anterior a ownFiledAt (tienen preferencia). */
  senior: PriorClaim[];
};

export function evaluatePriority(input: PriorityInput): PriorityResult {
  const reasons: string[] = [];
  const claims: PriorClaim[] = [];

  if (input.sernageomin?.hit) {
    claims.push({
      source: "sernageomin",
      label: input.sernageomin.label ?? "Concesión digitalizada",
      filedAt: null,
      publishedAt: null,
      distanceKm: 0,
      url: null,
    });
  }

  const recentBulletins = input.bulletins.filter(
    (b) =>
      (b.insideGeometry || (b.distanceKm != null && b.distanceKm <= BULLETIN_RADIUS_KM)) &&
      (!b.publishedAt || daysBetween(b.publishedAt, input.today) <= BULLETIN_WINDOW_DAYS),
  );
  for (const b of recentBulletins) {
    claims.push({
      source: "boletin",
      label: b.label,
      filedAt: null,
      publishedAt: b.publishedAt,
      distanceKm: b.distanceKm,
      url: b.url,
    });
  }

  const recentFilings = input.filings.filter(
    (f) =>
      CONSTITUTION_RE.test(f.matter ?? "") &&
      (!f.filedAt || daysBetween(f.filedAt, input.today) <= OJV_WINDOW_DAYS),
  );
  for (const f of recentFilings) {
    claims.push({
      source: "ojv",
      label: f.label,
      filedAt: f.filedAt,
      publishedAt: null,
      distanceKm: null,
      url: f.url,
    });
  }

  claims.sort((a, b) => {
    if (a.filedAt && b.filedAt) return a.filedAt.localeCompare(b.filedAt);
    if (a.filedAt) return -1;
    if (b.filedAt) return 1;
    return 0;
  });

  const own = input.ownFiledAt ?? null;
  const senior = own
    ? claims.filter((c) => c.source === "ojv" && c.filedAt && c.filedAt < own)
    : [];

  let level: CertaintyLevel;
  if (input.sernageomin?.hit) {
    level = "ocupado";
    reasons.push("El sector tiene una concesión ya digitalizada en SERNAGEOMIN.");
  } else if (recentFilings.length > 0) {
    level = "riesgo_ojv";
    reasons.push(
      `Hay ${recentFilings.length} ingreso(s) judicial(es) de constitución en el tribunal competente que aún podrían no estar en SERNAGEOMIN.`,
    );
  } else if (recentBulletins.length > 0) {
    level = "condicionado";
    reasons.push(
      `Hay ${recentBulletins.length} publicación(es) en el Boletín dentro de ${BULLETIN_RADIUS_KM} km en los últimos ${BULLETIN_WINDOW_DAYS} días.`,
    );
  } else {
    level = "libre_indicativo";
    reasons.push(
      "Blanco en SERNAGEOMIN y sin publicaciones ni ingresos registrados en la plataforma. Confirmar en el juzgado: puede existir una solicitud anterior aún no publicada.",
    );
  }
  if (input.sernageomin == null) {
    reasons.push("No se pudo consultar SERNAGEOMIN; el resultado es incompleto.");
  }
  if (senior.length > 0) {
    reasons.push(`${senior.length} solicitud(es) ingresaron antes que la tuya y tienen preferencia.`);
  }
  return { level, reasons, claims, senior };
}

export const LEVEL_LABEL: Record<CertaintyLevel, string> = {
  ocupado: "Ocupado formal",
  riesgo_ojv: "Riesgo de prelación (OJV)",
  condicionado: "Vacancia condicionada (Boletín)",
  libre_indicativo: "Libre indicativo",
};
