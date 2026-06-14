import type { ArExplorationSource } from "@/types/ar";
import type { ExplorationTarget } from "@/hooks/useExplorationTargets";

export function targetsToArSources(targets: ExplorationTarget[]): ArExplorationSource[] {
  return targets
    .filter(
      (t): t is ExplorationTarget & { lat: number; lng: number } => t.lat != null && t.lng != null,
    )
    .map((t) => ({
      id: t.id,
      type: "target",
      label: t.name || t.code,
      lat: t.lat,
      lng: t.lng,
      elevationM: t.elevation_m ?? null,
      confidence: t.confidence_pct ?? null,
      intensity: t.score ?? null,
      metadata: { priority: t.priority, stage: t.stage, commodity: t.commodity },
    }));
}
