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

function buildVerifier(envVar: string) {
  return createServerFn({ method: "POST" })
    .inputValidator((input) =>
      z.object({ password: z.string().min(1).max(200) }).parse(input),
    )
    .handler(async ({ data }) => {
      const expected = process.env[envVar];
      if (!expected) {
        return { ok: false as const, error: "Live map no configurado." };
      }
      const ok = constantTimeEqual(data.password, expected);
      if (!ok) {
        return { ok: false as const, error: "Contraseña incorrecta." };
      }
      const secret = process.env.LIVE_MAP_SESSION_SECRET ?? "fallback-secret";
      const token = Buffer.from(`${secret}:${expected.length}:${Date.now()}`)
        .toString("base64url")
        .slice(0, 48);
      return { ok: true as const, token, cookieName: SESSION_COOKIE };
    });
}

export const verifyLiveMapPassword = buildVerifier("LIVE_MAP_PASSWORD");
export const verifyFrancoLiveMapPassword = buildVerifier("LIVE_MAP_FRANCO_PASSWORD");
