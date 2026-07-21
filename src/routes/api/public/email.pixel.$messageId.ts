import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// GIF transparente de 1x1 (43 bytes).
const PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

async function hashIp(ip: string): Promise<string> {
  const enc = new TextEncoder().encode(ip);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function logOpen(messageId: string, request: Request) {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !key) return;
  const admin = createClient(url, key);
  const ua = request.headers.get("user-agent") ?? "";
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "";
  const ipHash = ip ? await hashIp(ip) : null;
  await admin.from("email_delivery_events").insert({
    message_id: messageId,
    event: "opened",
    user_agent: ua.slice(0, 500),
    ip_hash: ipHash,
    metadata: { source: "pixel" },
  });
}

function pixelResponse(): Response {
  return new Response(PIXEL, {
    status: 200,
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      pragma: "no-cache",
      "content-length": String(PIXEL.byteLength),
    },
  });
}

export const Route = createFileRoute("/api/public/email/pixel/$messageId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const raw = String(params.messageId ?? "").replace(/\.gif$/i, "");
          if (raw && /^[a-zA-Z0-9._-]{8,128}$/.test(raw)) {
            // No bloquear la respuesta del pixel por el insert.
            void logOpen(raw, request).catch(() => undefined);
          }
        } catch {
          // silencio: siempre devolver pixel para no romper la vista del correo.
        }
        return pixelResponse();
      },
    },
  },
});
