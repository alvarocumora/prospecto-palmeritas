// Orquesta el worker de isosurface (IDW field + Marching Cubes).
import { useEffect, useRef, useState } from "react";
import type { AnomalyPoint } from "@/engine3d/data/anomalies.functions";
import type { IsoInput, IsoOutput } from "@/engine3d/workers/isosurface.worker";

export type IsosurfaceParams = {
  resolution: number;
  isovalue: number;
  power: number;
  margin: number;
  kNearest: number;
};

export const DEFAULT_ISO_PARAMS: IsosurfaceParams = {
  resolution: 48,
  isovalue: 0.45,
  power: 2,
  margin: 600,
  kNearest: 8,
};

export function useIsosurface(points: AnomalyPoint[], params: IsosurfaceParams) {
  const [output, setOutput] = useState<IsoOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL("@/engine3d/workers/isosurface.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = w;
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const w = workerRef.current;
    if (!w) return;
    if (points.length === 0) {
      setOutput(null);
      return;
    }
    const reqId = ++reqRef.current;
    setBusy(true);
    const handler = (ev: MessageEvent<IsoOutput>) => {
      if (reqId !== reqRef.current) return;
      setOutput(ev.data);
      setBusy(false);
    };
    w.addEventListener("message", handler, { once: true });
    const msg: IsoInput = {
      points,
      resolution: params.resolution,
      isovalue: params.isovalue,
      power: params.power,
      margin: params.margin,
      kNearest: params.kNearest,
    };
    w.postMessage(msg);
    return () => w.removeEventListener("message", handler);
  }, [points, params.resolution, params.isovalue, params.power, params.margin, params.kNearest]);

  return { output, busy };
}
