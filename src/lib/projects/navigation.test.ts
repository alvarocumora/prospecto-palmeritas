import { describe, expect, it } from "vitest";
import {
  findSatelliteProject,
  projectIdFromSearch,
  privateProjectSearch,
  projectView,
  projectNavigationHref,
  satelliteSelection,
  satelliteTerminalRedirect,
  workspaceProjectId,
} from "./navigation";

const first = "e5360f13-1647-4e44-bb13-c0614e6f39fe";
const second = "7a499b02-ecdf-447b-8956-b106fe4ec087";

describe("project navigation", () => {
  it("keeps database UUIDs in the satellite viewer instead of redirecting to the catalog", () => {
    expect(satelliteTerminalRedirect({ project: first })).toBeNull();
    expect(findSatelliteProject([{ id: first }, { id: second }], second)?.id).toBe(second);
  });

  it("never substitutes another asset for an unavailable explicit project", () => {
    expect(findSatelliteProject([{ id: first }], second)).toBeNull();
    expect(findSatelliteProject([{ id: first }])?.id).toBe(first);
  });

  it("resolves a selected published alias to its database UUID without guessing a name", () => {
    expect(findSatelliteProject([{ id: first }, { id: second }], "tilama")?.id).toBe(second);
  });

  it("opens legacy slug links in 3D", () => {
    expect(satelliteTerminalRedirect({ project: "tilama" })).toEqual({
      slug: "losverdes",
      search: { tab: "mapa", view: "3d" },
    });
  });

  it("preserves anomaly and InSAR selections in the satellite viewer", () => {
    const selection = satelliteSelection({ project: first, anomaly: "a", insar: "i" });
    expect(selection).toEqual({ project: first, anomaly: "a", insar: "i" });
    expect(satelliteTerminalRedirect({ project: "cholqui", anomaly: "a" })).toBeNull();
    expect(satelliteTerminalRedirect({ project: "cholqui", insar: "i" })).toBeNull();
  });

  it("rejects non-string selections and invalid private project identifiers", () => {
    expect(satelliteSelection({ project: [], anomaly: {}, insar: 1 })).toEqual({
      project: undefined,
      anomaly: undefined,
      insar: undefined,
    });
    expect(projectIdFromSearch("cholqui")).toBeUndefined();
    expect(projectIdFromSearch(first)).toBe(first);
  });

  it("rejects an invalid private URL instead of silently opening the stored project", () => {
    expect(() => privateProjectSearch({ project: "invalid" })).toThrow(
      "El identificador del proyecto no es válido.",
    );
    expect(privateProjectSearch({})).toEqual({ project: undefined });
  });

  it("makes a project URL authoritative over the stored project", () => {
    expect(workspaceProjectId(`/dashboard/projects/${second}`, first)).toBe(second);
    expect(workspaceProjectId("/dashboard/drilling", first)).toBe(first);
    expect(workspaceProjectId("/dashboard/projects/nuevo", undefined)).toBeUndefined();
  });

  it("changes project without losing module filters, 3D mode or the current anchor", () => {
    const href = projectNavigationHref(
      "/dashboard/project-report",
      `?project=${first}&view=3d&panel=satelite`,
      "evidence",
      second,
    );
    expect(href).toBe(
      `/dashboard/project-report?project=${second}&view=3d&panel=satelite#evidence`,
    );
  });

  it("normalizes the shareable 2D/3D mode", () => {
    expect(projectView("3d")).toBe("3d");
    expect(projectView("invalid")).toBe("2d");
  });
});
