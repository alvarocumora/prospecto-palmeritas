import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMiningConcessions } from "./miningConcessions.service";

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
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: Promise.resolve(result).then.bind(Promise.resolve(result)),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);

  return query;
}

describe("fetchMiningConcessions", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns an empty list when projectId is missing", async () => {
    await expect(fetchMiningConcessions(null)).resolves.toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns mining concessions for a project", async () => {
    const rows = [{ id: "c1", project_id: "project-1", code: "EXP-001", name: "Concesión 1" }];
    const query = queryResult({ data: rows, error: null });
    fromMock.mockReturnValueOnce(query);

    await expect(fetchMiningConcessions("project-1")).resolves.toEqual(rows);

    expect(fromMock).toHaveBeenCalledWith("mining_concessions");
    expect(query.eq).toHaveBeenCalledWith("project_id", "project-1");
    expect(query.order).toHaveBeenCalledWith("expires_at", { ascending: true, nullsFirst: false });
  });

  it("throws Supabase errors", async () => {
    fromMock.mockReturnValueOnce(
      queryResult({ data: null, error: new Error("concessions unavailable") }),
    );

    await expect(fetchMiningConcessions("project-1")).rejects.toThrow("concessions unavailable");
  });
});
