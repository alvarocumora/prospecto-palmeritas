// Orquesta DEM (server fn) + Martini worker. Devuelve buffers para TerrainMartiniLayer.
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDemTile, type DemTile } from "@/engine3d/terrain/dem.functions";
import type { MartiniInput, MartiniOutput } from "@/engine3d/terrain/martini.worker";

export type TerrainQuality = "low" | "med" | "high";

const ERROR_BY_QUALITY: Record<TerrainQuality, number> = {
  low: 8,
  med: 3,
  high: 1.2,
};

const SIZE_BY_QUALITY: Record<TerrainQuality, number> = {
  low: 129,
  med: 257,
  high: 513,
};

export function useTerrainDEM(
  projectId: string,
  enabled: boolean,
  quality: TerrainQuality,
  verticalExaggeration: number,
  extentMeters = 4000,
) {
  const fetchDem = useServerFn(getDemTile);
  const demQ = useQuery({
    queryKey: ["engine3d", "dem", projectId, SIZE_BY_QUALITY[quality], extentMeters],
    queryFn: () => fetchDem({ data: { projectId, size: SIZE_BY_QUALITY[quality], extentMeters } }),
    enabled,
    staleTime: 30 * 60_000,
  });

  const [mesh, setMesh] = useState<MartiniOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    const w = new Worker(
      new URL("@/engine3d/terrain/martini.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = w;
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const w = workerRef.current;
    if (!w || !enabled) return;
    const tile: DemTile | undefined = demQ.data;
    if (!tile) return;
    const reqId = ++reqRef.current;
    setBusy(true);
    const handler = (ev: MessageEvent<MartiniOutput>) => {
      if (reqId !== reqRef.current) return;
      setMesh(ev.data);
      setBusy(false);
    };
    w.addEventListener("message", handler, { once: true });
    const msg: MartiniInput = {
      heights: tile.heights,
      size: tile.size,
      extentMeters: tile.extentMeters,
      errorMeters: ERROR_BY_QUALITY[quality],
      verticalExaggeration,
    };
    w.postMessage(msg);
    return () => w.removeEventListener("message", handler);
  }, [enabled, demQ.data, quality, verticalExaggeration]);

  return { mesh, busy, loading: demQ.isLoading };
}
