import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runSatelliteAnalysisOnTargets } from "@/lib/satelliteIntel.functions";
import type { SatIndexCode } from "./useProjectSatelliteAnomalies";

export function useRunSatelliteAnalysisOnTargets() {
  const qc = useQueryClient();
  const run = useServerFn(runSatelliteAnalysisOnTargets);
  return useMutation({
    mutationFn: (vars: { projectId: string; targetIds: string[]; indexCodes: SatIndexCode[] }) =>
      run({ data: vars }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["satellite_anomalies", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["satellite_runs", vars.projectId] });
    },
  });
}
