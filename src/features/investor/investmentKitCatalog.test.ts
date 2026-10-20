import { describe, expect, it } from "vitest";
import { INVESTOR_KIT_CATALOGUE, publicKitItems } from "./investmentKitCatalog";

describe("investment kit discovery", () => {
  it("does not expose download urls or confidential assets in its public metadata", () => {
    expect(INVESTOR_KIT_CATALOGUE).toHaveLength(7);
    for (const item of INVESTOR_KIT_CATALOGUE) {
      expect(item).not.toHaveProperty("downloadUrl");
      expect(item).not.toHaveProperty("storagePath");
      expect(item.title.length).toBeGreaterThan(4);
    }
  });

  it("permits direct navigation only to existing public terminal tabs", () => {
    const tabs = new Set(["mapa", "tesis", "simulador", "dataroom"]);
    for (const item of publicKitItems()) {
      expect(item.access).toBe("public_page");
      expect(tabs.has(item.tab)).toBe(true);
    }
  });

  it("never assigns public tab links to confidential or transaction documents", () => {
    const privateItems = INVESTOR_KIT_CATALOGUE.filter((item) => item.access !== "public_page");
    expect(privateItems).toHaveLength(4);
    expect(privateItems.every((item) => !item.tab)).toBe(true);
    expect(INVESTOR_KIT_CATALOGUE.find((item) => item.id === "statement")?.access)
      .toBe("ticket_owner_only");
  });
});
