// URL pública canónica para compartir links (firma, invitaciones, etc.).
// Siempre usa el dominio geocapitals.com — nunca lovable.app — para que
// todo lo que se copie/pegue tenga marca Geocapitals.

export const PUBLIC_APP_URL = "https://geocapitals.com";

export function publicUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${PUBLIC_APP_URL}${p}`;
}
