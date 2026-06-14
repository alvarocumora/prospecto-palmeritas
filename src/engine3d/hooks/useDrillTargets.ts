// useDrillTargets — Sprint 5
// Hook que dispara el worker de ranking de targets.
import { useEffect, useRef, useState } from "react";
import type {
  DrillTarget,
  DrillTargetInput,
  DrillTargetOutput,
} from "@/engine3d/ai/drillTarget.worker";

export type DrillTargetParams = Omit<DrillTargetInput, "anomalies" | "existingCollars">;

export const DEFAULT_TARGET_PARAMS: DrillTargetParams = {
  maxTargets: 12,
  minSeparation: 120,
  minAnomaly: 0.55,
  costPerMeter: 350,
  mobilization: 25_000,
  assayPerMeter: 60,
  overheadMult: 1.2,
  qaqcPenalty: 1,
  defaultAzimuth: 90,
  defaultDip: -60,
};

export function useDrillTargets(
  anomalies: DrillTargetInput["anomalies"],
  existingCollars: DrillTargetInput["existingCollars"],
  params: DrillTargetParams,
  enabled = true,
) {
  const [output, setOutput] = useState<DrillTargetOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled || anomalies.length === 0) {
      setOutput(null);
      return;
    }
    setBusy(true);
    setError(null);
    const worker = new Worker(new URL("@/engine3d/ai/drillTarget.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.onmessage = (ev: MessageEvent<DrillTargetOutput>) => {
      setOutput(ev.data);
      setBusy(false);
      worker.terminate();
    };
    worker.onerror = (ev) => {
      setError(ev.message ?? "drill target worker error");
      setBusy(false);
      worker.terminate();
    };
    const msg: DrillTargetInput = { ...params, anomalies, existingCollars };
    worker.postMessage(msg);
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [enabled, anomalies, existingCollars, params]);

  return { output, busy, error };
}

export type { DrillTarget };
