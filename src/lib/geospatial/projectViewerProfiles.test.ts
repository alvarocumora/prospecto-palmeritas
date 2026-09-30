import { describe, expect, it } from "vitest";
import {
  findProjectForProfile,
  getProjectViewerProfile,
  projectMatchesProfile,
  resolveProjectViewerProfile,
} from "./projectViewerProfiles";

describe("project viewer profiles", () => {
  const projects = [
    { id: "a", code: "CHOLQUI", name: "Proyecto Cholqui" },
    { id: "b", code: "TRK-ALH-001", name: "Prospecto Palmeras" },
    { id: "c", code: "LV5", name: "Los Verdes 5" },
  ];

  it("resolves the three project families without route-specific viewer logic", () => {
    expect(resolveProjectViewerProfile(projects[0])?.key).toBe("cholqui");
    expect(resolveProjectViewerProfile(projects[1])?.key).toBe("palmeras");
    expect(resolveProjectViewerProfile(projects[2])?.key).toBe("losverdes");
  });

  it("treats Toki 2 as a Cholqui field preset, not another project", () => {
    const toki = getProjectViewerProfile("toki2");
    expect(toki.parentKey).toBe("cholqui");
    expect(toki.twoD).toBe("toki2_field");
    expect(projectMatchesProfile(projects[0], "toki2")).toBe(true);
  });

  it("finds the database project that must be bound before rendering canonical viewers", () => {
    expect(findProjectForProfile(projects, "palmeras")?.id).toBe("b");
    expect(findProjectForProfile(projects, "losverdes")?.id).toBe("c");
  });
});
