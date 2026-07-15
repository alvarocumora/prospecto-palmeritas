import { describe, expect, it } from "vitest";
import { PUBLIC_JOURNEYS, PUBLIC_PRIMARY_NAV, getPublicJourney } from "./publicJourney";

describe("public journey model", () => {
  it("defines the three supported public intents", () => {
    expect(Object.keys(PUBLIC_JOURNEYS)).toEqual(["investor", "owner", "advisor"]);
  });

  it("keeps investor discovery and signup destinations aligned", () => {
    const journey = getPublicJourney("investor");

    expect(journey.primaryHref).toBe("/oportunidades");
    expect(journey.authSearch).toEqual({ intent: "investor", mode: "signup" });
    expect(journey.steps.some((step) => step.href.includes("intent=investor"))).toBe(true);
  });

  it("sends project owners through owner-aware signup", () => {
    const journey = getPublicJourney("owner");

    expect(journey.primaryHref).toContain("intent=owner");
    expect(journey.authSearch.intent).toBe("owner");
  });

  it("exposes a single ordered primary navigation model", () => {
    expect(PUBLIC_PRIMARY_NAV.map((item) => item.href)).toEqual([
      "/oportunidades",
      "/marketplace",
      "/terminal",
      "/catastro/global",
      "/recursos",
    ]);
  });
});
