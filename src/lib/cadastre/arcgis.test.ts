import { afterEach, describe, expect, it, vi } from "vitest";
import { arcgisQueryAttributes } from "./arcgis";
const options = { where: "1=1", outFields: "*", limit: 25 };
afterEach(() => vi.unstubAllGlobals());
describe("ArcGIS source availability", () => {
  it("keeps a successful empty query distinct from an unavailable source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) }),
    );
    expect(await arcgisQueryAttributes("https://example.test/layer", options)).toEqual([]);
  });
  it("propagates HTTP failure instead of reporting zero concessions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(arcgisQueryAttributes("https://example.test/layer", options)).rejects.toThrow(
      "CADASTRE_SOURCE_HTTP_503",
    );
  });
  it("rejects ArcGIS error payloads delivered with HTTP 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: { code: 400 } }) }),
    );
    await expect(arcgisQueryAttributes("https://example.test/layer", options)).rejects.toThrow(
      "CADASTRE_SOURCE_QUERY_FAILED",
    );
  });
  it("rejects malformed payloads rather than interpreting them as empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    await expect(arcgisQueryAttributes("https://example.test/layer", options)).rejects.toThrow(
      "CADASTRE_SOURCE_INVALID_RESPONSE",
    );
  });
});
