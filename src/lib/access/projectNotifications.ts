/**
 * Autorización de envíos por proyecto. Estas reglas son independientes de la UI:
 * tener acceso de lectura a un proyecto no otorga permiso de invitar terceros
 * ni de difundir reportes técnicos a direcciones arbitrarias.
 */
export function mayNotifyProject(role: unknown, isSuperAdmin = false): boolean {
  return isSuperAdmin === true || role === "owner" || role === "admin";
}

/** Nunca reenvíes enlaces de invitaciones anuladas, aceptadas o expiradas. */
export function isActiveProjectInvitation(
  status: unknown,
  expiresAt: unknown,
  now = new Date(),
): boolean {
  if (status !== "pending" || typeof expiresAt !== "string") return false;
  const expiration = Date.parse(expiresAt);
  return Number.isFinite(expiration) && expiration > now.getTime();
}

/** Sólo avisar por un documento efectivamente firmado y fechado. */
export function isSignedTechnicalReport(status: unknown, signatureDate: unknown): boolean {
  return (
    (status === "signed" || status === "published" || status === "filed") &&
    typeof signatureDate === "string" &&
    Number.isFinite(Date.parse(signatureDate))
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Los destinatarios de un aviso técnico deben estar en la nómina del proyecto.
 * Una lista personalizada jamás convierte un tercero en lector autorizado.
 * Devuelve un conjunto deduplicado y acotado, o falla cerrado.
 */
export function resolveProjectNotificationRecipients(
  requested: string[] | undefined,
  projectEmails: string[],
): string[] {
  const allowed = new Set(projectEmails.filter(Boolean).map(normalizeEmail));
  const normalized = (requested ?? projectEmails).filter(Boolean).map(normalizeEmail);
  const recipients = [...new Set(normalized)];

  if (
    recipients.length === 0 ||
    recipients.length > 50 ||
    recipients.some((email) => !allowed.has(email))
  ) {
    throw new Error("Destinatarios no autorizados para este proyecto.");
  }
  return recipients;
}
