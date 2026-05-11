import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGeophysicsData } from "./geophysics.service";

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
  const promise = Promise.resolve(result);
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    or: vi.fn(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };

  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.or.mockReturnValue(query);

  return query;
}

describe("fetchGeophysicsData", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns normalized geophysics data from Supabase tables", async () => {
    const surveys = [{ id: "s1", project_id: null, name: "IP Survey", display_order: 1 }];
    const lines = [{ id: "l1", project_id: null, line_id: "L-001", is_synthetic: true }];
    const stations = [{ id: "st1", project_id: null, station_id: "ST-001", lat: -33.9, lng: -71.1 }];

    fromMock
      .mockReturnValueOnce(queryResult({ data: surveys, error: null }))
      .mockReturnValueOnce(queryResult({ data: lines, error: null }))
      .mockReturnValueOnce(queryResult({ data: stations, error: null }));

    await expect(fetchGeophysicsData()).resolves.toEqual({
      surveys,
      lines,
      stations,
    });

    expect(fromMock).toHaveBeenCalledTimes(3);
    expect(fromMock).toHaveBeenNthCalledWith(1, "geophysics_surveys");
    expect(fromMock).toHaveBeenNthCalledWith(2, "geophysics_lines");
    expect(fromMock).toHaveBeenNthCalledWith(3, "geophysics_stations");
  });

  it("applies project filter when projectId is provided", async () => {
    const surveyQuery = queryResult({ data: [], error: null });
    const lineQuery = queryResult({ data: [], error: null });
    const stationQuery = queryResult({ data: [], error: null });

    fromMock.mockReturnValueOnce(surveyQuery).mockReturnValueOnce(lineQuery).mockReturnValueOnce(stationQuery);

    await fetchGeophysicsData("project-1");

    expect(surveyQuery.or).toHaveBeenCalledWith("project_id.eq.project-1,project_id.is.null");
    expect(lineQuery.or).toHaveBeenCalledWith("project_id.eq.project-1,project_id.is.null");
    expect(stationQuery.or).toHaveBeenCalledWith("project_id.eq.project-1,project_id.is.null");
  });

  it("throws the first Supabase error", async () => {
    const expectedError = new Error("geophysics unavailable");

    fromMock
      .mockReturnValueOnce(queryResult({ data: null, error: expectedError }))
      .mockReturnValueOnce(queryResult({ data: [], error: null }))
      .mockReturnValueOnce(queryResult({ data: [], error: null }));

    await expect(fetchGeophysicsData()).rejects.toThrow("geophysics unavailable");
  });
});
