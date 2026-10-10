import { beforeEach, describe, expect, it, vi } from "vitest";
const { fromUrl } = vi.hoisted(() => ({ fromUrl: vi.fn() }));
vi.mock("geotiff", () => ({ fromUrl }));
import { fetchCopernicusDem } from "./dem.functions";

function sourceImage(lng: number, value: number) {
  return {
    getGeoKeys: () => ({ GeographicTypeGeoKey: 4326, GTRasterTypeGeoKey: 1 }),
    getOrigin: () => [lng, -33, 0],
    getResolution: () => [0.01, -0.01, 0],
    getWidth: () => 100,
    getHeight: () => 100,
    getGDALNoData: () => -32767,
    readRasters: vi.fn(async ({ window }: { window: number[] }) => [
      new Float32Array((window[2] - window[0]) * (window[3] - window[1])).fill(value),
    ]),
  };
}

describe("Copernicus DEM mosaic", () => {
  beforeEach(() => { fromUrl.mockReset(); });

  it("keeps both sides of Cholqui's degree boundary in their correct grid positions", async () => {
    fromUrl.mockImplementation(async (url: string) => ({
      getImage: async () => (url.includes("W072") ? sourceImage(-72, 100) : sourceImage(-71, 200)),
    }));
    const tile = await fetchCopernicusDem(-33.8543, -71.043, 65, 14000);
    expect(fromUrl).toHaveBeenCalledTimes(2);
    expect(tile?.centerElevationM).toBe(100);
    expect(tile?.heights[32 * 65]).toBe(0);
    expect(tile?.heights[32 * 65 + 64]).toBe(100);
    expect(tile?.heights).toHaveLength(65 * 65);
  });

  it("requires every source tile instead of stretching the available part", async () => {
    fromUrl.mockImplementation(async (url: string) => {
      if (url.includes("W071")) throw new Error("tile unavailable");
      return { getImage: async () => sourceImage(-72, 100) };
    });
    expect(await fetchCopernicusDem(-33.8543, -71.043, 65, 14000)).toBeNull();
  });

  it("rejects NoData rather than converting it into real relief", async () => {
    fromUrl.mockResolvedValue({ getImage: async () => sourceImage(-72, -32767) });
    expect(await fetchCopernicusDem(-33.8543, -71.043, 65, 1000)).toBeNull();
  });

  it("preserves valid zero elevations", async () => {
    fromUrl.mockResolvedValue({ getImage: async () => sourceImage(-72, 0) });
    const tile = await fetchCopernicusDem(-33.8543, -71.043, 65, 1000);
    expect(tile?.centerElevationM).toBe(0);
    expect(tile?.source).toBe("copernicus");
  });
});
