import type {
  Geology3DStructure,
  GeologyStructureBounds,
  GeologyVertex,
  Vec3,
} from "@/types/geology3d";

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

export function calculateStructureBounds(vertices: GeologyVertex[]): GeologyStructureBounds {
  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  const zs = vertices.map((v) => v.z);

  const min = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    z: Math.min(...zs),
  };

  const max = {
    x: Math.max(...xs),
    y: Math.max(...ys),
    z: Math.max(...zs),
  };

  return {
    min,
    max,
    width: max.x - min.x,
    height: max.y - min.y,
    depth: max.z - min.z,
  };
}

export function calculateStructureCentroid(vertices: GeologyVertex[]): Vec3 {
  return {
    x: average(vertices.map((v) => v.x)),
    y: average(vertices.map((v) => v.y)),
    z: average(vertices.map((v) => v.z)),
  };
}

export function estimateStructureStrike(vertices: GeologyVertex[]): number | null {
  if (vertices.length < 2) return null;
  const first = vertices[0];
  const last = vertices[vertices.length - 1];

  const dx = last.x - first.x;
  const dy = last.y - first.y;

  const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
  return (angle + 360) % 360;
}

export function normalizeDepth(depthM: number) {
  return Math.max(0, depthM);
}

export function structureToSceneObject(structure: Geology3DStructure) {
  const centroid = calculateStructureCentroid(structure.vertices);
  const bounds = calculateStructureBounds(structure.vertices);

  return {
    id: structure.id,
    type: structure.type,
    name: structure.name,
    centroid,
    bounds,
    color: structure.color ?? "#cccccc",
    opacity: structure.opacity ?? 0.7,
    strikeDeg:
      structure.strikeDeg ?? estimateStructureStrike(structure.vertices),
    dipDeg: structure.dipDeg ?? null,
    depthFromM:
      structure.depthFromM != null ? normalizeDepth(structure.depthFromM) : null,
    depthToM:
      structure.depthToM != null ? normalizeDepth(structure.depthToM) : null,
  };
}
