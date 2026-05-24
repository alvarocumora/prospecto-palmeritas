import { createServerFn } from "@tanstack/react-start";

export const testMiningEngine = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env.MINING_ENGINE_URL;
  const token = process.env.MINING_ENGINE_TOKEN;

  if (!url) return { ok: false, error: "MINING_ENGINE_URL no configurada" };

  const base = url.replace(/\/+$/, "");
  const results: Record<string, unknown> = { base };

  // 1) /health
  try {
    const r = await fetch(`${base}/health`, { method: "GET" });
    results.health = { status: r.status, body: await r.json() };
  } catch (e) {
    results.health = { error: String(e) };
  }

  // 2) /desurvey con auth
  try {
    const r = await fetch(`${base}/desurvey`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        collar_x: 0, collar_y: 0, collar_z: 100,
        shots: [
          { depth: 0, azimuth: 90, dip: -60 },
          { depth: 50, azimuth: 92, dip: -62 },
          { depth: 100, azimuth: 95, dip: -65 },
        ],
        step: 5,
      }),
    });
    const txt = await r.text();
    let body: unknown = txt;
    try { body = JSON.parse(txt); } catch {}
    results.desurvey = { status: r.status, body };
  } catch (e) {
    results.desurvey = { error: String(e) };
  }

  return { ok: true, ...results };
});
