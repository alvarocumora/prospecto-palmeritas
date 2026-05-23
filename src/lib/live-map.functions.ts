import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyLiveMapPasswordAgainstEnv } from "@/lib/live-map.server";

function buildVerifier(envVar: string) {
  return createServerFn({ method: "POST" })
    .inputValidator((input) => z.object({ password: z.string().min(1).max(200) }).parse(input))
    .handler(async ({ data }) => verifyLiveMapPasswordAgainstEnv(envVar, data.password));
}

export const verifyLiveMapPassword = buildVerifier("LIVE_MAP_PASSWORD");
export const verifyFrancoLiveMapPassword = buildVerifier("LIVE_MAP_FRANCO_PASSWORD");
export const verifyLosVerdesLiveMapPassword = buildVerifier("LIVE_MAP_LOSVERDES_PASSWORD");
