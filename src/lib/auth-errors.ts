// Diccionario ES de errores Supabase Auth + helpers de fortaleza de contraseña.

const MAP: Array<{ match: RegExp; msg: string; code?: string }> = [
  { match: /invalid login credentials/i, msg: "Email o contraseña incorrectos." },
  {
    match: /email not confirmed/i,
    msg: "Tu email aún no está confirmado. Revisa tu bandeja o reenvía el correo.",
    code: "email_not_confirmed",
  },
  { match: /user already registered/i, msg: "Ya existe una cuenta con este email. Inicia sesión." },
  { match: /password should be at least/i, msg: "La contraseña no cumple los requisitos mínimos." },
  { match: /weak.?password|pwned/i, msg: "Contraseña detectada en filtraciones públicas. Elige otra." },
  { match: /rate ?limit|too many requests/i, msg: "Demasiados intentos. Espera unos minutos." },
  { match: /signup.+disabled/i, msg: "El registro está temporalmente deshabilitado." },
  { match: /network|fetch failed|load failed/i, msg: "Sin conexión. Reintenta en unos segundos." },
  { match: /invalid email/i, msg: "Email no válido." },
  { match: /token has expired|expired/i, msg: "El enlace expiró. Solicita uno nuevo." },
];

export function translateAuthError(err: unknown): { message: string; code?: string } {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!raw) return { message: "Error de autenticación." };
  for (const { match, msg, code } of MAP) if (match.test(raw)) return { message: msg, code };
  return { message: raw };
}

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  checks: { len: boolean; upper: boolean; lower: boolean; digit: boolean; symbol: boolean };
};

export function evaluatePassword(pw: string): PasswordStrength {
  const checks = {
    len: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  let score: PasswordStrength["score"] = 0;
  if (passed >= 5 && pw.length >= 12) score = 4;
  else if (passed >= 4) score = 3;
  else if (passed >= 3) score = 2;
  else if (passed >= 2) score = 1;
  const label = ["Muy débil", "Débil", "Aceptable", "Fuerte", "Excelente"][score];
  return { score, label, checks };
}
