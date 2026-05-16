import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SatIndexCode } from "./useProjectSatelliteAnomalies";

export type ProgressState = {
  runsDone: number;
  anomaliesDone: number;
  indicesDone: SatIndexCode[];
  currentIndex: SatIndexCode | null;
  percent: number;
};

type Params = {
  projectId: string | null;
  enabled: boolean;
  startedAt: Date | null;
  expectedRuns: number;
  expectedAnomalies: number;
};

const EMPTY: ProgressState = {
  runsDone: 0,
  anomaliesDone: 0,
  indicesDone: [],
  currentIndex: null,
  percent: 0,
};

export function useSatelliteAnalysisProgress({
  projectId,
  enabled,
  startedAt,
  expectedRuns,
  expectedAnomalies,
}: Params): ProgressState {
  const [state, setState] = useState<ProgressState>(EMPTY);
  const startMs = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !projectId || !startedAt) {
      setState(EMPTY);
      return;
    }
    startMs.current = startedAt.getTime();
    setState(EMPTY);

    const channel = supabase
      .channel(`sat-progress-${projectId}-${startMs.current}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "satellite_analysis_runs",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const row = payload.new as {
            created_at?: string;
            pipeline_version?: string | null;
            index_code?: SatIndexCode;
          };
          const created = row.created_at ? new Date(row.created_at).getTime() : Date.now();
          if (created + 2000 < startMs.current) return;
          if (row.pipeline_version !== "target-batch-v1") return;
          if (!row.index_code) return;
          setState((s) => {
            if (s.indicesDone.includes(row.index_code!)) return s;
            const indicesDone = [...s.indicesDone, row.index_code!];
            const runsDone = indicesDone.length;
            return {
              ...s,
              runsDone,
              indicesDone,
              currentIndex: row.index_code!,
              percent: computePercent(runsDone, s.anomaliesDone, expectedRuns, expectedAnomalies),
            };
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "satellite_anomalies",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const row = payload.new as { detected_at?: string };
          const created = row.detected_at ? new Date(row.detected_at).getTime() : Date.now();
          if (created + 2000 < startMs.current) return;
          setState((s) => {
            const anomaliesDone = s.anomaliesDone + 1;
            return {
              ...s,
              anomaliesDone,
              percent: computePercent(s.runsDone, anomaliesDone, expectedRuns, expectedAnomalies),
            };
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, enabled, startedAt, expectedRuns, expectedAnomalies]);

  return state;
}

function computePercent(
  runsDone: number,
  anomaliesDone: number,
  expectedRuns: number,
  expectedAnomalies: number,
): number {
  const rPart = expectedRuns > 0 ? Math.min(1, runsDone / expectedRuns) : 0;
  const aPart = expectedAnomalies > 0 ? Math.min(1, anomaliesDone / expectedAnomalies) : 0;
  return Math.round(Math.min(100, Math.max(0, (0.3 * rPart + 0.7 * aPart) * 100)));
}
