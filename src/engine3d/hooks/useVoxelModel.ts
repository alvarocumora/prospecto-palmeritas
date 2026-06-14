// Hook: orquesta el worker de voxelización. Recomputa cuando cambian puntos o params.
import { useEffect, useRef, useState } from "react";
import type { AnomalyPoint } from "@/engine3d/data/anomalies.functions";
import type { VoxelOutput } from "@/engine3d/workers/voxel.worker";

export type VoxelParams = {
  resolution: number;
  isovalue: number;
  power: number;
  margin: number;
  kNearest: number;
};

export const DEFAULT_VOXEL_PARAMS: VoxelParams = {
  resolution: 40,
  isovalue: 0.45,
  power: 2,
  margin: 600,
  kNearest: 8,
};

export function useVoxelModel(points: AnomalyPoint[], params: VoxelParams) {
  const [output, setOutput] = useState<VoxelOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const reqRef = useRef(0);

  // Crea/destruye worker
  useEffect(() => {
    const w = new Worker(new URL("@/engine3d/workers/voxel.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = w;
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  // Recalcula al cambiar puntos o parámetros
  useEffect(() => {
    const w = workerRef.current;
    if (!w) return;
    if (points.length === 0) {
      setOutput(null);
      return;
    }
    const reqId = ++reqRef.current;
    setBusy(true);
    const handler = (ev: MessageEvent<VoxelOutput>) => {
      if (reqId !== reqRef.current) return; // descarta stale
      setOutput(ev.data);
      setBusy(false);
    };
    w.addEventListener("message", handler, { once: true });
    w.postMessage({
      points,
      resolution: params.resolution,
      isovalue: params.isovalue,
      power: params.power,
      margin: params.margin,
      kNearest: params.kNearest,
    });
    return () => w.removeEventListener("message", handler);
  }, [points, params.resolution, params.isovalue, params.power, params.margin, params.kNearest]);

  return { output, busy };
}
