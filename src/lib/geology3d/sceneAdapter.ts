import type { Geology3DStructure, GeologyVertex } from "@/types/geology3d";
import { calculateStructureBounds, calculateStructureCentroid } from "./structures";

export type SceneGeometryVertex = [number, number, number];

export type SceneStructureObject = {
  id: string;
  type: Geology3DStructure["type"];
  name: string;
  color: string;
  opacity: number;
  centroid: SceneGeometryVertex;
  bounds: ReturnType<typeof calculateStructureBounds>;
  vertices: SceneGeometryVertex[];
  metadata?: Record<string, unknown>;
};

function vertexToTuple(vertex: GeologyVertex): SceneGeometryVertex {
  return [vertex.x, vertex.y, vertex.z];
}

export function structureToSceneGeometry(structure: Geology3DStructure): SceneStructureObject {
  const centroid = calculateStructureCentroid(structure.vertices);
  const bounds = calculateStructureBounds(structure.vertices);

  return {
    id: structure.id,
    type: structure.type,
    name: structure.name,
    color: structure.color ?? "#cccccc",
    opacity: structure.opacity ?? 0.75,
    centroid: [centroid.x, centroid.y, centroid.z],
    bounds,
    vertices: structure.vertices.map(vertexToTuple),
    metadata: structure.metadata,
  };
}

export function structuresToScene(structures: Geology3DStructure[]) {
  return structures.map(structureToSceneGeometry);
}
