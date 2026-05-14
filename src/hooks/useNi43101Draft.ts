import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNi43101DraftReport, type Ni43101Draft } from "@/lib/ni43101Draft.functions";

export function useNi43101Draft(projectId: string | null | undefined) {
  const fn = useServerFn(getNi43101DraftReport);
  return useQuery<Ni43101Draft | null>({
    queryKey: ["ni43101-draft", projectId],
    queryFn: () => fn({ data: { projectId: projectId! } }),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}
