import { describe, expect, it } from "vitest";
import { PUBLIC_INTELLIGENCE_PATHS } from "./landingNavigation";

describe("GeoCapitals public intelligence navigation", () => {
  it("routes to topic-level entry points without preselecting a mining project", () => {
    expect(PUBLIC_INTELLIGENCE_PATHS).toEqual({
      geologicalLayers: "/catastro/mapa",
      satelliteImagery: "/satelital",
      dataAnalysis: "/terminal",
      projectEvaluation: "/proyectos",
    });
    expect(
      Object.values(PUBLIC_INTELLIGENCE_PATHS).every(
        (path) => !path.includes("cholqui") && !path.includes("losverdes"),
      ),
    ).toBe(true);
  });

  it("keeps unique destinations for the four intelligence promises", () => {
    expect(new Set(Object.values(PUBLIC_INTELLIGENCE_PATHS)).size).toBe(4);
  });
});
