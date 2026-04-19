import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { RecordStatus } from "@/components/RecordStatusBadge";

export type ApprovableTable = "drill_core_logs" | "sampling_results";

type ApprovalPatch = {
  record_status: RecordStatus;
  approved_by: string | null;
  approved_at: string | null;
};

function buildPatch(userId: string, status: RecordStatus): ApprovalPatch {
  if (status === "approved") {
    return { record_status: status, approved_by: userId, approved_at: new Date().toISOString() };
  }
  return { record_status: status, approved_by: null, approved_at: null };
}

/**
 * Workflow draft → review → approved → archived for drill_core_logs and sampling_results.
 * RLS already restricts who can update; here we only set the audit fields.
 */
export function useRecordApproval() {
  const { user } = useAuth();

  const setStatus = useCallback(async (table: ApprovableTable, id: string, status: RecordStatus) => {
    if (!user) return { error: "no-user" };
    const patch = buildPatch(user.id, status);
    const { error } = table === "drill_core_logs"
      ? await supabase.from("drill_core_logs").update(patch).eq("id", id)
      : await supabase.from("sampling_results").update(patch).eq("id", id);
    return { error: error?.message ?? null };
  }, [user]);

  const bulkSetStatus = useCallback(async (table: ApprovableTable, ids: string[], status: RecordStatus) => {
    if (!user || ids.length === 0) return { error: "no-op" };
    const patch = buildPatch(user.id, status);
    const { error } = table === "drill_core_logs"
      ? await supabase.from("drill_core_logs").update(patch).in("id", ids)
      : await supabase.from("sampling_results").update(patch).in("id", ids);
    return { error: error?.message ?? null };
  }, [user]);

  return { setStatus, bulkSetStatus };
}
