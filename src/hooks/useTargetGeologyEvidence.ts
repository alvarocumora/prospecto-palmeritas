import { useMemo } from "react";
import { useProjectGeologyMap } from "./useProjectGeologyMap";
import {
  buildTargetGeologyEvidence,
  type TargetGeologyEvidence,
} from "@/lib/targetContext/geologyEvidence";

export type TargetGeologyEvidenceResult = {
  data: TargetGeologyEvidence | null;
  loading: boolean;
  error: string | null;
};

export function useTargetGeologyEvidence(
  projectId: string | null,
  target: { lat: number | null; lng: number | null } | null,
  radiusM = 1500,
): TargetGeologyEvidenceResult {
  const geo = useProjectGeologyMap(projectId);

  const data = useMemo(() => {
    if (!geo.data) return null;
    if (!target || target.lat == null || target.lng == null) return null;
    return buildTargetGeologyEvidence({
      lat: target.lat,
      lng: target.lng,
      features: geo.data.features,
      lithology: geo.data.lithology,
      alteration: geo.data.alteration,
      radiusM,
    });
  }, [geo.data, target, radiusM]);

  return {
    data,
    loading: geo.isLoading,
    error: geo.error instanceof Error ? geo.error.message : null,
  };
}
