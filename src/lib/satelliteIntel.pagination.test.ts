import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStacFeatures } from "./satelliteIntel.functions";

const STAC_URL = "https://example-stac.invalid";

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("fetchStacFeatures", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sigue un único rel=next (POST con merge) hasta juntar el targetCount", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          features: [{ id: "scene-1" }],
          links: [
            {
              rel: "next",
              href: `${STAC_URL}/search`,
              method: "POST",
              merge: true,
              body: { token: "page2" },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ features: [{ id: "scene-2" }], links: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchStacFeatures(STAC_URL, { collections: ["sentinel-2-l2a"] }, 10);

    expect(result.error).toBeNull();
    expect(result.features).toEqual([{ id: "scene-1" }, { id: "scene-2" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    expect(secondCallBody).toEqual({ collections: ["sentinel-2-l2a"], token: "page2" });
  });

  it("se detiene al alcanzar targetCount aunque haya más páginas", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        features: [{ id: "a" }, { id: "b" }],
        links: [{ rel: "next", href: `${STAC_URL}/search?page=2` }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchStacFeatures(STAC_URL, { collections: ["sentinel-2-l2a"] }, 2);

    expect(result.features).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no sigue más de MAX_STAC_PAGES páginas aunque el servidor siga ofreciendo next", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        features: [{ id: "x" }],
        links: [{ rel: "next", href: `${STAC_URL}/search?page=next` }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchStacFeatures(STAC_URL, { collections: ["sentinel-2-l2a"] }, 1_000);

    expect(result.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(result.features).toHaveLength(10);
  });

  it("degrada sin perder lo ya juntado si una página falla después de la primera", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          features: [{ id: "scene-1" }],
          links: [{ rel: "next", href: `${STAC_URL}/search?page=2` }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({}, false));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchStacFeatures(STAC_URL, { collections: ["sentinel-2-l2a"] }, 10);

    expect(result.error).toBeNull();
    expect(result.features).toEqual([{ id: "scene-1" }]);
  });

  it("reporta error cuando la primera página falla y no hay nada juntado", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({}, false));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchStacFeatures(STAC_URL, { collections: ["sentinel-2-l2a"] }, 10);

    expect(result.features).toEqual([]);
    expect(result.error).toContain("STAC search failed");
  });
});
