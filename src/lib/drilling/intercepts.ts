import type { DrillCoreLog } from "@/hooks/useDrilling";

export type Intercept = {
  from: number;
  to: number;
  length: number;
  au_gpt: number | null;
  cu_pct: number | null;
  ag_gpt: number | null;
  intervals: number;
};

export const DEFAULT_AU_CUTOFF = 0.5;
export const DEFAULT_INTERNAL_DILUTION_M = 2;

/** length-weighted average of grade values, skipping nulls per element */
function lwAvg(items: { len: number; v: number | null }[]): number | null {
  let sumLen = 0;
  let sumProd = 0;
  for (const { len, v } of items) {
    if (v == null || !Number.isFinite(v)) continue;
    sumLen += len;
    sumProd += v * len;
  }
  return sumLen > 0 ? sumProd / sumLen : null;
}

function buildIntercept(group: DrillCoreLog[]): Intercept {
  const from = group[0].depth_from;
  const to = group[group.length - 1].depth_to;
  const items = group.map((l) => ({ len: l.depth_to - l.depth_from }));
  return {
    from,
    to,
    length: to - from,
    au_gpt: lwAvg(group.map((l, i) => ({ len: items[i].len, v: l.au_gpt }))),
    cu_pct: lwAvg(group.map((l, i) => ({ len: items[i].len, v: l.cu_pct }))),
    ag_gpt: lwAvg(group.map((l, i) => ({ len: items[i].len, v: l.ag_gpt }))),
    intervals: group.length,
  };
}

/**
 * Detect contiguous mineralized intercepts where au_gpt >= cutoff,
 * allowing internal dilution gaps ≤ maxInternalDilution meters.
 */
export function computeIntercepts(
  logs: DrillCoreLog[],
  cutoff = DEFAULT_AU_CUTOFF,
  maxInternalDilution = DEFAULT_INTERNAL_DILUTION_M,
): Intercept[] {
  if (!logs.length) return [];
  const sorted = [...logs].sort((a, b) => a.depth_from - b.depth_from);
  const result: Intercept[] = [];
  let group: DrillCoreLog[] = [];

  const flush = () => {
    if (group.length) {
      result.push(buildIntercept(group));
      group = [];
    }
  };

  for (const l of sorted) {
    const isOre = (l.au_gpt ?? 0) >= cutoff;
    if (!isOre) {
      flush();
      continue;
    }
    if (group.length === 0) {
      group.push(l);
    } else {
      const last = group[group.length - 1];
      const gap = l.depth_from - last.depth_to;
      if (gap <= maxInternalDilution) {
        group.push(l);
      } else {
        flush();
        group.push(l);
      }
    }
  }
  flush();
  return result;
}

/** Pick best intercept by grade·length (Au-equivalent metal score). */
export function bestIntercept(intercepts: Intercept[]): Intercept | null {
  if (!intercepts.length) return null;
  let best = intercepts[0];
  let bestScore = (best.au_gpt ?? 0) * best.length;
  for (let i = 1; i < intercepts.length; i++) {
    const it = intercepts[i];
    const s = (it.au_gpt ?? 0) * it.length;
    if (s > bestScore) {
      best = it;
      bestScore = s;
    }
  }
  return best;
}

export function formatIntercept(it: Intercept): string {
  const au = it.au_gpt != null ? it.au_gpt.toFixed(2) : "—";
  return `${it.length.toFixed(2)}m @ ${au} g/t Au`;
}

/** Au-equivalent metal score: g/t × m (a.k.a. GT). */
export function interceptScore(it: Intercept): number {
  return (it.au_gpt ?? 0) * it.length;
}

export type HaloStyle = { color: string; radius: number; label: string };

/** Map a grade·length score (g·m/t) to a halo color + radius. Returns null if score ≤ 0. */
export function scoreToHaloStyle(score: number): HaloStyle | null {
  if (!Number.isFinite(score) || score <= 0) return null;
  let color = "#86efac";
  let label = "bajo";
  if (score > 150) {
    color = "#dc2626";
    label = "excepcional";
  } else if (score > 50) {
    color = "#fb923c";
    label = "alto";
  } else if (score > 20) {
    color = "#fbbf24";
    label = "bueno";
  } else if (score > 5) {
    color = "#bef264";
    label = "moderado";
  }
  const radius = 12 + Math.min(score / 10, 18);
  return { color, radius, label };
}
