import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { timingSafeEqual } from "crypto";

const SESSION_COOKIE = "live_map_session";

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const verifyLiveMapPassword = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        password: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const expected = process.env.LIVE_MAP_PASSWORD;
    if (!expected) {
      return { ok: false, error: "Live map no configurado." };
    }
    const ok = constantTimeEqual(data.password, expected);
    if (!ok) {
      return { ok: false, error: "Contraseña incorrecta." };
    }
    // Return an opaque token derived from the session secret + password length
    // — clients store it in sessionStorage. Server re-validates on each visit.
    const secret = process.env.LIVE_MAP_SESSION_SECRET ?? "fallback-secret";
    const token = Buffer.from(`${secret}:${expected.length}:${Date.now()}`)
      .toString("base64url")
      .slice(0, 48);
    return { ok: true, token, cookieName: SESSION_COOKIE };
  });
