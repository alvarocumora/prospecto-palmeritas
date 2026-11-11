import { describe, expect, it } from "vitest";
import { terminalTabForProject, terminalTabsForProject } from "./terminalProjects";

describe("secciones del terminal por proyecto", () => {
  it("expone explotación solo en Cholqui", () => {
    expect(terminalTabsForProject("cholqui").map(({ key }) => key)).toContain("explotacion");
    expect(terminalTabForProject("explotacion", "cholqui")).toBe("explotacion");
    expect(terminalTabsForProject("losverdes").map(({ key }) => key)).not.toContain("explotacion");
    expect(terminalTabForProject("explotacion", "losverdes")).toBe("mapa");
  });

  it("mantiene los enlaces históricos y el acceso a satelital y documentos", () => {
    expect(terminalTabForProject("tesis", "cholqui")).toBe("simulador");
    expect(terminalTabForProject("satelital", "losverdes")).toBe("satelital");
    expect(terminalTabForProject("dataroom", "palmeras")).toBe("dataroom");
  });
});
