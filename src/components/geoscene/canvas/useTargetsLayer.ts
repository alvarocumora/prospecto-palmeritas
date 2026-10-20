// Capa deck.gl: targets de exploración del proyecto activo.
// Registra cada target en el anchorRegistry para que el copilot pueda enfocarlo.
import { useEffect, useMemo } from "react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { useExplorationTargets } from "@/hooks/useExplorationTargets";
import { registerAnchors, type AnchorEntry } from "./anchorRegistry";
import type { GeoSceneFilters } from "../types";
import { sceneTargetPassesCampaign } from "../filterPolicy";

const PRIORITY_COLOR: Record<string, [number, number, number]> = {
  critical: [239, 68, 68],
  high: [249, 115, 22],
  medium: [234, 179, 8],
  low: [148, 163, 184],
};

export function useTargetsLayer(
  projectId: string | null,
  visible = true,
  filters?: GeoSceneFilters,
) {
  const { targets } = useExplorationTargets(projectId);

  const points = useMemo(
    () =>
      (targets ?? [])
        .filter(
          (target) =>
            target.lat != null &&
            target.lng != null &&
            sceneTargetPassesCampaign(target.campaign_id, filters?.campaignId),
        )
        .map((t) => ({
          code: t.code,
          name: t.name,
          lng: Number(t.lng),
          lat: Number(t.lat),
          score: Number(t.score ?? 0),
          priority: (t.priority ?? "medium").toLowerCase(),
        })),
    [targets, filters?.campaignId],
  );

  // Sincroniza el registro de anclajes.
  useEffect(() => {
    const entries: AnchorEntry[] = points.map((p) => ({
      kind: "target",
      code: p.code,
      lng: p.lng,
      lat: p.lat,
    }));
    return registerAnchors(entries);
  }, [points]);

  const layer = useMemo(
    () =>
      visible && points.length > 0
        ? new ScatterplotLayer({
            id: "targets.exploration",
            data: points,
            pickable: true,
            stroked: true,
            filled: true,
            // Mira técnica: radio en píxeles, relleno casi transparente, anillo nítido.
            radiusUnits: "pixels",
            radiusMinPixels: 5,
            radiusMaxPixels: 14,
            getPosition: (d: (typeof points)[number]) => [d.lng, d.lat],
            getRadius: (d: (typeof points)[number]) => 6 + Math.min(8, (d.score ?? 0) / 12),
            getFillColor: (d: (typeof points)[number]) => [
              ...(PRIORITY_COLOR[d.priority] ?? PRIORITY_COLOR.medium),
              40,
            ],
            getLineColor: (d: (typeof points)[number]) => [
              ...(PRIORITY_COLOR[d.priority] ?? PRIORITY_COLOR.medium),
              255,
            ],
            getLineWidth: 1.75,
            lineWidthUnits: "pixels",
          })
        : null,
    [points, visible],
  );

  return { layer, points };
}
