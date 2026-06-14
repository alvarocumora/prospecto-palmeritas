// Orquesta el worker de block model. Recalcula sólo cuando cambian los inputs
// significativos. El worker devuelve typed-arrays transferibles.
import { useEffect, useMemo, useRef, useState } from "react";
import type { AnomalyPoint } from "@/engine3d/data/anomalies.functions";
import type {
  BlockCommodity,
  BlockModelInput,
  BlockModelOutput,
} from "@/engine3d/workers/blockModel.worker";

export type BlockModelParams = {
  enabled: boolean;
  blockSize: number; // m, cubic
  searchRadius: number;
  minSamples: number;
  maxSamples: number;
  power: number;
  density: number; // t/m3
  commodity: BlockCommodity;
  /** Conversión v(0..1) → grade en unidad del commodity. */
  gradeScale: number;
  classMeasuredR: number;
  classIndicatedR: number;
  /** Padding alrededor del bbox de muestras (m). */
  margin: number;
  /** Máximo nº de bloques permitido (LOD safety). */
  maxBlocks: number;
};

export const DEFAULT_BLOCK_PARAMS: BlockModelParams = {
  enabled: false,
  blockSize: 25,
  searchRadius: 120,
  minSamples: 2,
  maxSamples: 8,
  power: 2,
  density: 2.7,
  commodity: "au",
  gradeScale: 5, // 0..1 → 0..5 g/t
  classMeasuredR: 40,
  classIndicatedR: 90,
  margin: 100,
  maxBlocks: 120_000,
};

export function useBlockModel(points: AnomalyPoint[], params: BlockModelParams) {
  const [output, setOutput] = useState<BlockModelOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL("@/engine3d/workers/blockModel.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = w;
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  const bbox = useMemo(() => {
    if (!params.enabled || points.length === 0) return null;
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const m = params.margin;
    return {
      minX: minX - m,
      maxX: maxX + m,
      minY: minY - m,
      maxY: maxY + m,
      minZ: minZ - m,
      maxZ: maxZ + m,
    };
  }, [points, params.enabled, params.margin]);

  useEffect(() => {
    const w = workerRef.current;
    if (!w || !params.enabled || !bbox || points.length === 0) {
      setOutput(null);
      setError(null);
      return;
    }
    // LOD: si excede maxBlocks, agrandar blockSize
    const nx = Math.floor((bbox.maxX - bbox.minX) / params.blockSize);
    const ny = Math.floor((bbox.maxY - bbox.minY) / params.blockSize);
    const nz = Math.floor((bbox.maxZ - bbox.minZ) / params.blockSize);
    const total = nx * ny * nz;
    if (total > params.maxBlocks) {
      setError(`Demasiados bloques (${total.toLocaleString()}). Aumenta el tamaño.`);
      setOutput(null);
      return;
    }
    setError(null);
    const reqId = ++reqRef.current;
    setBusy(true);
    const handler = (ev: MessageEvent<BlockModelOutput>) => {
      if (reqId !== reqRef.current) return;
      setOutput(ev.data);
      setBusy(false);
    };
    w.addEventListener("message", handler, { once: true });
    const msg: BlockModelInput = {
      samples: points.map((p) => ({ x: p.x, y: p.y, z: p.z, v: p.v })),
      bbox,
      blockSize: { x: params.blockSize, y: params.blockSize, z: params.blockSize },
      power: params.power,
      searchRadius: params.searchRadius,
      minSamples: params.minSamples,
      maxSamples: params.maxSamples,
      density: params.density,
      gradeScale: params.gradeScale,
      commodity: params.commodity,
      classMeasuredR: params.classMeasuredR,
      classIndicatedR: params.classIndicatedR,
    };
    w.postMessage(msg);
    return () => w.removeEventListener("message", handler);
  }, [
    points,
    bbox,
    params.enabled,
    params.blockSize,
    params.power,
    params.searchRadius,
    params.minSamples,
    params.maxSamples,
    params.density,
    params.gradeScale,
    params.commodity,
    params.classMeasuredR,
    params.classIndicatedR,
    params.maxBlocks,
  ]);

  return { output, busy, error };
}
