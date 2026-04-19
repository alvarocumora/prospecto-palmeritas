import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { RecordStatus } from "@/components/RecordStatusBadge";

export type ApprovableTable = "drill_core_logs" | "sampling_results";

/**
 * Workflow draft → review → approved → archived for drill_core_logs and sampling_results.
 * RLS already restricts who can update; here we only set the audit fields.
 */
export function useRecordApproval() {
  const { user } = useAuth();

  const setStatus = useCallback(async (
    table: ApprovableTable,
    id: string,
    status: RecordStatus,
  ) => {
    if (!user) return { error: "no-user" };
    const patch: Record<string, unknown> = { record_status: status };
    if (status === "approved") {
      patch.approved_by = user.id;
      patch.approved_at = new Date().toISOString();
    } else {
      patch.approved_by = null;
      patch.approved_at = null;
    }
    const { error } = await supabase.from(table).update(patch).eq("id", id);
    return { error: error?.message ?? null };
  }, [user]);

  const bulkSetStatus = useCallback(async (
    table: ApprovableTable,
    ids: string[],
    status: RecordStatus,
  ) => {
    if (!user || ids.length === 0) return { error: "no-op" };
    const patch: Record<string, unknown> = { record_status: status };
    if (status === "approved") {
      patch.approved_by = user.id;
      patch.approved_at = new Date().toISOString();
    } else {
      patch.approved_by = null;
      patch.approved_at = null;
    }
    const { error } = await supabase.from(table).update(patch).in("id", ids);
    return { error: error?.message ?? null };
  }, [user]);

  return { setStatus, bulkSetStatus };
}
