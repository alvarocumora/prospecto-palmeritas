import { describe, expect, it } from "vitest";
import {
  LEGACY_VIEWER_REGISTRY,
  deletableLegacyViewers,
  legacyViewersByStatus,
} from "./legacyViewerRegistry";

describe("legacy viewer retirement registry", () => {
  it("moves migrated Cholqui and Los Verdes PUBLIC viewers out of public compatibility", () => {
    // /live/cholqui y /live/losverdes ya migraron al stack canónico — esos dos
    // viewers dejan de ser necesarios para el parity público.
    const publicViewers = legacyViewersByStatus("public_compatibility");
    expect(publicViewers.map((viewer) => viewer.id)).not.toContain("cholqui-master-viewer");
    expect(publicViewers.map((viewer) => viewer.id)).not.toContain("losverdes-strategic-map");
  });

  it("records actual retirement after the report and terminal migrations", () => {
    const retired = legacyViewersByStatus("retired").map((viewer) => viewer.id);
    expect(retired).toEqual(
      expect.arrayContaining([
        "losverdes-public-scene",
        "losverdes-strategic-map",
        "losverdes-engine3d",
      ]),
    );
    const active = legacyViewersByStatus("active_compatibility").map((viewer) => viewer.id);
    expect(active).toContain("project-master-viewer");
    expect(active).toContain("cholqui-master-viewer");
    expect(active).toContain("cholqui-terrain-3d");
  });

  it("does not mark a viewer deletable while a parity blocker remains", () => {
    expect(deletableLegacyViewers()).toHaveLength(0);
  });

  it("marks the legacy Operations 3D renderer as reference-only after filter parity", () => {
    const map3d = LEGACY_VIEWER_REGISTRY.find((viewer) => viewer.id === "map-3d-view");
    expect(map3d?.status).toBe("reference_only");
    expect(map3d?.successor).toBe("GeoScene3D");
    expect(map3d?.blocker).toContain("Actions CI");
  });
});
