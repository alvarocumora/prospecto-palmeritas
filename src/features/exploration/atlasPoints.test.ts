import { describe, expect, it } from "vitest";
import { validAtlasCentroid } from "./atlasPoints";

describe("validAtlasCentroid", () => {
  it("preserves WGS84 longitude/latitude order", () => {
    expect(validAtlasCentroid([-71.03, -33.84])).toEqual([-71.03, -33.84]);
  });

  it("rejects missing or invalid geographic coordinates", () => {
    expect(validAtlasCentroid(null)).toBeNull();
    expect(validAtlasCentroid([NaN, -33])).toBeNull();
    expect(validAtlasCentroid([181, -33])).toBeNull();
    expect(validAtlasCentroid([-71, -91])).toBeNull();
  });
});
