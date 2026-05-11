import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGeologyData } from "./geology.service";

const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

type QueryResult = {
  data: unknown[] | null;
  error: Error | null;
};

function queryResult(result: QueryResult) {
  return {
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue(result),
    }),
  };
}

describe("fetchGeologyData", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns normalized geology data from Supabase tables", async () => {
    const lithology = [{ id: "l1", unit_code: "LV", name: "Lo Valle", display_order: 1 }];
    const alteration = [{ id: "a1", zone_code: "ARG", name: "Argillic", display_order: 1 }];
    const minerals = [{ id: "m1", mineral: "Chalcopyrite", display_order: 1 }];
    const features = [{ id: "f1", feature_code: "V1", name: "Main Vein", feature_type: "vein" }];
    const references = [{ id: "r1", citation_key: "ref-1", title: "Regional geology" }];

    fromMock
      .mockReturnValueOnce(queryResult({ data: lithology, error: null }))
      .mockReturnValueOnce(queryResult({ data: alteration, error: null }))
      .mockReturnValueOnce(queryResult({ data: minerals, error: null }))
      .mockReturnValueOnce(queryResult({ data: features, error: null }))
      .mockReturnValueOnce(queryResult({ data: references, error: null }));

    await expect(fetchGeologyData()).resolves.toEqual({
      litho: lithology,
      alteration,
      minerals,
      features,
      references,
    });

    expect(fromMock).toHaveBeenCalledTimes(5);
    expect(fromMock).toHaveBeenNthCalledWith(1, "lithology_units");
    expect(fromMock).toHaveBeenNthCalledWith(2, "alteration_zones");
    expect(fromMock).toHaveBeenNthCalledWith(3, "mineralogy");
    expect(fromMock).toHaveBeenNthCalledWith(4, "geological_features");
    expect(fromMock).toHaveBeenNthCalledWith(5, "geo_references");
  });

  it("throws the first Supabase error", async () => {
    const expectedError = new Error("database unavailable");

    fromMock
      .mockReturnValueOnce(queryResult({ data: null, error: expectedError }))
      .mockReturnValueOnce(queryResult({ data: [], error: null }))
      .mockReturnValueOnce(queryResult({ data: [], error: null }))
      .mockReturnValueOnce(queryResult({ data: [], error: null }))
      .mockReturnValueOnce(queryResult({ data: [], error: null }));

    await expect(fetchGeologyData()).rejects.toThrow("database unavailable");
  });
});
