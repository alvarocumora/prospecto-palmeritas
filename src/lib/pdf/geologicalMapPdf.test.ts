import { describe, expect, it } from "vitest";
import { buildGeologicalMapPdf } from "./geologicalMapPdf";

describe("buildGeologicalMapPdf (smoke)", () => {
  it("builds a PDF blob without a carta oficial", async () => {
    const blob = await buildGeologicalMapPdf({
      projectName: "Cholqui",
      image: null,
      viewNote: "Vista de prueba",
      summary: {
        units: [],
        faultsCount: 0,
        structuresMeasured: 0,
        structuresWithDip: 0,
        sheets: [],
        gaps: ["Sin carta geológica vectorial oficial publicada para esta zona."],
      },
    });
    expect(blob.size).toBeGreaterThan(0);
  });

  it("builds a PDF blob with units and faults", async () => {
    const blob = await buildGeologicalMapPdf({
      projectName: "Los Verdes",
      image: null,
      viewNote: "Vista de prueba",
      summary: {
        units: [
          { code: "Km1a", nombre: "Formación Pelambres", edad: "Cretácico", litologia: "Andesita" },
        ],
        faultsCount: 3,
        structuresMeasured: 2,
        structuresWithDip: 1,
        sheets: ["SERNAGEOMIN · Carta Illapel (M431)"],
        gaps: [],
      },
    });
    expect(blob.size).toBeGreaterThan(0);
  });
});
