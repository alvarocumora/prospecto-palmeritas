// Compositing worker — Sprint 4
// Composita assays a longitud fija (1m, 2m, 5m o custom) con grade ponderado por longitud.

import type { AssayRow } from "@/engine3d/data/csvDrillholes";

export type CompositingInput = {
  assays: AssayRow[];
  length: number; // m
};

export type Composite = {
  hole_id: string;
  from: number;
  to: number;
  length: number;
  grade: number; // length-weighted average
  coverage: number; // 0..1, fracción del intervalo cubierto por assays
  nSamples: number;
};

export type CompositingResult = {
  composites: Composite[];
  stats: {
    nHoles: number;
    nComposites: number;
    nRawAssays: number;
    avgGrade: number;
    length: number;
    elapsedMs: number;
  };
};

function compositeHole(holeId: string, list: AssayRow[], length: number): Composite[] {
  const sorted = [...list].sort((a, b) => a.from - b.from);
  if (sorted.length === 0) return [];
  const minFrom = sorted[0].from;
  const maxTo = sorted[sorted.length - 1].to;
  // Alinear al múltiplo de `length` inferior
  const start = Math.floor(minFrom / length) * length;
  const out: Composite[] = [];
  for (let cFrom = start; cFrom < maxTo; cFrom += length) {
    const cTo = cFrom + length;
    let weighted = 0;
    let covered = 0;
    let n = 0;
    for (const a of sorted) {
      if (a.to <= cFrom) continue;
      if (a.from >= cTo) break;
      const ov = Math.min(cTo, a.to) - Math.max(cFrom, a.from);
      if (ov <= 0) continue;
      weighted += a.grade * ov;
      covered += ov;
      n++;
    }
    if (covered > 0) {
      out.push({
        hole_id: holeId,
        from: cFrom,
        to: cTo,
        length,
        grade: weighted / covered,
        coverage: covered / length,
        nSamples: n,
      });
    }
  }
  return out;
}

function run(input: CompositingInput): CompositingResult {
  const t0 = performance.now();
  const byHole = new Map<string, AssayRow[]>();
  for (const a of input.assays) {
    const list = byHole.get(a.hole_id) ?? [];
    list.push(a);
    byHole.set(a.hole_id, list);
  }
  const composites: Composite[] = [];
  for (const [id, list] of byHole) {
    composites.push(...compositeHole(id, list, input.length));
  }
  let total = 0;
  for (const c of composites) total += c.grade;
  return {
    composites,
    stats: {
      nHoles: byHole.size,
      nComposites: composites.length,
      nRawAssays: input.assays.length,
      avgGrade: composites.length ? total / composites.length : 0,
      length: input.length,
      elapsedMs: performance.now() - t0,
    },
  };
}

self.onmessage = (e: MessageEvent<{ type: "composite"; input: CompositingInput }>) => {
  if (e.data?.type !== "composite") return;
  try {
    const result = run(e.data.input);
    (self as unknown as Worker).postMessage({ type: "result", result });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
