// useEngineComments — Sprint 6
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listComments,
  addComment,
  updateCommentStatus,
  deleteComment,
  type EngineCommentRow,
} from "./engineCloud";

export function useEngineComments(
  projectId: string,
  entityType: EngineCommentRow["entity_type"],
  entityId: string,
  enabled = true,
) {
  const qc = useQueryClient();
  const key = ["engine-comments", projectId, entityType, entityId];

  const q = useQuery({
    queryKey: key,
    queryFn: () => listComments(projectId, entityType, entityId),
    enabled: enabled && !!projectId && !!entityId,
    staleTime: 15_000,
  });

  const addM = useMutation({
    mutationFn: (input: {
      body: string;
      status?: EngineCommentRow["status"];
      mentions?: string[];
    }) => addComment({ projectId, entityType, entityId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const statusM = useMutation({
    mutationFn: (input: { id: string; status: EngineCommentRow["status"] }) =>
      updateCommentStatus(input.id, input.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    comments: q.data ?? [],
    loading: q.isLoading,
    error: q.error,
    add: addM.mutateAsync,
    setStatus: statusM.mutateAsync,
    remove: deleteM.mutateAsync,
  };
}
