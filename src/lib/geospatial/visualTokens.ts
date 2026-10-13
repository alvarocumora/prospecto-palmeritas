/** Semantic cartographic colors. CSS tokens are the authority; fallback values support SSR. */
const fallback = {
  tenureOwn: "#f59e0b",
  tenureAnnex: "#d6a84f",
  tenureNeighbor: "#94a3b8",
  terrainLow: "#5b6a52",
  terrainMid: "#a3906b",
  terrainHigh: "#e7e2d6",
  terrainEvidenceLow: "#52634b",
  terrainEvidenceHigh: "#d5c4a5",
  sceneBackground: "#f5f2eb",
  signal: "#22b8cf",
  drill: "#e5e7eb",
  clay: "#0ea5e9",
  hydrothermal: "#d946ef",
  ironOxide: "#f97316",
  lineament: "#eab308",
  measured: "#0369a1",
  declared: "#64748b",
  certified: "#15803d",
  conceptual: "#a16207",
  context: "#b45309",
  outline: "#0b0a09",
  contrast: "#ffffff",
  proposedDrill: "#1f6feb",
  sampleOutline: "#052e16",
  sample: "#22c55e",
  pedimento: "#b98a2f",
  pending: "#7c3aed",
  deposit: "#dc2626",
  depositOutline: "#7f1d1d",
  structure: "#facc15",
  geochemistry: "#c2410c",
  markerOutline: "#475569",
  markerFill: "#e2e8f0",
  pendingEvidence: "#a78bfa",
  proposedEvidence: "#fb923c",
  drillEvidence: "#4d7cff",
  geology: "#38bdf8",
  fallback: "#cbd5e1",
  neighbourDeposit: "#ef4444",
} as const;
export const geoColors = Object.fromEntries(
  Object.entries(fallback).map(([name, value]) => [name, value]),
) as Record<keyof typeof fallback, string>;
for (const name of Object.keys(fallback) as Array<keyof typeof fallback>)
  Object.defineProperty(geoColors, name, {
    get: () =>
      typeof document === "undefined"
        ? fallback[name]
        : getComputedStyle(document.documentElement)
            .getPropertyValue("--geo-" + name)
            .trim() || fallback[name],
  });
