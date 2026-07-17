// Base pública canónica para TODO link que se comparta, se firme, se envíe
// por email, se imprima en un PDF, o se use como canonical/og:url.
//
// Única fuente de verdad: cambiar aquí actualiza firmas, invitaciones,
// PDFs, previews sociales, ejemplos de curl y verificación NI 43-101.
// Nunca hardcodear "https://geocapitals.com" ni usar
// `window.location.origin` para links compartibles — siempre `publicUrl()`.

export const PUBLIC_APP_URL = "https://geocapitals.com";
export const PUBLIC_APP_HOST = "geocapitals.com";

export function publicUrl(path = "/"): string {
  if (!path) return PUBLIC_APP_URL;
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${PUBLIC_APP_URL}${p}`;
}

/** Link canónico para una solicitud de firma electrónica. */
export const signUrl = (token: string) => publicUrl(`/firmar/${token}`);

/** Link canónico para aceptar una invitación de equipo/proyecto. */
export const invitationUrl = (token: string) => publicUrl(`/invitations/${token}`);

/** Link canónico para verificación pública de cumplimiento NI 43-101. */
export const complianceVerifyUrl = (reportId: string) =>
  publicUrl(`/api/public/verify-compliance/${reportId}`);

/** Endpoint público para cron/webhooks. */
export const apiPublicUrl = (path: string) =>
  publicUrl(`/api/public/${path.replace(/^\//, "")}`);
