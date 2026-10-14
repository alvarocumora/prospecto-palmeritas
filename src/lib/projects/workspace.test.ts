import { describe, expect, it } from "vitest";
import { canEnterPath, type AccessContext } from "@/lib/access/workspaceAccess";
import { moduleForRoute } from "@/lib/modules";
import {
  PROJECT_WORKSPACE_SECTIONS,
  publishedTerminalDestination,
  projectWorkspaceLegacyPath,
  projectWorkspacePath,
  projectWorkspaceSection,
} from "./workspace";
import { projectNavigationHref, workspaceProjectId } from "./navigation";

const first = "e5360f13-1647-4e44-bb13-c0614e6f39fe";
const second = "7a499b02-ecdf-447b-8956-b106fe4ec087";
const viewer: AccessContext = {
  isSuperAdmin: false,
  accountType: "mining_owner",
  unrestricted: false,
  modules: ["catastro"],
  projectRole: "viewer",
  hasProjects: true,
};

describe("canonical project workspace", () => {
  it("resolves the path before a conflicting search selection and rejects invalid routes", () => {
    expect(workspaceProjectId(projectWorkspacePath(second, "model"), first)).toBe(second);
    expect(() => projectWorkspacePath("cholqui", "overview")).toThrow();
    expect(projectWorkspaceSection("unknown")).toBeNull();
  });

  it("switches the UUID while retaining section, filters and anchor", () => {
    expect(
      projectNavigationHref(
        projectWorkspacePath(first, "model"),
        `?project=${first}&view=3d&layer=targets`,
        "#layers",
        second,
      ),
    ).toBe(`/projects/${second}/model?view=3d&layer=targets#layers`);
  });

  it("routes published map and target screens to their canonical terminal views", () => {
    expect(publishedTerminalDestination(second, "targets")).toEqual({
      slug: "losverdes",
      tab: "mapa",
      view: "2d",
    });
    expect(publishedTerminalDestination(second, "model")).toEqual({
      slug: "losverdes",
      tab: "mapa",
      view: "3d",
    });
    expect(publishedTerminalDestination(second, "validation")).toBeNull();
  });

  it("keeps projects without a published terminal in the private workspace", () => {
    expect(
      publishedTerminalDestination("00000000-0000-0000-0000-000000000000", "targets"),
    ).toBeNull();
  });

  it("keeps the migrated section's module and role policy", () => {
    for (const section of PROJECT_WORKSPACE_SECTIONS) {
      const path = projectWorkspacePath(first, section.id);
      expect(projectWorkspaceLegacyPath(path)).toBe(section.legacyPath);
      expect(moduleForRoute(path)).toBe(moduleForRoute(section.legacyPath));
      expect(canEnterPath(path, viewer)).toEqual(canEnterPath(section.legacyPath, viewer));
    }
  });

  it("does not grant a viewer access to QA/QC through a canonical URL", () => {
    expect(canEnterPath(projectWorkspacePath(first, "validation"), viewer)).toEqual({
      allowed: false,
      reason: { kind: "capability", capability: "qaqc" },
    });
    expect(canEnterPath(projectWorkspacePath(first, "targets"), viewer).allowed).toBe(true);
  });

  it("preserves plan restrictions and investor exclusions on technical sections", () => {
    expect(
      canEnterPath(projectWorkspacePath(first, "targets"), { ...viewer, modules: [] }),
    ).toEqual({ allowed: false, reason: { kind: "plan", module: "catastro" } });
    expect(
      canEnterPath(projectWorkspacePath(first, "exploration"), {
        ...viewer,
        accountType: "investor",
      }),
    ).toEqual({ allowed: false, reason: { kind: "investor" } });
  });
});
