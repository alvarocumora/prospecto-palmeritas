export const SESSION_COOKIE = "live_map_session";

export type LiveMapVerifyResult =
  { ok: true; token: string; cookieName: string } | { ok: false; error: string };

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyLiveMapPasswordAgainstEnv(
  envVar: string,
  password: string,
): LiveMapVerifyResult {
  const expected = process.env[envVar];
  if (!expected) {
    return { ok: false, error: "Live map no configurado." };
  }

  const ok = constantTimeEqual(password, expected);
  if (!ok) {
    return { ok: false, error: "Contraseña incorrecta." };
  }

  const secret = process.env.LIVE_MAP_SESSION_SECRET ?? "fallback-secret";
  const token = Buffer.from(`${secret}:${expected.length}:${Date.now()}`)
    .toString("base64url")
    .slice(0, 48);

  return { ok: true, token, cookieName: SESSION_COOKIE };
}
