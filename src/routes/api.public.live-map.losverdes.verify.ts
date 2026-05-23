import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyLiveMapPasswordAgainstEnv } from "@/lib/live-map.server";

const VerifySchema = z.object({
  password: z.string().min(1).max(200),
});

export const Route = createFileRoute("/api/public/live-map/losverdes/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = VerifySchema.parse(await request.json());
          return Response.json(
            verifyLiveMapPasswordAgainstEnv("LIVE_MAP_LOSVERDES_PASSWORD", body.password),
          );
        } catch {
          return Response.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
        }
      },
    },
  },
});