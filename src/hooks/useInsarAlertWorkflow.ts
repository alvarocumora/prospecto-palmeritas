import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  runInsarAlertWorkflow,
  addInsarAlertAction,
  getInsarAlertHistory,
} from "@/lib/satelliteIntel.functions";

export function useInsarAlertHistory(projectId: string | null | undefined) {
  const fn = useServerFn(getInsarAlertHistory);
  return useQuery({
    queryKey: ["insar-alert-history", projectId],
    queryFn: async () => {
      if (!projectId) return { sites: [], actions: [], tasks: [] };
      return fn({ data: { projectId } });
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useRunInsarWorkflow() {
  const fn = useServerFn(runInsarAlertWorkflow);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { projectId: string; dryRun?: boolean }) => fn({ data: vars }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["insar-alert-history", vars.projectId] });
    },
  });
}

export function useAddInsarAction() {
  const fn = useServerFn(addInsarAlertAction);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      projectId: string;
      insarId: string;
      actionType: "recommendation" | "status_change" | "dismissed" | "escalated" | "field_inspection" | "closed";
      recommendation?: string;
      notes?: string;
    }) => fn({ data: vars }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["insar-alert-history", vars.projectId] });
    },
  });
}
