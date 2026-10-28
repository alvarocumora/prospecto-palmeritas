import { describe, it, expect } from "vitest";
import { chunk, mapWithConcurrency, verifyCronSecret } from "./ingest";

const req = (h?: string) =>
  new Request("http://x", { headers: h ? { "x-cron-secret": h } : {} });

describe("ingest helpers", () => {
  it("rejects missing or wrong cron secret", () => {
    expect(verifyCronSecret(req("abc"), "abc")).toBe(true);
    expect(verifyCronSecret(req("abd"), "abc")).toBe(false);
    expect(verifyCronSecret(req(), "abc")).toBe(false);
    expect(verifyCronSecret(req("abc"), undefined)).toBe(false);
  });

  it("chunks arrays", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("never exceeds the concurrency limit and keeps order", async () => {
    let active = 0;
    let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n * 10;
    });
    expect(peak).toBe(2);
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
  });
});
