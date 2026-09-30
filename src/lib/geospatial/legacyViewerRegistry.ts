export type LegacyViewerStatus =
  | "qa_only"
  | "public_compatibility"
  | "active_compatibility"
  | "reference_only";

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
    status: "public_compatibility",
    successor: "ProjectMap + Canonical Geospatial Layer Registry",
    uniqueCapability: "Static/public GeoJSON adapter used by Cholqui live",
    blocker: "Anonymous/public data parity before Cholqui live can use the canonical adapter",
  },
  {
    id: "cholqui-master-viewer",
    path: "src/features/franco/components/CholquiMasterViewer.tsx",
    status: "public_compatibility",
    successor: "CanonicalProjectViewer(profile=cholqui)",
    uniqueCapability: "Bundles current public Cholqui static catastro, assays and structures",
    blocker: "Public RLS/server adapter for the same canonical domain data",
  },
  {
    id: "satellite-map-viewer",
    path: "src/components/satellite/SatelliteMapViewer.tsx",
    status: "reference_only",
    successor: "ProjectMap canonical remote_sensing layers",
    uniqueCapability: "InSAR, hyperspectral and DEM-diff presentation patterns",
    blocker: "Verify every product is exposed as a canonical layer before file removal",
  },
  {
    id: "geology-3d-viewer",
    path: "src/components/Geology3DViewer.tsx",
    status: "qa_only",
    successor: "GeoScene3D",
    uniqueCapability: "Historical Three.js comparison renderer",
    blocker: "Keep only while explicit legacy QA switch exists",
  },
  {
    id: "sat-to-subsurface-3d",
    path: "src/components/geology3d/SatToSubsurface3DViewer.tsx",
    status: "qa_only",
    successor: "GeoScene3D subsurface mode",
    uniqueCapability: "Legacy conceptual satellite-to-subsurface heuristics",
    blocker: "Do not promote heuristic bodies without traceable interpreted/proposed evidence",
  },
  {
    id: "map-3d-view",
    path: "src/components/map/Map3DView.tsx",
    status: "active_compatibility",
    successor: "GeoScene3D",
    uniqueCapability: "Receives route-filtered holes/logs/targets directly",
    blocker: "Port campaign/time-filter semantics before replacing the Operations 3D toggle",
  },
  {
    id: "lv5-page5-preview",
    path: "src/features/lv5/Lv5Page5Preview.tsx",
    status: "reference_only",
    successor: "CanonicalProjectViewer(profile=losverdes)",
    uniqueCapability: "Historical LV5 lithostratigraphic presentation",
    blocker: "Retain as reference until its unique explanatory overlays are either migrated or archived",
  },
  {
    id: "losverdes-strategic-map",
    path: "src/components/live/LosVerdesStrategicMap.tsx",
    status: "public_compatibility",
    successor: "Future public canonical adapter",
    uniqueCapability: "Anonymous public layers plus certification/filter UX",
    blocker: "Public anonymous dataset contract and RLS parity",
  },
  {
    id: "losverdes-public-scene",
    path: "src/components/live/LosVerdesPublicScene.tsx",
    status: "public_compatibility",
    successor: "Future public GeoScene3D adapter",
    uniqueCapability: "Anonymous public 3D scene",
    blocker: "Public 3D dataset contract and anonymous access parity",
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
