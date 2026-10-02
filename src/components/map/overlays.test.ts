import { describe, expect, it } from "vitest";
import { catastroQueryUrl } from "./overlays";
import { SNGM_CONCESIONES_URL } from "@/lib/sngm";

describe("catastroQueryUrl", () => {
  it("builds against the canonical SNGM concesiones layer, not a hardcoded copy", () => {
    const url = catastroQueryUrl({ minLng: -70.7, minLat: -33.5, maxLng: -70.6, maxLat: -33.4 });
    expect(url.startsWith(`${SNGM_CONCESIONES_URL}/query?`)).toBe(true);
  });

  it("filters to constituidas and requests the 4-origen field set", () => {
    const url = catastroQueryUrl({ minLng: -70.7, minLat: -33.5, maxLng: -70.6, maxLat: -33.4 });
    const params = new URL(url).searchParams;
    expect(params.get("where")).toBe("ID_SITUACION_CONCESION in (1,3)");
    expect(params.get("outFields")).toContain("ORIGEN");
    expect(params.get("f")).toBe("geojson");
  });
});
