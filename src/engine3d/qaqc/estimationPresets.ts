// Estimation Presets — Sprint 4
// Persistencia de escenarios de estimación + parámetros extendidos (anisotropía, density by lithology).

import type { BlockModelParams } from "@/engine3d/hooks/useBlockModel";

export type AnisotropyRatios = {
  rx: number; // 1 = isotrópico
  ry: number;
  rz: number;
};

export type DensityByLithology = Record<string, number>;

export type EstimationSettings = {
  idwPower: number;
  searchRadius: number;
  minSamples: number;
  maxSamples: number;
  cutoff: number;
  anisotropy: AnisotropyRatios;
  densityByLithology: DensityByLithology;
  defaultDensity: number;
};

export const DEFAULT_ESTIMATION: EstimationSettings = {
  idwPower: 2,
  searchRadius: 150,
  minSamples: 3,
  maxSamples: 12,
  cutoff: 0.5,
  anisotropy: { rx: 1, ry: 1, rz: 1 },
  densityByLithology: { ox: 2.4, sx: 2.7, sf: 3.1, fr: 2.8 },
  defaultDensity: 2.7,
};

export type EstimationPreset = {
  id: string;
  name: string;
  createdAt: number;
  settings: EstimationSettings;
};

const STORAGE_KEY = "engine3d.estimation.presets.v1";

export function listPresets(): EstimationPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as EstimationPreset[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function savePreset(name: string, settings: EstimationSettings): EstimationPreset {
  const preset: EstimationPreset = {
    id: `pre_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    createdAt: Date.now(),
    settings,
  };
  const list = [...listPresets(), preset];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-50)));
  }
  return preset;
}

export function deletePreset(id: string) {
  const list = listPresets().filter((p) => p.id !== id);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
}

/** Aplica estimation settings sobre BlockModelParams existentes (partial overlay). */
export function applyEstimation(
  base: BlockModelParams,
  est: EstimationSettings,
): BlockModelParams {
  return {
    ...base,
    power: est.idwPower,
    searchRadius: est.searchRadius,
    minSamples: est.minSamples,
    maxSamples: est.maxSamples,
    density: est.defaultDensity,
  };
}
