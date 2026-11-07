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

/** Commodities disponibles para colorear intervalos de sondaje por ley.
 * `mo_ppm` no está acá: drill_core_logs no tiene esa columna todavía. */
export type DownholeCommodity = "au_gpt" | "cu_pct";

const HIGH_GRADE_THRESHOLD: Record<DownholeCommodity, number> = {
  au_gpt: 1, // g/t
  cu_pct: 1, // %, coincide con el corte superior de la rampa Cu de sampleGradeStyle
};

export function sceneInterceptPassesGrade(
  value: number | null | undefined,
  highGradeOnly: boolean | null | undefined,
  commodity: DownholeCommodity = "au_gpt",
): boolean {
  return !highGradeOnly || Number(value ?? 0) >= HIGH_GRADE_THRESHOLD[commodity];
}

export function sceneFilterManifest(filters?: GeoSceneFilters): string {
  return JSON.stringify({
    campaignId: filters?.campaignId ?? null,
    timeCursor: filters?.timeCursor ?? null,
    highGradeOnly: Boolean(filters?.highGradeOnly),
  });
}
