import { describe, expect, it } from "vitest";
import { calculateFusionScore } from "./scoring";

describe("calculateFusionScore", () => {
  it("calculates a weighted fusion score", () => {
    expect(
      calculateFusionScore({
        geophysics: 80,
        geochemistry: 60,
        structural: 70,
        satellite: 50,
        drilling: 40,
      })
    ).toEqual({
      score: 63,
      confidence: "medium",
      drivers: ["Geophysics (80)", "Structural control (70)", "Geochemistry (60)"],
    });
  });

  it("returns high confidence when score and signal diversity are strong", () => {
    expect(
      calculateFusionScore({
        geophysics: 90,
        geochemistry: 85,
        structural: 75,
        satellite: 70,
        drilling: 65,
      })
    ).toEqual({
      score: 79,
      confidence: "high",
      drivers: [
        "Geophysics (90)",
        "Geochemistry (85)",
        "Structural control (75)",
        "Satellite alteration (70)",
        "Drilling evidence (65)",
      ],
    });
  });

  it("returns low confidence for weak or sparse evidence", () => {
    expect(
      calculateFusionScore({
        geophysics: 80,
        geochemistry: 10,
        structural: 15,
        satellite: 10,
        drilling: 0,
      }).confidence
    ).toBe("low");
  });

  it("clamps invalid and out-of-range values", () => {
    expect(
      calculateFusionScore({
        geophysics: 200,
        geochemistry: -10,
        structural: Number.NaN,
        satellite: 50,
        drilling: 100,
      }).score
    ).toBe(48);
  });

  it("normalizes custom weights", () => {
    expect(
      calculateFusionScore(
        {
          geophysics: 100,
          geochemistry: 0,
          structural: 0,
          satellite: 0,
          drilling: 0,
        },
        {
          geophysics: 10,
          geochemistry: 0,
          structural: 0,
          satellite: 0,
          drilling: 0,
        }
      ).score
    ).toBe(100);
  });
});
