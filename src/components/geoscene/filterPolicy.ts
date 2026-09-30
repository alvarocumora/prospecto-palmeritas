import type { GeoSceneFilters } from "./types";

export function sceneHolePassesTime(
  startedAt: string | null | undefined,
  timeCursor: number | null | undefined,
): boolean {
  if (timeCursor == null) return true;
  if (!startedAt) return false;
  const started = Date.parse(startedAt);
  return Number.isFinite(started) && started <= timeCursor;
}

export function sceneTargetPassesCampaign(
  campaignId: string | null | undefined,
  selectedCampaignId: string | null | undefined,
): boolean {
  return !selectedCampaignId || campaignId === selectedCampaignId;
}

export function sceneInterceptPassesGrade(
  auGpt: number | null | undefined,
  highGradeOnly: boolean | null | undefined,
): boolean {
  return !highGradeOnly || Number(auGpt ?? 0) >= 1;
}

export function sceneFilterManifest(filters?: GeoSceneFilters): string {
  return JSON.stringify({
    campaignId: filters?.campaignId ?? null,
    timeCursor: filters?.timeCursor ?? null,
    highGradeOnly: Boolean(filters?.highGradeOnly),
  });
}
