import type { ExplorationTarget } from "@/hooks/useExplorationTargets";
import type { ArExplorationSource } from "@/types/ar";

export function targetsToArSources(targets: ExplorationTarget[]): ArExplorationSource[] {
  return targets
    .filter((target) => target.lat != null && target.lng != null)
    .map((target) => ({
      id: target.id,
      type: "target",
      label: `${target.code} · ${target.name}`,
      lat: Number(target.lat),
      lng: Number(target.lng),
      elevationM: target.elevation_m,
      confidence: target.confidence_pct,
      intensity: target.score,
      color: null,
      metadata: {
        priority: target.priority,
        stage: target.stage,
        commodity: target.commodity,
        targetType: target.target_type,
      },
    }));
}
