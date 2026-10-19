export type LegacyViewerStatus =
  "retired" | "qa_only" | "public_compatibility" | "active_compatibility" | "reference_only";

export type LegacyViewerRecord = {
  id: string;
  path: string;
  status: LegacyViewerStatus;
  successor: string;
  uniqueCapability: string | null;
  blocker: string | null;
};

export const LEGACY_VIEWER_REGISTRY: readonly LegacyViewerRecord[] = [
  {
    id: "project-master-viewer",
    path: "src/components/geo/ProjectMasterViewer.tsx",
    status: "active_compatibility",
    successor: "ProjectMasterViewer + ProjectTerrain3D",
    uniqueCapability:
      "Grouped/collapsible evidence legend with per-section caution notes — no canonical equivalent yet. The IDW intensity-surface layer itself was ported to the canonical stack (remote_sensing.anomaly_intensity in PublicCanonicalMap); this entry's remaining gap is the legend UX, not the surface.",
    blocker: null,
  },
  {
    id: "cholqui-master-viewer",
    path: "src/features/franco/components/CholquiMasterViewer.tsx",
    status: "active_compatibility",
    successor: "ProjectMasterViewer + ProjectTerrain3D",
    uniqueCapability: "Historical all-in-one Cholqui public renderer",
    blocker: null,
  },
  {
    id: "satellite-map-viewer",
    path: "src/components/satellite/SatelliteMapViewer.tsx",
    status: "active_compatibility",
    successor: "ProjectMasterViewer context layers",
    uniqueCapability: "InSAR, hyperspectral and DEM-diff presentation patterns",
    blocker: null,
  },
  {
    id: "geology-3d-viewer",
    path: "src/components/Geology3DViewer.tsx",
    status: "retired",
    successor: "GeoScene3D",
    uniqueCapability: "Historical Three.js comparison renderer",
    blocker: "Keep only while explicit legacy QA switch exists",
  },
  {
    id: "sat-to-subsurface-3d",
    path: "src/components/geology3d/SatToSubsurface3DViewer.tsx",
    status: "retired",
    successor: "GeoScene3D subsurface mode",
    uniqueCapability: "Legacy conceptual satellite-to-subsurface heuristics",
    blocker: "Do not promote heuristic bodies without traceable interpreted/proposed evidence",
  },
  {
    id: "map-3d-view",
    path: "src/components/map/Map3DView.tsx",
    status: "retired",
    successor: "GeoScene3D",
    uniqueCapability: "Historical props-based Operations 3D renderer",
    blocker: "Keep for one QA window until Actions CI can validate the canonical replacement",
  },
  {
    id: "lv5-page5-preview",
    path: "src/features/lv5/Lv5Page5Preview.tsx",
    status: "retired",
    successor: "CanonicalProjectViewer(profile=losverdes)",
    uniqueCapability: "Historical LV5 lithostratigraphic presentation",
    blocker:
      "Retain as reference until its unique explanatory overlays are either migrated or archived",
  },
  {
    id: "losverdes-strategic-map",
    path: "src/components/live/LosVerdesStrategicMap.tsx",
    status: "retired",
    successor: "ProjectMasterViewer + ProjectTerrain3D",
    uniqueCapability: "Historical Los Verdes MapLibre presentation",
    blocker: null,
  },
  {
    id: "losverdes-public-scene",
    path: "src/components/live/LosVerdesPublicScene.tsx",
    status: "retired",
    successor: "ProjectMasterViewer + ProjectTerrain3D",
    uniqueCapability: "Historical Los Verdes public deck.gl scene",
    blocker: null,
  },
  {
    id: "losverdes-engine3d",
    path: "src/engine3d/LosVerdesEngine3D.tsx",
    status: "retired",
    successor: "ProjectMasterViewer + ProjectTerrain3D",
    uniqueCapability:
      "react-three-fiber cinematic 3D report renderer (terrain, DEM worker, custom camera/lighting) for the Pre-43-101 report shell",
    blocker: null,
  },
  {
    id: "cholqui-terrain-3d",
    path: "src/features/franco/components/CholquiTerrain3D.tsx",
    status: "active_compatibility",
    successor: "ProjectMasterViewer + ProjectTerrain3D",
    uniqueCapability: "react-three-fiber Cholqui terrain renderer for the terminal 3D tab",
    blocker: null,
  },
];

export function legacyViewersByStatus(status: LegacyViewerStatus): LegacyViewerRecord[] {
  return LEGACY_VIEWER_REGISTRY.filter((viewer) => viewer.status === status);
}

export function deletableLegacyViewers(): LegacyViewerRecord[] {
  return LEGACY_VIEWER_REGISTRY.filter(
    (viewer) => viewer.status === "reference_only" && viewer.blocker == null,
  );
}
