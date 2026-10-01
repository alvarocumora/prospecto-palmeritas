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

  it("no marca reference_only (retirado) lo que sigue siendo el renderer real de una ruta viva", () => {
    // cholqui-master-viewer y losverdes-strategic-map NO están retirados: siguen
    // siendo el renderer 2D de /terminal/cholqui y /terminal/losverdes
    // (ProjectTerminalShell, sin auth gate) — una ruta distinta de /live/*, que
    // sí migró. Marcarlos reference_only invitaría a borrarlos pensando que ya
    // no se usan en ningún lado.
    const referenceViewers = legacyViewersByStatus("reference_only");
    const activeViewers = legacyViewersByStatus("active_compatibility");
    expect(referenceViewers.map((viewer) => viewer.id)).not.toContain("cholqui-master-viewer");
    expect(referenceViewers.map((viewer) => viewer.id)).not.toContain("losverdes-strategic-map");
    expect(activeViewers.map((viewer) => viewer.id)).toContain("cholqui-master-viewer");
    expect(activeViewers.map((viewer) => viewer.id)).toContain("losverdes-strategic-map");
    expect(activeViewers.map((viewer) => viewer.id)).toContain("project-master-viewer");
    expect(activeViewers.map((viewer) => viewer.id)).toContain("satellite-map-viewer");
  });

  it("losverdes-public-scene (sin importers) sí queda reference_only — retiro real", () => {
    const referenceViewers = legacyViewersByStatus("reference_only");
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
