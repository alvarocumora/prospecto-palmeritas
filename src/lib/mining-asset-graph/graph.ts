import type {
  MiningAssetEdge,
  MiningAssetNode,
  MiningAssetNodeType,
  MiningProvenance,
} from "./types";

export const canonicalAssetKey = (
  type: MiningAssetNodeType,
  parts: Array<string | number | null | undefined>,
) =>
  [
    type,
    ...parts
      .map((p) =>
        String(p ?? "")
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean),
  ].join(":");

export function validateGraph(nodes: MiningAssetNode[], edges: MiningAssetEdge[]) {
  const ids = new Set(nodes.map((n) => n.id));
  const keys = new Set<string>();
  const errors: string[] = [];
  for (const n of nodes) {
    const key = `${n.projectId}|${n.nodeType}|${n.canonicalKey}`;
    if (keys.has(key)) errors.push(`DUPLICATE_NODE_KEY:${key}`);
    keys.add(key);
    if (n.confidence != null && (n.confidence < 0 || n.confidence > 1))
      errors.push(`INVALID_CONFIDENCE:${n.id}`);
  }
  for (const e of edges) {
    if (!ids.has(e.fromNodeId)) errors.push(`MISSING_FROM_NODE:${e.id}`);
    if (!ids.has(e.toNodeId)) errors.push(`MISSING_TO_NODE:${e.id}`);
    if (e.fromNodeId === e.toNodeId) errors.push(`SELF_EDGE:${e.id}`);
  }
  return { valid: errors.length === 0, errors };
}

export const relationProvenance = (
  relation: string,
  provenance: MiningProvenance,
  confidence: number | null = null,
) => ({ relation, provenance, confidence });
