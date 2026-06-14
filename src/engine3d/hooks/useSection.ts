// useSection: orquesta el cálculo de sección (sync para meshes pequeños,
// worker para >100k tris). Recalcula solo cuando cambian las dependencias
// clave (plano, ancho, datasets).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeSection,
  isoEnuToThree,
  type SectionInput,
  type SectionMeshInput,
  type SectionResult,
} from "@/engine3d/sections/sectionEngine";
import type { IsoOutput } from "@/engine3d/workers/isosurface.worker";
import type { MartiniOutput } from "@/engine3d/terrain/martini.worker";
import type { DrillholeSegment } from "@/engine3d/data/drillholes.functions";
import type { AnomalyPoint } from "@/engine3d/data/anomalies.functions";

const WORKER_THRESHOLD = 100_000;

export type UseSectionArgs = {
  iso: IsoOutput | null;
  terrain: MartiniOutput | null;
  holes: DrillholeSegment[];
  samples: AnomalyPoint[];
  planeNormal: { x: number; y: number; z: number };
  planeConstant: number;
  width: number;
  verticalExaggeration: number;
  /** Nonce para forzar recálculo manual ("Generate Section"). */
  trigger: number;
};

export function useSection(args: UseSectionArgs) {
  const [result, setResult] = useState<SectionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const isoMesh = useMemo<SectionMeshInput | null>(() => {
    if (!args.iso || args.iso.vertexCount === 0) return null;
    return {
      positions: isoEnuToThree(args.iso.positions, args.verticalExaggeration),
      indices: args.iso.indices,
    };
  }, [args.iso, args.verticalExaggeration]);

  const terrainMesh = useMemo<SectionMeshInput | null>(() => {
    if (!args.terrain || args.terrain.vertexCount === 0) return null;
    return { positions: args.terrain.positions, indices: args.terrain.indices };
  }, [args.terrain]);

  const compute = useCallback(() => {
    const input: SectionInput = {
      iso: isoMesh,
      terrain: terrainMesh,
      holes: args.holes,
      samples: args.samples,
      planeNormal: args.planeNormal,
      planeConstant: args.planeConstant,
      width: args.width,
      verticalExaggeration: args.verticalExaggeration,
    };
    const triCount = (isoMesh?.indices.length ?? 0) / 3 + (terrainMesh?.indices.length ?? 0) / 3;
    const reqId = ++reqRef.current;
    setBusy(true);
    if (triCount > WORKER_THRESHOLD) {
      if (!workerRef.current) {
        workerRef.current = new Worker(
          new URL("@/engine3d/sections/section.worker.ts", import.meta.url),
          { type: "module" },
        );
      }
      const w = workerRef.current;
      const handler = (ev: MessageEvent<SectionResult>) => {
        if (reqId !== reqRef.current) return;
        setResult(ev.data);
        setBusy(false);
      };
      w.addEventListener("message", handler, { once: true });
      w.postMessage(input);
    } else {
      // sync, microtask para no bloquear el click handler
      Promise.resolve().then(() => {
        if (reqId !== reqRef.current) return;
        try {
          setResult(computeSection(input));
        } finally {
          setBusy(false);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isoMesh,
    terrainMesh,
    args.holes,
    args.samples,
    args.planeNormal.x,
    args.planeNormal.y,
    args.planeNormal.z,
    args.planeConstant,
    args.width,
    args.verticalExaggeration,
  ]);

  // Recalcula al cambiar dependencias clave o cuando se incrementa trigger.
  useEffect(() => {
    compute();
  }, [compute, args.trigger]);

  const reset = useCallback(() => {
    reqRef.current++;
    setResult(null);
    setBusy(false);
  }, []);

  return { result, busy, recompute: compute, reset };
}
