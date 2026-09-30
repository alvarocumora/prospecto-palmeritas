import { describe, expect, it } from "vitest";
import {
  LEGACY_VIEWER_REGISTRY,
  deletableLegacyViewers,
  legacyViewersByStatus,
} from "./legacyViewerRegistry";

describe("legacy viewer retirement registry", () => {
  it("moves migrated Cholqui and Los Verdes viewers out of active public compatibility", () => {
    const publicViewers = legacyViewersByStatus("public_compatibility");
    const referenceViewers = legacyViewersByStatus("reference_only");
    expect(publicViewers.map((viewer) => viewer.id)).not.toContain("cholqui-master-viewer");
    expect(publicViewers.map((viewer) => viewer.id)).not.toContain("losverdes-strategic-map");
    expect(referenceViewers.map((viewer) => viewer.id)).toContain("cholqui-master-viewer");
    expect(referenceViewers.map((viewer) => viewer.id)).toContain("losverdes-strategic-map");
    expect(referenceViewers.map((viewer) => viewer.id)).toContain("losverdes-public-scene");
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
