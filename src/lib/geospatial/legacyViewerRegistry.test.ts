import { describe, expect, it } from "vitest";
import {
  LEGACY_VIEWER_REGISTRY,
  deletableLegacyViewers,
  legacyViewersByStatus,
} from "./legacyViewerRegistry";

describe("legacy viewer retirement registry", () => {
  it("keeps public compatibility viewers explicit instead of treating them as canonical", () => {
    const publicViewers = legacyViewersByStatus("public_compatibility");
    expect(publicViewers.map((viewer) => viewer.id)).toContain("cholqui-master-viewer");
    expect(publicViewers.map((viewer) => viewer.id)).toContain("losverdes-strategic-map");
  });

  it("does not mark a viewer deletable while a parity blocker remains", () => {
    expect(deletableLegacyViewers()).toHaveLength(0);
  });

  it("documents the operations 3D filter-parity blocker", () => {
    const map3d = LEGACY_VIEWER_REGISTRY.find((viewer) => viewer.id === "map-3d-view");
    expect(map3d?.status).toBe("active_compatibility");
    expect(map3d?.blocker).toContain("campaign/time-filter");
  });
});
